import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HOUR, PNG, T0, setup } from './helpers.js';

let t;
beforeEach(() => (t = setup()));
afterEach(() => t.cleanup());

describe('creating stories', () => {
  it('creates a text story that expires in 24h', async () => {
    const maya = await t.signup('maya');
    const res = await maya.api.post('/stories').send({
      text: 'Hello!',
      caption: 'first',
      tags: '#travel vlog',
      background: '#123456',
    });
    expect(res.status).toBe(201);
    expect(res.body.story).toMatchObject({
      type: 'text',
      text: 'Hello!',
      caption: 'first',
      tags: ['travel', 'vlog'],
      background: '#123456',
      audience: 'public',
      allowDiscovery: true,
      sensitive: false,
      createdAt: T0,
      expiresAt: T0 + 24 * HOUR,
      isOwner: true,
    });
  });

  it('creates photo and video stories via upload', async () => {
    const maya = await t.signup('maya');
    const photo = await maya.api
      .post('/stories')
      .field('caption', 'sunset')
      .attach('media', PNG, { filename: 's.png', contentType: 'image/png' });
    expect(photo.status).toBe(201);
    expect(photo.body.story.type).toBe('image');
    expect((await t.request().get(photo.body.story.mediaUrl)).status).toBe(200);

    const video = await maya.api
      .post('/stories')
      .field('durationMs', '120000')
      .attach('media', Buffer.from('not really a video'), { filename: 'v.mp4', contentType: 'video/mp4' });
    expect(video.body.story.type).toBe('video');
    expect(video.body.story.durationMs).toBe(60000);
  });

  it('rejects empty stories, long text, bad audiences and unsafe backgrounds', async () => {
    const maya = await t.signup('maya');
    expect((await maya.api.post('/stories').send({})).status).toBe(400);
    expect((await maya.api.post('/stories').send({ text: 'x'.repeat(281) })).status).toBe(400);
    expect((await maya.api.post('/stories').send({ text: 'hi', caption: 'x'.repeat(201) })).status).toBe(400);
    expect((await maya.api.post('/stories').send({ text: 'hi', audience: 'friends' })).status).toBe(400);
    const unsafe = await maya.api.post('/stories').send({ text: 'hi', background: 'url(javascript:x)' });
    expect(unsafe.body.story.background).toMatch(/^linear-gradient/);
  });

  it('followers-only stories are never discoverable', async () => {
    const maya = await t.signup('maya');
    const s = await t.postStory(maya, { audience: 'followers', allowDiscovery: 'true' });
    expect(s.allowDiscovery).toBe(false);
  });

  it('uses the default audience from settings', async () => {
    const maya = await t.signup('maya');
    await maya.api.patch('/settings').send({ stories: { defaultAudience: 'followers' } });
    expect((await t.postStory(maya)).audience).toBe('followers');
  });
});

describe('viewing stories', () => {
  it('lists my active stories and full archive', async () => {
    const maya = await t.signup('maya');
    await t.postStory(maya, { text: 'old' });
    t.clock.now += 25 * HOUR;
    await t.postStory(maya, { text: 'new' });
    const mine = await maya.api.get('/stories/mine');
    expect(mine.body.stories.map((s) => s.text)).toEqual(['new']);
    const archive = await maya.api.get('/stories/archive');
    expect(archive.body.stories.map((s) => [s.text, s.expired])).toEqual([['new', false], ['old', true]]);
  });

  it('lists another user’s active stories respecting audience', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    await t.postStory(maya, { text: 'public' });
    await t.postStory(maya, { text: 'friends', audience: 'followers' });
    expect((await leo.api.get('/users/maya/stories')).body.stories.map((s) => s.text)).toEqual(['public']);
    await leo.api.post('/users/maya/follow');
    expect((await leo.api.get('/users/maya/stories')).body.stories.map((s) => s.text)).toEqual(['public', 'friends']);
  });

  it('hides expired stories from others', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    const s = await t.postStory(maya);
    expect((await leo.api.get(`/stories/${s.id}`)).status).toBe(200);
    t.clock.now += 24 * HOUR;
    expect((await leo.api.get(`/stories/${s.id}`)).status).toBe(404);
    expect((await maya.api.get(`/stories/${s.id}`)).status).toBe(200);
  });

  it('records views with max completion and exposes insights to the owner only', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    const zoe = await t.signup('zoe');
    const s = await t.postStory(maya);
    await leo.api.post(`/stories/${s.id}/view`).send({ completion: 0.4, source: 'discover' });
    await leo.api.post(`/stories/${s.id}/view`).send({ completion: 1 });
    await leo.api.post(`/stories/${s.id}/view`).send({ completion: 0.2 });
    await zoe.api.post(`/stories/${s.id}/view`).send({ completion: 'abc' });
    await maya.api.post(`/stories/${s.id}/view`);
    await zoe.api.post(`/stories/${s.id}/like`);

    const views = t.db.filter('views', (v) => v.storyId === s.id);
    expect(views).toHaveLength(2);
    expect(views.find((v) => v.viewerId === leo.user.id)).toMatchObject({ completion: 1, source: 'discover' });

    const insights = await maya.api.get(`/stories/${s.id}/viewers`);
    expect(insights.body).toMatchObject({ total: 2, discoverViews: 1, likes: 1 });
    expect((await leo.api.get(`/stories/${s.id}/viewers`)).status).toBe(403);
    expect((await leo.api.get(`/stories/${s.id}`)).body.story.seenByMe).toBe(true);
  });

  it('hides view counts from others when the owner turns them off', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    const s = await t.postStory(maya);
    expect((await leo.api.get(`/stories/${s.id}`)).body.story.viewCount).toBe(0);
    await maya.api.patch('/settings').send({ privacy: { showViewCounts: false } });
    expect((await leo.api.get(`/stories/${s.id}`)).body.story.viewCount).toBeUndefined();
    expect((await maya.api.get(`/stories/${s.id}`)).body.story.viewCount).toBe(0);
  });

  it('private account stories are only visible to approved followers', async () => {
    const sam = await t.signup('sam');
    await sam.api.patch('/settings').send({ privacy: { privateAccount: true } });
    const leo = await t.signup('leo');
    const s = await t.postStory(sam);
    expect((await leo.api.get(`/stories/${s.id}`)).status).toBe(404);
    expect((await leo.api.post(`/stories/${s.id}/view`)).status).toBe(404);
  });
});

