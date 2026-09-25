// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../client/src/App.jsx';
import StoryViewer from '../../client/src/components/StoryViewer.jsx';
import { buildQueue } from '../../client/src/lib/player.js';
import { calls, fail, me, mockApi, renderApp } from './utils.jsx';

const user = (username) => ({ id: username, username, displayName: username.toUpperCase(), avatarUrl: null });
const msg = (id, text, fromMe, extra = {}) => ({ id, text, fromMe, createdAt: Date.now() - 60_000, readAt: null, story: null, ...extra });

describe('Messages inbox', () => {
  it('lists conversations with previews, unread dots and read-only state', async () => {
    mockApi({
      'GET /messages': {
        conversations: [
          { user: user('maya'), lastMessage: { text: 'see you!', fromMe: false, createdAt: Date.now(), isStoryReply: false }, unread: 2, canMessage: true },
          { user: user('leo'), lastMessage: { text: 'nice', fromMe: true, createdAt: Date.now() - 1e6, isStoryReply: true }, unread: 0, canMessage: false },
        ],
        unread: 2,
      },
    });
    renderApp(<App />, { route: '/messages' });
    const rows = await screen.findAllByTestId('conversation');
    expect(rows[0]).toHaveTextContent('maya');
    expect(rows[0]).toHaveTextContent('see you!');
    expect(screen.getByLabelText('2 unread')).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent('You replied to their story: nice');
    expect(rows[1]).toHaveTextContent('Read only');
  });

  it('explains the mutual-follow rule when empty and lists mutuals for a new message', async () => {
    mockApi({
      'GET /messages': { conversations: [], unread: 0 },
      'GET /messages/contacts': { users: [user('maya')] },
      'GET /messages/:u': { user: user('maya'), canMessage: true, reason: 'mutual', messages: [] },
    });
    renderApp(<App />, { route: '/messages' });
    expect(await screen.findByText(/follow who follows you back/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'New message' }));
    fireEvent.click(await screen.findByRole('button', { name: /maya/ }));
    expect(await screen.findByLabelText('Conversation with maya')).toBeInTheDocument();
  });

  it('says so when there is nobody to message', async () => {
    mockApi({ 'GET /messages': { conversations: [], unread: 0 }, 'GET /messages/contacts': { users: [] } });
    renderApp(<App />, { route: '/messages' });
    fireEvent.click(await screen.findByRole('button', { name: 'New message' }));
    expect(await screen.findByText(/once you both follow each other/)).toBeInTheDocument();
  });
});

