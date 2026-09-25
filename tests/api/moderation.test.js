import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setup } from './helpers.js';
import { TERMS_VERSION } from '../../server/lib/moderation.js';

let t;
beforeEach(() => (t = setup({ moderators: ['boss'] })));
afterEach(() => t.cleanup());

/** creator posts; 3 reporters; a moderator ("mod" via role, "boss" via config). */
async function world() {
  const creator = await t.signup('creator');
  const story = await t.postStory(creator, { text: 'buy followers cheap' });
  const reporters = [await t.signup('rep1'), await t.signup('rep2'), await t.signup('rep3')];
  const mod = await t.signup('mod');
  t.db.update('users', (u) => u.id === mod.user.id, { role: 'moderator' });
  const boss = await t.signup('boss');
  return { creator, story, reporters, mod, boss };
}

describe('terms of use', () => {
  it('requires accepting the terms at sign-up and records the version', async () => {
    const res = await t.request().post('/api/auth/signup').send({ username: 'nope', email: 'n@example.com', password: 'password1' });
    expect(res.status).toBe(400);
    expect(res.body.field).toBe('acceptTerms');
    const ok = await t.signup('yes');
    expect(ok.user.needsTermsAcceptance).toBe(false);
    expect(t.db.find('users', (u) => u.username === 'yes')).toMatchObject({ termsVersion: TERMS_VERSION });
  });

  it('asks existing users to accept updated terms', async () => {
    const u = await t.signup('old');
    t.db.update('users', (x) => x.id === u.user.id, { termsVersion: '2020-01-01' });
    expect((await u.api.get('/auth/me')).body.user.needsTermsAcceptance).toBe(true);
    expect((await u.api.post('/auth/accept-terms')).body.user.needsTermsAcceptance).toBe(false);
  });
});

describe('objectionable content filter', () => {
  it.each([
    ['story text', (u) => u.api.post('/stories').send({ text: 'you are a f4ggot' }), 'text'],
    ['story caption', (u) => u.api.post('/stories').send({ text: 'hi', caption: 'kys' }), 'caption'],
    ['story tags', (u) => u.api.post('/stories').send({ text: 'hi', tags: '#retard' }), 'tags'],
    ['bio', (u) => u.api.patch('/users/me').send({ bio: 'n1gg3r' }), 'bio'],
    ['display name', (u) => u.api.patch('/users/me').send({ displayName: 'Tranny' }), 'displayName'],
    ['highlight title', async (u) => {
      const s = await t.postStory(u);
      return u.api.post('/highlights').send({ title: 'fags', storyIds: [s.id] });
    }, 'title'],
  ])('rejects slurs in %s', async (_label, act, field) => {
    const u = await t.signup('writer');
    const res = await act(u);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/isn't allowed/);
    expect(res.body.field).toBe(field);
  });

  it('rejects slurs in usernames, replies and DMs', async () => {
    const bad = await t.request().post('/api/auth/signup').send({ username: 'spic_king', email: 's@example.com', password: 'password1', acceptTerms: true });
    expect(bad.status).toBe(400);
    const a = await t.signup('alpha');
    const b = await t.signup('bravo');
    await a.api.post('/users/bravo/follow');
    await b.api.post('/users/alpha/follow');
    const s = await t.postStory(b);
    expect((await a.api.post(`/stories/${s.id}/reply`).send({ text: 'go die' })).status).toBe(400);
    expect((await a.api.post('/messages/bravo').send({ text: 'kill yourself' })).status).toBe(400);
  });

  it('allows ordinary language, including words that contain blocked letters', async () => {
    const u = await t.signup('writer');
    expect((await u.api.post('/stories').send({ text: 'Classic cocktail night in Scunthorpe 🍸', caption: 'Pakistan trip next!' })).status).toBe(201);
  });
});

