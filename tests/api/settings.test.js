import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setup } from './helpers.js';

let t;
beforeEach(() => (t = setup()));
afterEach(() => t.cleanup());

describe('settings API', () => {
  it('returns settings with schema', async () => {
    const maya = await t.signup('maya');
    const res = await maya.api.get('/settings');
    expect(res.body.settings.playback.imageDurationSec).toBe(5);
    expect(res.body.schema.privacy.storyReplies.values).toEqual(['everyone', 'following', 'off']);
  });

  it('patches settings and reflects them in /auth/me', async () => {
    const maya = await t.signup('maya');
    const res = await maya.api.patch('/settings').send({ appearance: { theme: 'light' }, playback: { autoAdvance: false } });
    expect(res.status).toBe(200);
    const me = await maya.api.get('/auth/me');
    expect(me.body.user.settings.appearance.theme).toBe('light');
    expect(me.body.user.settings.playback.autoAdvance).toBe(false);
  });

  it('rejects invalid settings without applying any', async () => {
    const maya = await t.signup('maya');
    const res = await maya.api.patch('/settings').send({ appearance: { theme: 'neon' }, playback: { autoAdvance: false } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/appearance.theme/);
    expect((await maya.api.get('/settings')).body.settings.playback.autoAdvance).toBe(true);
  });

  it('changes password, invalidating old tokens', async () => {
    const maya = await t.signup('maya');
    expect((await maya.api.post('/settings/password').send({ currentPassword: 'wrong', newPassword: 'newpass123' })).status).toBe(403);
    expect((await maya.api.post('/settings/password').send({ currentPassword: 'password1', newPassword: 'short' })).status).toBe(400);
    const ok = await maya.api.post('/settings/password').send({ currentPassword: 'password1', newPassword: 'newpass123' });
    expect(ok.status).toBe(200);
    expect((await maya.api.get('/auth/me')).status).toBe(401);
    expect((await t.as(ok.body.token).get('/auth/me')).status).toBe(200);
    const login = await t.request().post('/api/auth/login').send({ login: 'maya', password: 'newpass123' });
    expect(login.status).toBe(200);
  });
});

describe('notifications API', () => {
  it('notifies on follow, like and reply, and marks all read', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    const s = await t.postStory(maya);
    await leo.api.post('/users/maya/follow');
    await leo.api.post(`/stories/${s.id}/like`);
    t.clock.now += 1000;
    await leo.api.post(`/stories/${s.id}/reply`).send({ text: 'wow' });
    const res = await maya.api.get('/notifications');
    expect(res.body.unread).toBe(3);
    expect(res.body.notifications.map((n) => n.type).sort()).toEqual(['follow', 'like', 'reply']);
    expect(res.body.notifications[0]).toMatchObject({ type: 'reply', text: 'wow', actor: { username: 'leo' } });
    await maya.api.post('/notifications/read');
    expect((await maya.api.get('/notifications')).body.unread).toBe(0);
  });

  it('notifies follow requests and acceptances', async () => {
    const sam = await t.signup('sam');
    const leo = await t.signup('leo');
    await sam.api.patch('/settings').send({ privacy: { privateAccount: true } });
    await leo.api.post('/users/sam/follow');
    expect((await sam.api.get('/notifications')).body.notifications[0].type).toBe('follow_request');
    await sam.api.post(`/users/me/requests/${leo.user.id}/accept`);
    expect((await leo.api.get('/notifications')).body.notifications[0].type).toBe('follow_accepted');
  });

  it('respects per-type and pause-all notification settings', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    const zoe = await t.signup('zoe');
    const s = await t.postStory(maya);
    await maya.api.patch('/settings').send({ notifications: { likes: false } });
    await leo.api.post(`/stories/${s.id}/like`);
    await leo.api.post('/users/maya/follow');
    expect((await maya.api.get('/notifications')).body.notifications.map((n) => n.type)).toEqual(['follow']);
    await maya.api.patch('/settings').send({ notifications: { pauseAll: true } });
    await zoe.api.post('/users/maya/follow');
    expect((await maya.api.get('/notifications')).body.notifications).toHaveLength(1);
  });
});
