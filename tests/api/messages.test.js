import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setup } from './helpers.js';

let t;
beforeEach(() => (t = setup()));
afterEach(() => t.cleanup());

async function mutuals() {
  const maya = await t.signup('maya');
  const leo = await t.signup('leo');
  await maya.api.post('/users/leo/follow');
  await leo.api.post('/users/maya/follow');
  return { maya, leo };
}

describe('direct messages between mutual follows', () => {
  it('lets mutuals message each other and builds a conversation', async () => {
    const { maya, leo } = await mutuals();
    const sent = await maya.api.post('/messages/leo').send({ text: 'hey!' });
    expect(sent.status).toBe(201);
    expect(sent.body.message).toMatchObject({ text: 'hey!', fromMe: true, story: null });
    t.clock.now += 1000;
    await leo.api.post('/messages/maya').send({ text: 'hi maya' });

    const thread = await maya.api.get('/messages/leo');
    expect(thread.body).toMatchObject({ canMessage: true, reason: 'mutual', user: { username: 'leo' } });
    expect(thread.body.messages.map((m) => [m.text, m.fromMe])).toEqual([
      ['hey!', true],
      ['hi maya', false],
    ]);
  });

  it('tracks unread counts and marks messages read when the thread is opened', async () => {
    const { maya, leo } = await mutuals();
    await maya.api.post('/messages/leo').send({ text: 'one' });
    await maya.api.post('/messages/leo').send({ text: 'two' });
    expect((await leo.api.get('/messages/unread')).body.unread).toBe(2);
    const inbox = await leo.api.get('/messages');
    expect(inbox.body.unread).toBe(2);
    expect(inbox.body.conversations[0]).toMatchObject({ user: { username: 'maya' }, unread: 2, canMessage: true, lastMessage: { text: 'two', fromMe: false } });
    await leo.api.get('/messages/maya');
    expect((await leo.api.get('/messages/unread')).body.unread).toBe(0);
    // The sender's own messages never count as unread for them.
    expect((await maya.api.get('/messages/unread')).body.unread).toBe(0);
  });

  it('sorts the inbox by most recent message', async () => {
    const { maya } = await mutuals();
    const zoe = await t.signup('zoe');
    await maya.api.post('/users/zoe/follow');
    await zoe.api.post('/users/maya/follow');
    await maya.api.post('/messages/leo').send({ text: 'to leo' });
    t.clock.now += 1000;
    await maya.api.post('/messages/zoe').send({ text: 'to zoe' });
    expect((await maya.api.get('/messages')).body.conversations.map((c) => c.user.username)).toEqual(['zoe', 'leo']);
  });

  it('lists mutual follows as contacts', async () => {
    const { maya } = await mutuals();
    await t.signup('fan');
    const fan = await t.signup('stranger');
    await fan.api.post('/users/maya/follow');
    await maya.api.post('/users/fan/follow');
    expect((await maya.api.get('/messages/contacts')).body.users.map((u) => u.username)).toEqual(['leo']);
  });

  it('validates message text', async () => {
    const { maya } = await mutuals();
    expect((await maya.api.post('/messages/leo').send({ text: '  ' })).status).toBe(400);
    expect((await maya.api.post('/messages/leo').send({ text: 'x'.repeat(1001) })).status).toBe(400);
    expect((await maya.api.post('/messages/ghost').send({ text: 'hi' })).status).toBe(404);
    expect((await maya.api.post('/messages/maya').send({ text: 'hi' })).body.reason).toBe('self');
  });
});

