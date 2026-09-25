import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PNG, setup } from './helpers.js';

let t;
beforeEach(() => (t = setup()));
afterEach(() => t.cleanup());

describe('profiles', () => {
  it('updates name, bio, website and interests', async () => {
    const maya = await t.signup('maya');
    const res = await maya.api.patch('/users/me').send({
      displayName: 'Maya Chen',
      bio: 'Travel vlogger ✈️',
      website: 'https://maya.example.com',
      interests: 'travel vlog',
    });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ displayName: 'Maya Chen', bio: 'Travel vlogger ✈️', interests: ['travel', 'vlog'] });
  });

  it.each([
    [{ bio: 'x'.repeat(151) }, 'bio'],
    [{ website: 'ftp://x' }, 'website'],
    [{ displayName: '   ' }, 'displayName'],
    [{ displayName: 'x'.repeat(51) }, 'displayName'],
  ])('rejects invalid %j', async (patch, field) => {
    const maya = await t.signup('maya');
    const res = await maya.api.patch('/users/me').send(patch);
    expect(res.status).toBe(400);
    expect(res.body.field).toBe(field);
  });

  it('uploads, serves and removes a profile picture', async () => {
    const maya = await t.signup('maya');
    const up = await maya.api.post('/users/me/avatar').attach('avatar', PNG, { filename: 'me.png', contentType: 'image/png' });
    expect(up.status).toBe(200);
    expect(up.body.user.avatarUrl).toMatch(/^\/uploads\/.+\.png$/);
    const served = await t.request().get(up.body.user.avatarUrl);
    expect(served.status).toBe(200);
    const del = await maya.api.delete('/users/me/avatar');
    expect(del.body.user.avatarUrl).toBeNull();
  });

  it('rejects non-image avatars and unsupported files', async () => {
    const maya = await t.signup('maya');
    const noFile = await maya.api.post('/users/me/avatar');
    expect(noFile.status).toBe(400);
    const video = await maya.api.post('/users/me/avatar').attach('avatar', Buffer.from('fake'), { filename: 'a.mp4', contentType: 'video/mp4' });
    expect(video.status).toBe(400);
    const txt = await maya.api.post('/users/me/avatar').attach('avatar', Buffer.from('hi'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(txt.status).toBe(400);
  });

  it('shows another user profile with counts and relationship', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    await leo.api.post('/users/maya/follow');
    const res = await leo.api.get('/users/maya');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      isMe: false,
      canView: true,
      counts: { followers: 1, following: 0, highlights: 0 },
      relationship: { following: 'accepted', followsYou: false },
    });
    expect(res.body.user.email).toBeUndefined();
    const self = await maya.api.get('/users/maya');
    expect(self.body.isMe).toBe(true);
  });

  it('404s for unknown users', async () => {
    const maya = await t.signup('maya');
    expect((await maya.api.get('/users/ghost')).status).toBe(404);
  });

  it('searches by username or display name', async () => {
    const maya = await t.signup('maya', { displayName: 'Maya Chen' });
    await t.signup('mayberry');
    await t.signup('leo', { displayName: 'Leo Chen' });
    const byPrefix = await maya.api.get('/users/search?q=may');
    expect(byPrefix.body.users.map((u) => u.username)).toEqual(['maya', 'mayberry']);
    const byName = await maya.api.get('/users/search?q=chen');
    expect(byName.body.users.map((u) => u.username).sort()).toEqual(['leo', 'maya']);
    expect((await maya.api.get('/users/search?q=')).body.users).toEqual([]);
  });

  it('reports activity status only when both users share it', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    await maya.api.get('/auth/me');
    const shown = await leo.api.get('/users/maya');
    expect(shown.body.lastActiveAt).toBeTypeOf('number');
    await leo.api.patch('/settings').send({ privacy: { showActivityStatus: false } });
    expect((await leo.api.get('/users/maya')).body.lastActiveAt).toBeNull();
  });
});