describe('likes and replies', () => {
  it('likes and unlikes, notifying the author once', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    const s = await t.postStory(maya);
    expect((await leo.api.post(`/stories/${s.id}/like`)).body.liked).toBe(true);
    await leo.api.post(`/stories/${s.id}/like`);
    expect((await leo.api.get(`/stories/${s.id}`)).body.story).toMatchObject({ likedByMe: true, likeCount: 1 });
    expect(t.db.filter('notifications', (n) => n.type === 'like')).toHaveLength(1);
    expect((await leo.api.delete(`/stories/${s.id}/like`)).body.liked).toBe(false);
    expect((await leo.api.get(`/stories/${s.id}`)).body.story.likedByMe).toBe(false);
  });

  it('respects the allowLikes setting', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    await maya.api.patch('/settings').send({ stories: { allowLikes: false } });
    const s = await t.postStory(maya);
    expect((await leo.api.post(`/stories/${s.id}/like`)).status).toBe(403);
  });

  it('sends replies to the author inbox', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    const s = await t.postStory(maya);
    const r = await leo.api.post(`/stories/${s.id}/reply`).send({ text: 'Love this!' });
    expect(r.status).toBe(201);
    const inbox = await maya.api.get('/stories/replies');
    expect(inbox.body.replies).toMatchObject([{ text: 'Love this!', from: { username: 'leo' }, storyId: s.id }]);
  });

  it('validates replies and blocks replying to yourself', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    const s = await t.postStory(maya);
    expect((await leo.api.post(`/stories/${s.id}/reply`).send({ text: '  ' })).status).toBe(400);
    expect((await leo.api.post(`/stories/${s.id}/reply`).send({ text: 'x'.repeat(501) })).status).toBe(400);
    expect((await maya.api.post(`/stories/${s.id}/reply`).send({ text: 'hi' })).status).toBe(400);
  });

  it('enforces the story reply setting', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    const s = await t.postStory(maya);
    await maya.api.patch('/settings').send({ privacy: { storyReplies: 'off' } });
    expect((await leo.api.post(`/stories/${s.id}/reply`).send({ text: 'hi' })).status).toBe(403);
    await maya.api.patch('/settings').send({ privacy: { storyReplies: 'following' } });
    expect((await leo.api.post(`/stories/${s.id}/reply`).send({ text: 'hi' })).status).toBe(403);
    await maya.api.post('/users/leo/follow');
    expect((await leo.api.post(`/stories/${s.id}/reply`).send({ text: 'hi' })).status).toBe(201);
  });
});

describe('deleting stories', () => {
  it('only the author can delete, and highlights are cleaned up', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    const a = await t.postStory(maya, { text: 'a' });
    const b = await t.postStory(maya, { text: 'b' });
    const only = await t.postStory(maya, { text: 'only' });
    const h1 = (await maya.api.post('/highlights').send({ title: 'both', storyIds: [a.id, b.id] })).body.highlight;
    await maya.api.post('/highlights').send({ title: 'single', storyIds: [only.id] });

    expect((await leo.api.delete(`/stories/${a.id}`)).status).toBe(403);
    expect((await maya.api.delete(`/stories/${a.id}`)).status).toBe(200);
    expect((await maya.api.delete(`/stories/${a.id}`)).status).toBe(404);
    const after = (await maya.api.get(`/highlights/${h1.id}`)).body.highlight;
    expect(after.stories.map((s) => s.text)).toEqual(['b']);

    await maya.api.delete(`/stories/${only.id}`);
    const list = (await maya.api.get('/highlights/user/maya')).body.highlights;
    expect(list.map((h) => h.title)).toEqual(['both']);
  });
});