describe('no DMs without a mutual follow', () => {
  it.each([
    ['nobody follows anybody', async () => {}],
    ['only the sender follows', async (a) => a.api.post('/users/leo/follow')],
    ['only the recipient follows', async (_a, b) => b.api.post('/users/maya/follow')],
  ])('blocks DMs when %s', async (_label, connect) => {
    const maya = await t.signup('maya');
    const leo = await t.signup('leo');
    await connect(maya, leo);
    const res = await maya.api.post('/messages/leo').send({ text: 'hi' });
    expect(res.status).toBe(403);
    expect(res.body.reason).toBe('not_mutual');
    expect((await maya.api.get('/messages/leo')).body).toMatchObject({ canMessage: false, reason: 'not_mutual', messages: [] });
    expect((await maya.api.get('/users/leo')).body.messaging.canMessage).toBe(false);
  });

  it('a pending request to a private account is not a follow', async () => {
    const maya = await t.signup('maya');
    const sam = await t.signup('sam');
    await sam.api.patch('/settings').send({ privacy: { privateAccount: true } });
    await sam.api.post('/users/maya/follow');
    await maya.api.post('/users/sam/follow');
    expect((await maya.api.post('/messages/sam').send({ text: 'hi' })).status).toBe(403);
    await sam.api.post(`/users/me/requests/${maya.user.id}/accept`);
    expect((await maya.api.post('/messages/sam').send({ text: 'hi' })).status).toBe(201);
  });

  it('an unfollow makes the conversation read-only but keeps history', async () => {
    const { maya, leo } = await mutuals();
    await maya.api.post('/messages/leo').send({ text: 'before' });
    await leo.api.delete('/users/maya/follow');
    expect((await maya.api.post('/messages/leo').send({ text: 'after' })).status).toBe(403);
    const thread = (await leo.api.get('/messages/maya')).body;
    expect(thread.canMessage).toBe(false);
    expect(thread.messages.map((m) => m.text)).toEqual(['before']);
    expect((await leo.api.get('/messages')).body.conversations[0].canMessage).toBe(false);
  });

  it('blocking hides the conversation entirely', async () => {
    const { maya, leo } = await mutuals();
    await maya.api.post('/messages/leo').send({ text: 'hi' });
    await leo.api.post('/users/maya/block');
    expect((await leo.api.get('/messages')).body.conversations).toEqual([]);
    expect((await leo.api.get('/messages/unread')).body.unread).toBe(0);
    expect((await maya.api.get('/messages/leo')).status).toBe(404);
    expect((await maya.api.post('/messages/leo').send({ text: 'hi?' })).status).toBe(403);
  });
});

describe('story replies', () => {
  it('between mutuals, a story reply lands in the DM thread with a story preview', async () => {
    const { maya, leo } = await mutuals();
    const story = await t.postStory(maya, { text: 'sunset' });
    expect((await leo.api.get(`/stories/${story.id}`)).body.story.replyMode).toBe('dm');
    const res = await leo.api.post(`/stories/${story.id}/reply`).send({ text: 'gorgeous' });
    expect(res.status).toBe(201);
    expect(res.body.delivered).toBe('dm');
    const thread = (await maya.api.get('/messages/leo')).body;
    expect(thread.messages[0]).toMatchObject({ text: 'gorgeous', fromMe: false, story: { id: story.id, available: true, text: 'sunset' } });
    // Maya can answer in the thread.
    expect((await maya.api.post('/messages/leo').send({ text: 'thank you!' })).status).toBe(201);
    // It doesn't also go to the one-way inbox.
    expect((await maya.api.get('/stories/replies')).body.replies).toEqual([]);
  });

  it('without a mutual follow, a story reply is one-way and cannot be answered', async () => {
    const maya = await t.signup('maya');
    const fan = await t.signup('fan');
    await fan.api.post('/users/maya/follow');
    const story = await t.postStory(maya);
    expect((await fan.api.get(`/stories/${story.id}`)).body.story.replyMode).toBe('reply');
    const res = await fan.api.post(`/stories/${story.id}/reply`).send({ text: 'big fan!' });
    expect(res.body.delivered).toBe('reply');
    const inbox = (await maya.api.get('/stories/replies')).body.replies;
    expect(inbox).toMatchObject([{ text: 'big fan!', from: { username: 'fan' }, canMessage: false }]);
    expect((await maya.api.post('/messages/fan').send({ text: 'thanks' })).status).toBe(403);
    expect((await maya.api.get('/messages')).body.conversations).toEqual([]);
  });

  it('shows a story as unavailable in the thread once it expires', async () => {
    const { maya, leo } = await mutuals();
    const story = await t.postStory(maya);
    await leo.api.post(`/stories/${story.id}/reply`).send({ text: 'nice' });
    t.clock.now += 25 * 3600_000;
    const leoThread = (await leo.api.get('/messages/maya')).body;
    expect(leoThread.messages[0].story).toEqual({ id: story.id, available: false });
    // The author can still see their own story.
    expect((await maya.api.get('/messages/leo')).body.messages[0].story.available).toBe(true);
  });

  it('the story reply setting still applies to mutuals', async () => {
    const { maya, leo } = await mutuals();
    await maya.api.patch('/settings').send({ privacy: { storyReplies: 'off' } });
    const story = await t.postStory(maya);
    expect((await leo.api.post(`/stories/${story.id}/reply`).send({ text: 'hi' })).status).toBe(403);
    // ...but ordinary DMs still work.
    expect((await leo.api.post('/messages/maya').send({ text: 'hi' })).status).toBe(201);
  });

  it('deleting an account removes its messages', async () => {
    const { maya, leo } = await mutuals();
    await maya.api.post('/messages/leo').send({ text: 'hi' });
    await maya.api.delete('/users/me').send({ password: 'password1' });
    expect(t.db.all('messages')).toEqual([]);
    expect((await leo.api.get('/messages')).body.conversations).toEqual([]);
  });
});
