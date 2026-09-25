import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HOUR, setup } from './helpers.js';

let t;
beforeEach(() => (t = setup()));
afterEach(() => t.cleanup());

/** demo follows maya + leo; zoe (travel) and kai (music) are strangers. */
async function world() {
  const demo = await t.signup('demo', { interests: ['travel'] });
  const maya = await t.signup('maya');
  const leo = await t.signup('leo');
  const zoe = await t.signup('zoe');
  const kai = await t.signup('kai');
  await demo.api.post('/users/maya/follow');
  await demo.api.post('/users/leo/follow');
  return { demo, maya, leo, zoe, kai };
}

describe('GET /api/feed', () => {
  it('returns my stories, friends first, then For You strangers', async () => {
    const { demo, maya, leo, zoe, kai } = await world();
    await t.postStory(demo, { text: 'mine' });
    await t.postStory(maya, { text: 'maya 1' });
    t.clock.now += HOUR;
    await t.postStory(leo, { text: 'leo 1' });
    await t.postStory(zoe, { text: 'zoe', tags: 'travel' });
    await t.postStory(kai, { text: 'kai', tags: 'music' });

    const { body } = await demo.api.get('/feed');
    expect(body.me.stories.map((s) => s.text)).toEqual(['mine']);
    expect(body.friends.map((g) => g.author.username)).toEqual(['leo', 'maya']);
    expect(body.discoverEnabled).toBe(true);
    expect(body.discover.map((g) => g.author.username)).toEqual(['zoe', 'kai']);
    expect(body.discover[0].reasons).toContain("Because you're into #travel");
  });

  it('moves fully-watched friends to the end of the tray', async () => {
    const { demo, maya, leo } = await world();
    const m = await t.postStory(maya);
    t.clock.now += HOUR;
    await t.postStory(leo);
    let feed = (await demo.api.get('/feed')).body;
    expect(feed.friends.map((g) => g.author.username)).toEqual(['leo', 'maya']);
    const leoStory = feed.friends[0].stories[0];
    await demo.api.post(`/stories/${leoStory.id}/view`).send({ completion: 1 });
    feed = (await demo.api.get('/feed')).body;
    expect(feed.friends.map((g) => [g.author.username, g.hasUnseen])).toEqual([
      ['maya', true],
      ['leo', false],
    ]);
    expect(feed.friends[0].stories[0].id).toBe(m.id);
  });

  it('drops strangers’ stories from For You once watched', async () => {
    const { demo, zoe } = await world();
    const s = await t.postStory(zoe);
    expect((await demo.api.get('/feed')).body.discover).toHaveLength(1);
    await demo.api.post(`/stories/${s.id}/view`).send({ completion: 1, source: 'discover' });
    expect((await demo.api.get('/feed')).body.discover).toHaveLength(0);
  });

  it('excludes expired, private, followers-only, opted-out, sensitive, blocked, muted and hidden creators', async () => {
    const { demo, zoe, kai } = await world();
    const users = {};
    for (const name of ['priv', 'optout', 'blocked', 'muted', 'hidden', 'blocker']) users[name] = await t.signup(name);
    await users.priv.api.patch('/settings').send({ privacy: { privateAccount: true } });
    await users.optout.api.patch('/settings').send({ discovery: { appearInDiscover: false } });
    await demo.api.post('/users/blocked/block');
    await users.blocker.api.post('/users/demo/block');
    await demo.api.post('/users/muted/mute');
    await demo.api.post('/users/hidden/not-interested');
    for (const u of Object.values(users)) await t.postStory(u);
    await t.postStory(zoe, { audience: 'followers' });
    await t.postStory(zoe, { allowDiscovery: 'false' });
    await t.postStory(kai, { sensitive: 'true' });
    const expired = await t.signup('expired');
    await t.postStory(expired);
    t.clock.now += 24 * HOUR;
    const fresh = await t.signup('fresh');
    await t.postStory(fresh);

    const feed = (await demo.api.get('/feed')).body;
    expect(feed.discover.map((g) => g.author.username)).toEqual(['fresh']);

    await demo.api.patch('/settings').send({ discovery: { hideSensitive: false } });
    t.clock.now -= 24 * HOUR;
    const withSensitive = (await demo.api.get('/feed')).body.discover.map((g) => g.author.username);
    expect(withSensitive).toContain('kai');
  });

  it('muted friends disappear from the friends tray', async () => {
    const { demo, maya } = await world();
    await t.postStory(maya);
    await demo.api.post('/users/maya/mute');
    expect((await demo.api.get('/feed')).body.friends).toHaveLength(0);
  });

  it('shows followers-only stories to followers', async () => {
    const { demo, maya } = await world();
    await t.postStory(maya, { audience: 'followers' });
    expect((await demo.api.get('/feed')).body.friends).toHaveLength(1);
  });

  it('turning off discovery ends the queue after friends', async () => {
    const { demo, zoe } = await world();
    await t.postStory(zoe);
    await demo.api.patch('/settings').send({ discovery: { showDiscover: false } });
    const feed = (await demo.api.get('/feed')).body;
    expect(feed.discoverEnabled).toBe(false);
    expect(feed.discover).toEqual([]);
    expect((await demo.api.get('/feed/discover')).body.discover).toEqual([]);
  });

  it('learns from likes: liked topics rank higher next time', async () => {
    const demo = await t.signup('demo');
    const a = await t.signup('chef');
    const b = await t.signup('coder');
    const c = await t.signup('baker');
    await t.postStory(a, { tags: 'food' });
    await t.postStory(b, { tags: 'tech' });
    const liked = await t.postStory(c, { tags: 'tech' });
    await demo.api.post(`/stories/${liked.id}/view`).send({ completion: 1, source: 'discover' });
    await demo.api.post(`/stories/${liked.id}/like`);
    const top = (await demo.api.get('/feed')).body.discover[0];
    expect(top.author.username).toBe('coder');
    expect(top.reasons[0]).toBe("Because you're into #tech");
  });

  it('paginates For You with limit and exclude', async () => {
    const demo = await t.signup('demo');
    for (let i = 0; i < 5; i++) await t.postStory(await t.signup(`creator${i}`));
    const first = (await demo.api.get('/feed?discoverLimit=2')).body;
    expect(first.discover).toHaveLength(2);
    expect(first.discoverHasMore).toBe(true);
    const seen = first.discover.map((g) => g.author.id);
    const next = (await demo.api.get(`/feed/discover?limit=10&exclude=${seen.join(',')}`)).body;
    expect(next.discover).toHaveLength(3);
    expect(next.discoverHasMore).toBe(false);
    expect(next.discover.map((g) => g.author.id)).not.toContain(seen[0]);
  });

  it('purges expired stories when archiving is off, but keeps highlighted ones', async () => {
    const maya = await t.signup('maya');
    await maya.api.patch('/settings').send({ stories: { saveToArchive: false } });
    const keep = await t.postStory(maya, { text: 'keep' });
    await t.postStory(maya, { text: 'gone' });
    await maya.api.post('/highlights').send({ title: 'fav', storyIds: [keep.id] });
    t.clock.now += 25 * HOUR;
    await maya.api.get('/feed');
    expect((await maya.api.get('/stories/archive')).body.stories.map((s) => s.text)).toEqual(['keep']);
  });

  it('keeps expired stories in the archive by default', async () => {
    const maya = await t.signup('maya');
    await t.postStory(maya);
    t.clock.now += 25 * HOUR;
    await maya.api.get('/feed');
    expect((await maya.api.get('/stories/archive')).body.stories).toHaveLength(1);
  });

  it('reset-recommendations forgets For You history and hidden creators', async () => {
    const demo = await t.signup('demo');
    const zoe = await t.signup('zoe');
    const kai = await t.signup('kai');
    const s = await t.postStory(zoe);
    await t.postStory(kai);
    await demo.api.post(`/stories/${s.id}/view`).send({ completion: 1, source: 'discover' });
    await demo.api.post('/users/kai/not-interested');
    expect((await demo.api.get('/feed')).body.discover).toHaveLength(0);
    await demo.api.post('/settings/reset-recommendations');
    expect((await demo.api.get('/feed')).body.discover).toHaveLength(2);
  });
});
