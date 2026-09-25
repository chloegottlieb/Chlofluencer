import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HOUR, setup } from './helpers.js';

let t;
beforeEach(() => (t = setup()));
afterEach(() => t.cleanup());

describe('highlights', () => {
  it('creates a highlight from own stories that outlives the 24h window', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    const a = await t.postStory(maya, { text: 'a' });
    const b = await t.postStory(maya, { text: 'b' });
    const res = await maya.api.post('/highlights').send({ title: 'Bali', storyIds: [a.id, b.id, a.id] });
    expect(res.status).toBe(201);
    expect(res.body.highlight).toMatchObject({ title: 'Bali', storyCount: 2 });
    expect(res.body.highlight.cover.text).toBe('a');

    t.clock.now += 48 * HOUR;
    const list = (await leo.api.get('/highlights/user/maya')).body.highlights;
    expect(list).toHaveLength(1);
    const full = (await leo.api.get(`/highlights/${list[0].id}`)).body.highlight;
    expect(full.stories.map((s) => s.text)).toEqual(['a', 'b']);
    expect(full.stories[0].expired).toBe(true);
    // Highlighted stories can still be viewed/liked after expiry.
    expect((await leo.api.post(`/stories/${a.id}/view`).send({ source: 'highlight' })).status).toBe(200);
    expect((await leo.api.get(`/stories/${a.id}`)).status).toBe(200);
    expect((await maya.api.get('/users/maya')).body.counts.highlights).toBe(1);
  });

  it('can save expired stories from the archive', async () => {
    const maya = await t.signup('maya');
    const old = await t.postStory(maya);
    t.clock.now += 72 * HOUR;
    expect((await maya.api.post('/highlights').send({ title: 'Throwback', storyIds: [old.id] })).status).toBe(201);
  });

  it('validates title and stories', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    const mine = await t.postStory(maya);
    const theirs = await t.postStory(leo);
    expect((await maya.api.post('/highlights').send({ title: '', storyIds: [mine.id] })).body.field).toBe('title');
    expect((await maya.api.post('/highlights').send({ title: 'x'.repeat(31), storyIds: [mine.id] })).status).toBe(400);
    expect((await maya.api.post('/highlights').send({ title: 'ok', storyIds: [] })).status).toBe(400);
    expect((await maya.api.post('/highlights').send({ title: 'ok', storyIds: [theirs.id] })).status).toBe(400);
    expect((await maya.api.post('/highlights').send({ title: 'ok', storyIds: ['nope'] })).status).toBe(400);
  });

  it('renames, adds, removes, sets cover, and deletes when emptied', async () => {
    const maya = await t.signup('maya');
    const [a, b, c] = [await t.postStory(maya, { text: 'a' }), await t.postStory(maya, { text: 'b' }), await t.postStory(maya, { text: 'c' })];
    const h = (await maya.api.post('/highlights').send({ title: 'x', storyIds: [a.id] })).body.highlight;

    let res = await maya.api.patch(`/highlights/${h.id}`).send({ title: 'Trips', addStoryIds: [b.id, c.id, a.id] });
    expect(res.body.highlight.title).toBe('Trips');
    expect(res.body.highlight.stories.map((s) => s.text)).toEqual(['a', 'b', 'c']);

    res = await maya.api.patch(`/highlights/${h.id}`).send({ coverStoryId: c.id });
    expect(res.body.highlight.cover.text).toBe('c');
    expect((await maya.api.patch(`/highlights/${h.id}`).send({ coverStoryId: 'nope' })).status).toBe(400);

    res = await maya.api.patch(`/highlights/${h.id}`).send({ removeStoryIds: [c.id] });
    expect(res.body.highlight.cover.text).toBe('a');

    res = await maya.api.patch(`/highlights/${h.id}`).send({ removeStoryIds: [a.id, b.id] });
    expect(res.body).toEqual({ highlight: null, deleted: true });
    expect((await maya.api.get(`/highlights/${h.id}`)).status).toBe(404);
  });

  it('only the owner can edit or delete', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    const s = await t.postStory(maya);
    const h = (await maya.api.post('/highlights').send({ title: 'x', storyIds: [s.id] })).body.highlight;
    expect((await leo.api.patch(`/highlights/${h.id}`).send({ title: 'hacked' })).status).toBe(403);
    expect((await leo.api.delete(`/highlights/${h.id}`)).status).toBe(403);
    expect((await maya.api.delete(`/highlights/${h.id}`)).status).toBe(200);
    expect((await maya.api.delete(`/highlights/${h.id}`)).status).toBe(404);
  });

  it('hides a private account’s highlights from non-followers', async () => {
    const sam = await t.signup('sam');
    const leo = await t.signup('leo');
    const s = await t.postStory(sam);
    const h = (await sam.api.post('/highlights').send({ title: 'x', storyIds: [s.id] })).body.highlight;
    await sam.api.patch('/settings').send({ privacy: { privateAccount: true } });
    expect((await leo.api.get('/highlights/user/sam')).body.highlights).toEqual([]);
    expect((await leo.api.get(`/highlights/${h.id}`)).status).toBe(404);
    expect((await leo.api.get('/highlights/user/ghost')).status).toBe(404);
  });

  it('hides followers-only stories inside a highlight from non-followers', async () => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    const pub = await t.postStory(maya, { text: 'pub' });
    const priv = await t.postStory(maya, { text: 'priv', audience: 'followers' });
    const h = (await maya.api.post('/highlights').send({ title: 'x', storyIds: [pub.id, priv.id] })).body.highlight;
    expect((await leo.api.get(`/highlights/${h.id}`)).body.highlight.stories.map((s) => s.text)).toEqual(['pub']);
    await leo.api.post('/users/maya/follow');
    expect((await leo.api.get(`/highlights/${h.id}`)).body.highlight.stories.map((s) => s.text)).toEqual(['pub', 'priv']);
  });
});