describe('reporting', () => {
  it('lists report reasons', async () => {
    const u = await t.signup('someuser');
    const { reasons } = (await u.api.get('/reports/reasons')).body;
    expect(Object.keys(reasons)).toEqual(expect.arrayContaining(['spam', 'harassment', 'hate', 'nudity', 'self_harm', 'minor_safety', 'other']));
  });

  it('reports a story once per person and can block at the same time', async () => {
    const { creator, story, reporters } = await world();
    const [r1] = reporters;
    const res = await r1.api.post('/reports').send({ targetType: 'story', targetId: story.id, reason: 'spam', details: 'selling followers', block: true });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ duplicate: false, blocked: true, autoHidden: false });
    const again = await r1.api.post('/reports').send({ targetType: 'story', targetId: story.id, reason: 'spam' });
    expect(again.status).toBe(200);
    expect(again.body.duplicate).toBe(true);
    expect(t.db.all('reports').filter((r) => r.targetId === story.id)).toHaveLength(1);
    expect((await r1.api.get(`/users/${creator.user.username}`)).body.relationship.blocked).toBe(true);
    expect((await r1.api.get('/reports/mine')).body.reports).toMatchObject([{ targetType: 'story', reason: 'spam', status: 'open' }]);
  });

  it('keeps a snapshot of reported content as evidence', async () => {
    const { story, reporters } = await world();
    await reporters[0].api.post('/reports').send({ targetType: 'story', targetId: story.id, reason: 'spam' });
    expect(t.db.all('reports')[0].snapshot).toMatchObject({ type: 'text', text: 'buy followers cheap' });
  });

  it('auto-hides a story after 3 different people report it', async () => {
    const { creator, story, reporters } = await world();
    const viewer = await t.signup('viewer');
    for (const [i, r] of reporters.entries()) {
      const res = await r.api.post('/reports').send({ targetType: 'story', targetId: story.id, reason: 'spam' });
      expect(res.body.autoHidden).toBe(i === 2);
    }
    expect((await viewer.api.get(`/stories/${story.id}`)).status).toBe(404);
    expect((await viewer.api.get('/feed')).body.discover).toEqual([]);
    // The author still sees it, flagged as hidden.
    const own = await creator.api.get(`/stories/${story.id}`);
    expect(own.body.story.moderation).toBe('hidden');
  });

  it('validates reports', async () => {
    const { creator, story, reporters } = await world();
    const r = reporters[0];
    expect((await r.api.post('/reports').send({ targetType: 'planet', targetId: story.id, reason: 'spam' })).status).toBe(400);
    expect((await r.api.post('/reports').send({ targetType: 'story', targetId: story.id, reason: 'meh' })).status).toBe(400);
    expect((await r.api.post('/reports').send({ targetType: 'story', targetId: 'nope', reason: 'spam' })).status).toBe(404);
    expect((await r.api.post('/reports').send({ targetType: 'story', targetId: story.id, reason: 'spam', details: 'x'.repeat(501) })).status).toBe(400);
    expect((await creator.api.post('/reports').send({ targetType: 'story', targetId: story.id, reason: 'spam' })).status).toBe(400);
  });

  it('reports users, DMs sent to you, and story replies sent to you — not other people’s messages', async () => {
    const a = await t.signup('alpha');
    const b = await t.signup('bravo');
    const c = await t.signup('charlie');
    await a.api.post('/users/bravo/follow');
    await b.api.post('/users/alpha/follow');
    const dm = (await a.api.post('/messages/bravo').send({ text: 'rude thing' })).body.message;
    const s = await t.postStory(b);
    const reply = (await c.api.post(`/stories/${s.id}/reply`).send({ text: 'creepy reply' })).body.reply;

    expect((await b.api.post('/reports').send({ targetType: 'user', targetId: a.user.id, reason: 'harassment' })).status).toBe(201);
    expect((await b.api.post('/reports').send({ targetType: 'message', targetId: dm.id, reason: 'harassment' })).status).toBe(201);
    expect((await b.api.post('/reports').send({ targetType: 'reply', targetId: reply.id, reason: 'harassment' })).status).toBe(201);
    // c can't report a DM between a and b.
    expect((await c.api.post('/reports').send({ targetType: 'message', targetId: dm.id, reason: 'harassment' })).status).toBe(404);
    // a can't report their own message.
    expect((await a.api.post('/reports').send({ targetType: 'message', targetId: dm.id, reason: 'spam' })).status).toBe(404);
  });
});