describe('following', () => {
  it('follows and unfollows public accounts instantly', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    expect((await leo.api.post('/users/maya/follow')).body.following).toBe('accepted');
    expect((await leo.api.post('/users/maya/follow')).body.following).toBe('accepted');
    const followers = await leo.api.get('/users/maya/followers');
    expect(followers.body.users.map((u) => u.username)).toEqual(['leo']);
    const following = await maya.api.get('/users/leo/following');
    expect(following.body.users.map((u) => u.username)).toEqual(['maya']);
    await leo.api.delete('/users/maya/follow');
    expect((await leo.api.get('/users/maya')).body.relationship.following).toBe('none');
  });

  it("can't follow yourself", async () => {
    const maya = await t.signup('maya');
    expect((await maya.api.post('/users/maya/follow')).status).toBe(400);
  });

  it('private accounts require approval', async () => {
    const sam = await t.signup('sam');
    await sam.api.patch('/settings').send({ privacy: { privateAccount: true } });
    const leo = await t.signup('leo');
    const req = await leo.api.post('/users/sam/follow');
    expect(req.body.following).toBe('pending');
    expect((await leo.api.get('/users/sam')).body.canView).toBe(false);
    expect((await leo.api.get('/users/sam/followers')).status).toBe(403);

    const requests = await sam.api.get('/users/me/requests');
    expect(requests.body.requests.map((r) => r.user.username)).toEqual(['leo']);
    await sam.api.post(`/users/me/requests/${requests.body.requests[0].user.id}/accept`);
    const after = await leo.api.get('/users/sam');
    expect(after.body.canView).toBe(true);
    expect(after.body.relationship.following).toBe('accepted');
  });

  it('declining a request removes it; unknown actions and requests fail', async () => {
    const sam = await t.signup('sam');
    await sam.api.patch('/settings').send({ privacy: { privateAccount: true } });
    const leo = await t.signup('leo');
    await leo.api.post('/users/sam/follow');
    expect((await sam.api.post(`/users/me/requests/${leo.user.id}/maybe`)).status).toBe(400);
    expect((await sam.api.post(`/users/me/requests/${leo.user.id}/decline`)).status).toBe(200);
    expect((await sam.api.post(`/users/me/requests/${leo.user.id}/accept`)).status).toBe(404);
    expect((await leo.api.get('/users/sam')).body.relationship.following).toBe('none');
  });

  it('switching to public auto-approves pending requests', async () => {
    const sam = await t.signup('sam');
    await sam.api.patch('/settings').send({ privacy: { privateAccount: true } });
    const leo = await t.signup('leo');
    await leo.api.post('/users/sam/follow');
    await sam.api.patch('/settings').send({ privacy: { privateAccount: false } });
    expect((await leo.api.get('/users/sam')).body.relationship.following).toBe('accepted');
  });

  it('can remove a follower', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    await leo.api.post('/users/maya/follow');
    await maya.api.delete('/users/leo/follower');
    expect((await leo.api.get('/users/maya')).body.relationship.following).toBe('none');
  });
});

describe('block, mute, not interested', () => {
  it('blocking removes follows both ways and hides the blocker', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    await leo.api.post('/users/maya/follow');
    await maya.api.post('/users/leo/follow');
    expect((await maya.api.post('/users/leo/block')).body.blocked).toBe(true);
    expect((await leo.api.get('/users/maya')).status).toBe(404);
    expect((await leo.api.post('/users/maya/follow')).status).toBe(403);
    expect((await leo.api.get('/users/search?q=maya')).body.users).toEqual([]);
    const me = await maya.api.get('/users/leo');
    expect(me.body.relationship.blocked).toBe(true);
    expect(me.body.counts.followers).toBe(0);
    expect((await maya.api.get('/users/me/blocked')).body.users.map((u) => u.username)).toEqual(['leo']);
    await maya.api.delete('/users/leo/block');
    expect((await leo.api.get('/users/maya')).status).toBe(200);
  });

  it('mute and not-interested are listed and reversible', async () => {
    const maya = await t.signup('maya');
    await t.signup('leo');
    await maya.api.post('/users/leo/mute');
    await maya.api.post('/users/leo/not-interested');
    expect((await maya.api.get('/users/me/muted')).body.users).toHaveLength(1);
    expect((await maya.api.get('/users/me/not-interested')).body.users).toHaveLength(1);
    const rel = (await maya.api.get('/users/leo')).body.relationship;
    expect(rel).toMatchObject({ muted: true, notInterested: true });
    await maya.api.delete('/users/leo/mute');
    await maya.api.delete('/users/leo/not-interested');
    expect((await maya.api.get('/users/me/muted')).body.users).toHaveLength(0);
    expect((await maya.api.post('/users/maya/mute')).status).toBe(400);
  });

  it('following someone clears "not interested"', async () => {
    const maya = await t.signup('maya');
    await t.signup('leo');
    await maya.api.post('/users/leo/not-interested');
    await maya.api.post('/users/leo/follow');
    expect((await maya.api.get('/users/me/not-interested')).body.users).toHaveLength(0);
  });
});

describe('account deletion', () => {
  it('requires the password and removes all the user data', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    await leo.api.post('/users/maya/follow');
    const story = await t.postStory(maya);
    await leo.api.post(`/stories/${story.id}/like`);
    await maya.api.post('/highlights').send({ title: 'x', storyIds: [story.id] });

    expect((await maya.api.delete('/users/me').send({ password: 'wrong' })).status).toBe(403);
    expect((await maya.api.delete('/users/me').send({ password: 'password1' })).status).toBe(200);
    expect(t.db.all('stories')).toHaveLength(0);
    expect(t.db.all('highlights')).toHaveLength(0);
    expect(t.db.all('follows')).toHaveLength(0);
    expect(t.db.all('likes')).toHaveLength(0);
    expect(t.db.find('users', (u) => u.username === 'maya')).toBeNull();
    expect((await maya.api.get('/auth/me')).status).toBe(401);
  });
});
