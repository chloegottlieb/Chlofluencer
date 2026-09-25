import { Router } from 'express';
import { HttpError } from '../auth.js';
import { LIMITS } from '../lib/validation.js';
import { canViewStory, isBlockedEitherWay, newId, publicUser } from '../lib/social.js';
import { conversationId, isMutual, messagingStatus } from '../lib/messaging.js';
import { assertClean } from '../lib/contentFilter.js';

export default function messageRoutes({ db, auth, now }) {
  const router = Router();
  router.use(auth);

  const findUser = (username) => {
    const user = db.find('users', (u) => u.username === String(username).toLowerCase());
    if (!user || user.suspended) throw new HttpError(404, 'User not found');
    return user;
  };

  /** A small preview of the story a message replied to, if the viewer may still see it. */
  const storyPreview = (storyId, viewerId) => {
    if (!storyId) return null;
    const story = db.find('stories', (s) => s.id === storyId);
    const inHighlight = story && db.all('highlights').some((h) => h.storyIds.includes(story.id));
    if (!story || !canViewStory(db, viewerId, story, { now: now(), ignoreExpiry: inHighlight })) {
      return { id: storyId, available: false };
    }
    return {
      id: story.id,
      available: true,
      authorId: story.authorId,
      type: story.type,
      mediaUrl: story.mediaUrl,
      text: story.text,
      background: story.background,
    };
  };

  const shapeMessage = (m, viewerId) => ({
    id: m.id,
    text: m.text,
    fromMe: m.fromId === viewerId,
    createdAt: m.createdAt,
    readAt: m.readAt,
    story: storyPreview(m.storyId, viewerId),
  });

  // Inbox: one row per conversation, newest first.
  router.get('/', (req, res) => {
    const me = req.user.id;
    const byPartner = new Map();
    for (const m of db.all('messages')) {
      if (m.fromId !== me && m.toId !== me) continue;
      const partnerId = m.fromId === me ? m.toId : m.fromId;
      const row = byPartner.get(partnerId) ?? { last: null, unread: 0 };
      if (!row.last || m.createdAt >= row.last.createdAt) row.last = m;
      if (m.toId === me && !m.readAt) row.unread++;
      byPartner.set(partnerId, row);
    }
    const conversations = [...byPartner.entries()]
      .filter(([partnerId]) => !isBlockedEitherWay(db, me, partnerId) && !db.find('users', (u) => u.id === partnerId)?.suspended)
      .map(([partnerId, row]) => ({
        user: publicUser(db.find('users', (u) => u.id === partnerId)),
        lastMessage: { text: row.last.text, fromMe: row.last.fromId === me, createdAt: row.last.createdAt, isStoryReply: !!row.last.storyId },
        unread: row.unread,
        canMessage: isMutual(db, me, partnerId),
      }))
      .filter((c) => c.user)
      .sort((a, b) => b.lastMessage.createdAt - a.lastMessage.createdAt);
    res.json({ conversations, unread: conversations.reduce((n, c) => n + c.unread, 0) });
  });

  router.get('/unread', (req, res) => {
    const unread = db.filter(
      'messages',
      (m) => m.toId === req.user.id && !m.readAt && !isBlockedEitherWay(db, req.user.id, m.fromId),
    ).length;
    res.json({ unread });
  });

  // People you can start a conversation with: mutual follows.
  router.get('/contacts', (req, res) => {
    const me = req.user.id;
    const users = db
      .filter('follows', (f) => f.followerId === me && f.status === 'accepted')
      .map((f) => f.followeeId)
      .filter((id) => isMutual(db, me, id) && !isBlockedEitherWay(db, me, id))
      .map((id) => publicUser(db.find('users', (u) => u.id === id)))
      .filter(Boolean)
      .sort((a, b) => a.username.localeCompare(b.username));
    res.json({ users });
  });

  router.get('/:username', (req, res) => {
    const other = findUser(req.params.username);
    const me = req.user.id;
    if (isBlockedEitherWay(db, me, other.id)) throw new HttpError(404, 'Conversation not found');
    const cid = conversationId(me, other.id);
    const t = now();
    const messages = db.filter('messages', (m) => m.conversationId === cid).sort((a, b) => a.createdAt - b.createdAt);
    db.updateMany('messages', (m) => m.conversationId === cid && m.toId === me && !m.readAt, { readAt: t });
    res.json({
      user: publicUser(other),
      ...messagingStatus(db, me, other.id),
      messages: messages.map((m) => shapeMessage(m, me)),
    });
  });

  router.post('/:username', (req, res) => {
    const other = findUser(req.params.username);
    const status = messagingStatus(db, req.user.id, other.id);
    if (!status.canMessage) throw new HttpError(403, status.message, { reason: status.reason });
    const text = String(req.body?.text ?? '').trim();
    if (!text) throw new HttpError(400, 'Message cannot be empty', { field: 'text' });
    assertClean({ text });
    if (text.length > LIMITS.messageMax) {
      throw new HttpError(400, `Messages must be ${LIMITS.messageMax} characters or fewer`, { field: 'text' });
    }
    const message = db.insert('messages', {
      id: newId(),
      conversationId: conversationId(req.user.id, other.id),
      fromId: req.user.id,
      toId: other.id,
      text,
      storyId: null,
      createdAt: now(),
      readAt: null,
    });
    res.status(201).json({ message: shapeMessage(message, req.user.id) });
  });

  return router;
}