describe('moderator queue', () => {
  it('is only available to moderators (by role or by config)', async () => {
    const { reporters, mod, boss } = await world();
    expect((await reporters[0].api.get('/moderation/queue')).status).toBe(403);
    expect((await mod.api.get('/moderation/queue')).status).toBe(200);
    expect((await boss.api.get('/moderation/queue')).status).toBe(200);
    expect((await mod.api.get('/auth/me')).body.user.isModerator).toBe(true);
    expect((await reporters[0].api.get('/auth/me')).body.user.isModerator).toBe(false);
  });

  it('groups reports per item, most reported first', async () => {
    const { creator, story, reporters, mod } = await world();
    await reporters[0].api.post('/reports').send({ targetType: 'user', targetId: creator.user.id, reason: 'impersonation' });
    for (const r of reporters) await r.api.post('/reports').send({ targetType: 'story', targetId: story.id, reason: r === reporters[2] ? 'hate' : 'spam' });
    const { items, openCount } = (await mod.api.get('/moderation/queue')).body;
    expect(openCount).toBe(4);
    expect(items.map((i) => [i.targetType, i.reportCount])).toEqual([['story', 3], ['user', 1]]);
    expect(items[0]).toMatchObject({ reasons: { spam: 2, hate: 1 }, targetUser: { username: 'creator', suspended: false }, content: { state: 'hidden', hiddenReason: 'reports' } });
    expect(items[0].reports[0].reporter.username).toBe('rep1');
  });

  it('dismiss restores an auto-hidden story and tells reporters', async () => {
    const { story, reporters, mod } = await world();
    const viewer = await t.signup('viewer');
    for (const r of reporters) await r.api.post('/reports').send({ targetType: 'story', targetId: story.id, reason: 'spam' });
    const res = await mod.api.post('/moderation/resolve').send({ targetType: 'story', targetId: story.id, action: 'dismiss' });
    expect(res.body).toMatchObject({ resolved: 3, status: 'dismissed' });
    expect((await viewer.api.get(`/stories/${story.id}`)).status).toBe(200);
    const note = (await reporters[0].api.get('/notifications')).body.notifications[0];
    expect(note).toMatchObject({ type: 'report_resolved', actor: null });
    expect(note.text).toMatch(/doesn't go against/);
    expect((await mod.api.get('/moderation/queue')).body.items).toEqual([]);
    expect((await mod.api.get('/moderation/queue?status=resolved')).body.items[0].reports[0].status).toBe('dismissed');
  });

  it('remove takes a story down for everyone, strips it from highlights and notifies the author', async () => {
    const { creator, story, reporters, mod } = await world();
    const other = await t.postStory(creator, { text: 'fine story' });
    await creator.api.post('/highlights').send({ title: 'mix', storyIds: [story.id, other.id] });
    await creator.api.post('/highlights').send({ title: 'solo', storyIds: [story.id] });
    await reporters[0].api.post('/reports').send({ targetType: 'story', targetId: story.id, reason: 'spam' });
    await mod.api.post('/moderation/resolve').send({ targetType: 'story', targetId: story.id, action: 'remove' });
    expect((await reporters[1].api.get(`/stories/${story.id}`)).status).toBe(404);
    expect((await creator.api.get(`/stories/${story.id}`)).body.story.moderation).toBe('removed');
    const hl = (await creator.api.get('/highlights/user/creator')).body.highlights;
    expect(hl.map((h) => [h.title, h.storyCount])).toEqual([['mix', 1]]);
    expect((await creator.api.get('/notifications')).body.notifications.map((n) => n.type)).toContain('content_removed');
    expect((await reporters[0].api.get('/notifications')).body.notifications[0].text).toMatch(/took action/);
    expect(t.db.all('moderationActions')).toMatchObject([{ action: 'remove', targetType: 'story' }]);
  });

  it('removing a reported DM deletes it', async () => {
    const a = await t.signup('alpha');
    const b = await t.signup('bravo');
    const mod = await t.signup('boss');
    await a.api.post('/users/bravo/follow');
    await b.api.post('/users/alpha/follow');
    const dm = (await a.api.post('/messages/bravo').send({ text: 'nasty' })).body.message;
    await b.api.post('/reports').send({ targetType: 'message', targetId: dm.id, reason: 'harassment' });
    await mod.api.post('/moderation/resolve').send({ targetType: 'message', targetId: dm.id, action: 'remove' });
    expect((await b.api.get('/messages/alpha')).body.messages).toEqual([]);
    // The queue keeps the evidence.
    expect((await mod.api.get('/moderation/queue?status=resolved')).body.items[0]).toMatchObject({ snapshot: { text: 'nasty' }, content: { state: 'deleted' } });
  });

  it('suspending hides the account everywhere and blocks login', async () => {
    const { creator, story, reporters, mod } = await world();
    const fan = reporters[1];
    await fan.api.post('/users/creator/follow');
    await reporters[0].api.post('/reports').send({ targetType: 'user', targetId: creator.user.id, reason: 'spam' });
    await mod.api.post('/moderation/resolve').send({ targetType: 'user', targetId: creator.user.id, action: 'suspend', note: 'spam bot' });

    expect((await creator.api.get('/auth/me')).status).toBe(401);
    const login = await t.request().post('/api/auth/login').send({ login: 'creator', password: 'password1' });
    expect(login.status).toBe(403);
    expect(login.body.error).toMatch(/suspended.*help@test\.dev/);
    expect((await fan.api.get('/users/creator')).status).toBe(404);
    expect((await fan.api.get('/users/search?q=creator')).body.users).toEqual([]);
    expect((await fan.api.get(`/stories/${story.id}`)).status).toBe(404);
    expect((await fan.api.get('/feed')).body.friends).toEqual([]);
    expect((await fan.api.get('/users/rep2/following')).body.users).toEqual([]);
    // Moderators can still look the account up.
    expect((await mod.api.get('/users/creator')).status).toBe(200);
    expect((await mod.api.get('/moderation/suspended')).body.users).toMatchObject([{ username: 'creator', suspended: { reason: 'spam bot' } }]);

    await mod.api.post('/moderation/users/creator/unsuspend');
    expect((await t.request().post('/api/auth/login').send({ login: 'creator', password: 'password1' })).status).toBe(200);
    expect((await fan.api.get('/users/creator')).status).toBe(200);
  });

  it('suspended users drop out of DMs', async () => {
    const a = await t.signup('alpha');
    const b = await t.signup('bravo');
    const mod = await t.signup('boss');
    await a.api.post('/users/bravo/follow');
    await b.api.post('/users/alpha/follow');
    await a.api.post('/messages/bravo').send({ text: 'hi' });
    await mod.api.post('/moderation/users/alpha/suspend').send({ reason: 'test' });
    expect((await b.api.get('/messages')).body.conversations).toEqual([]);
    expect((await b.api.post('/messages/alpha').send({ text: 'hello?' })).status).toBe(404);
  });

  it('guards resolve and suspend', async () => {
    const { creator, story, mod, boss } = await world();
    expect((await mod.api.post('/moderation/resolve').send({ targetType: 'story', targetId: story.id, action: 'dismiss' })).status).toBe(404);
    expect((await mod.api.post('/moderation/resolve').send({ targetType: 'story', targetId: story.id, action: 'nuke' })).status).toBe(400);
    await t.signup('someone').then((s) => s.api.post('/reports').send({ targetType: 'user', targetId: creator.user.id, reason: 'spam' }));
    expect((await mod.api.post('/moderation/resolve').send({ targetType: 'user', targetId: creator.user.id, action: 'remove' })).status).toBe(400);
    expect((await mod.api.post('/moderation/users/mod/suspend')).status).toBe(400);
    expect((await mod.api.post('/moderation/users/boss/suspend')).status).toBe(400);
    expect((await mod.api.post('/moderation/users/ghost/suspend')).status).toBe(404);
    expect(boss).toBeTruthy();
  });
});