describe('Conversation', () => {
  const thread = (extra = {}) => ({
    user: user('maya'),
    canMessage: true,
    reason: 'mutual',
    message: null,
    messages: [
      msg('1', 'gorgeous', true, { readAt: Date.now(), story: { id: 's1', available: true, type: 'text', text: 'sunset', background: '#000' } }),
      msg('2', 'thanks!', false),
    ],
    ...extra,
  });

  it('shows bubbles, story reply previews and seen receipts', async () => {
    mockApi({ 'GET /messages/:u': thread() });
    renderApp(<App />, { route: '/messages/maya' });
    const bubbles = await screen.findAllByTestId('message');
    expect(bubbles[0]).toHaveClass('mine');
    expect(bubbles[0]).toHaveTextContent('You replied to their story');
    expect(bubbles[0]).toHaveTextContent('Seen');
    expect(bubbles[1]).toHaveClass('theirs');
  });

  it('marks expired stories as unavailable', async () => {
    mockApi({ 'GET /messages/:u': thread({ messages: [msg('1', 'wow', false, { story: { id: 's', available: false } })] }) });
    renderApp(<App />, { route: '/messages/maya' });
    expect(await screen.findByText(/Story unavailable/)).toBeInTheDocument();
  });

  it('sends a message', async () => {
    const fetchMock = mockApi({
      'GET /messages/:u': thread(),
      'POST /messages/:u': ({ body }) => ({ message: msg('3', body.text, true) }),
    });
    renderApp(<App />, { route: '/messages/maya' });
    fireEvent.change(await screen.findByLabelText('Message'), { target: { value: 'see you tonight' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('see you tonight')).toBeInTheDocument();
    expect(JSON.parse(calls(fetchMock, 'POST', /messages\/maya/)[0][1].body)).toEqual({ text: 'see you tonight' });
    expect(screen.getByLabelText('Message')).toHaveValue('');
  });

  it('is read-only without a mutual follow', async () => {
    mockApi({
      'GET /messages/:u': thread({ canMessage: false, reason: 'not_mutual', message: 'You can message people once you both follow each other' }),
    });
    renderApp(<App />, { route: '/messages/maya' });
    expect(await screen.findByTestId('read-only')).toHaveTextContent('once you both follow each other');
    expect(screen.queryByLabelText('Message')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View profile' })).toHaveAttribute('href', '/u/maya');
  });

  it('shows an error if sending fails', async () => {
    mockApi({ 'GET /messages/:u': thread(), 'POST /messages/:u': fail(403, 'You can message people once you both follow each other') });
    renderApp(<App />, { route: '/messages/maya' });
    fireEvent.change(await screen.findByLabelText('Message'), { target: { value: 'hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('both follow each other');
  });
});

describe('entry points', () => {
  it('shows the unread DM badge on home', async () => {
    mockApi({
      'GET /feed': { me: { author: me, stories: [] }, friends: [], discover: [], discoverEnabled: true },
      'GET /messages/unread': { unread: 4 },
    });
    renderApp(<App />);
    expect(await screen.findByTestId('dm-badge')).toHaveTextContent('4');
    expect(screen.getByRole('link', { name: 'Messages, 4 unread' })).toHaveAttribute('href', '/messages');
  });

  it('shows a Message button on a mutual’s profile only', async () => {
    const profile = (canMessage) => ({
      user: user('maya'),
      counts: { followers: 1, following: 1, highlights: 0 },
      isMe: false,
      canView: true,
      relationship: { following: 'accepted', followsYou: canMessage, blocked: false, muted: false, notInterested: false },
      messaging: { canMessage },
      hasActiveStory: false,
    });
    mockApi({ 'GET /users/:u': profile(true), 'GET /highlights/user/:u': { highlights: [] } });
    const { unmount } = renderApp(<App />, { route: '/u/maya' });
    expect(await screen.findByRole('link', { name: 'Message' })).toHaveAttribute('href', '/messages/maya');
    unmount();
    mockApi({ 'GET /users/:u': profile(false), 'GET /highlights/user/:u': { highlights: [] } });
    renderApp(<App />, { route: '/u/maya' });
    await screen.findByText('MAYA');
    expect(screen.queryByRole('link', { name: 'Message' })).not.toBeInTheDocument();
  });

  it('labels one-way story replies in Activity', async () => {
    mockApi({
      'GET /stories/replies': {
        replies: [
          { id: 'r1', text: 'big fan', from: user('fan'), createdAt: Date.now(), canMessage: false },
          { id: 'r2', text: 'hey', from: user('maya'), createdAt: Date.now(), canMessage: true },
        ],
      },
      'GET /users/me/requests': { requests: [] },
    });
    renderApp(<App />, { route: '/activity' });
    fireEvent.click(await screen.findByRole('tab', { name: /Story replies/ }));
    expect(await screen.findByText(/One-way reply/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Message maya' })).toHaveAttribute('href', '/messages/maya');
  });
});

describe('story replies in the viewer', () => {
  const group = (replyMode) => ({
    friends: [{
      author: user('maya'),
      stories: [{ id: 's1', type: 'text', text: 'hi', background: '#000', author: user('maya'), createdAt: Date.now(), likesEnabled: true, repliesSetting: 'everyone', replyMode }],
      startIndex: 0,
      hasUnseen: true,
    }],
    discover: [],
  });

  it('mutuals: "Message maya…" and the reply goes to DMs', async () => {
    mockApi({ 'POST /stories/:id/reply': { delivered: 'dm' } });
    renderApp(<StoryViewer initialQueue={buildQueue(group('dm'))} onClose={() => {}} />);
    const input = screen.getByPlaceholderText('Message maya…');
    fireEvent.change(input, { target: { value: 'love it' } });
    fireEvent.submit(input.closest('form'));
    expect(await screen.findByText('Sent to your messages')).toBeInTheDocument();
  });

  it('non-mutuals: "Reply to maya…" and a one-way reply', async () => {
    mockApi({ 'POST /stories/:id/reply': { delivered: 'reply' } });
    renderApp(<StoryViewer initialQueue={buildQueue(group('reply'))} onClose={() => {}} />);
    const input = screen.getByPlaceholderText('Reply to maya…');
    fireEvent.change(input, { target: { value: 'love it' } });
    fireEvent.submit(input.closest('form'));
    await waitFor(() => expect(screen.getByText('Reply sent')).toBeInTheDocument());
  });
});
