// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StoryViewer from '../../client/src/components/StoryViewer.jsx';
import { buildQueue } from '../../client/src/lib/player.js';
import { calls, fail, me, mockApi, renderApp } from './utils.jsx';

const author = (id) => ({ id, username: id, displayName: id, avatarUrl: null });
const s = (id, authorId, extra = {}) => ({
  id,
  type: 'text',
  text: `story ${id}`,
  background: '#000',
  author: author(authorId),
  createdAt: Date.now() - 60_000,
  likedByMe: false,
  likesEnabled: true,
  repliesSetting: 'everyone',
  ...extra,
});

const feed = {
  me: { author: me, stories: [s('m1', 'me', { viewCount: 3 })] },
  friends: [
    { author: author('alice'), stories: [s('a1', 'alice'), s('a2', 'alice')], startIndex: 0, hasUnseen: true },
    { author: author('bob'), stories: [s('b1', 'bob')], startIndex: 0, hasUnseen: true },
  ],
  discover: [
    { author: author('zoe'), stories: [s('z1', 'zoe')], startIndex: 0, hasUnseen: true, reasons: ["Because you're into #travel"] },
  ],
};

const viewerStoryId = () => screen.getByTestId('story-viewer').dataset.storyId;
const tapNext = () => fireEvent.click(screen.getByRole('button', { name: 'Next story' }));
const tapPrev = () => fireEvent.click(screen.getByRole('button', { name: 'Previous story' }));

async function renderViewer(props = {}, routes = {}) {
  const fetchMock = mockApi(routes);
  const onClose = vi.fn();
  const onSeen = vi.fn();
  renderApp(
    <StoryViewer initialQueue={buildQueue(feed, props.start ? { start: props.start } : {})} onClose={onClose} onSeen={onSeen} {...props} />,
  );
  await waitFor(() => expect(calls(fetchMock, 'GET', /auth\/me/)).toHaveLength(1));
  return { fetchMock, onClose, onSeen };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe('StoryViewer tap-through', () => {
  it('shows the first friend story with progress segments', async () => {
    await renderViewer();
    expect(viewerStoryId()).toBe('a1');
    expect(screen.getByText('story a1')).toBeInTheDocument();
    expect(screen.getAllByTestId('progress-fill')).toHaveLength(2);
    expect(screen.getByText('alice')).toBeInTheDocument();
  });

  it('taps right to go forward and left to go back across friends', async () => {
    await renderViewer();
    tapNext();
    expect(viewerStoryId()).toBe('a2');
    tapNext();
    expect(viewerStoryId()).toBe('b1');
    tapPrev();
    expect(viewerStoryId()).toBe('a2');
  });

  it('after friends, shows a caught-up card and then For You creators', async () => {
    await renderViewer();
    tapNext();
    tapNext();
    tapNext();
    expect(screen.getByTestId('caught-up')).toBeInTheDocument();
    expect(screen.getByText("You're all caught up")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Discover new creators' }));
    expect(viewerStoryId()).toBe('z1');
    expect(screen.getByTestId('story-viewer').dataset.kind).toBe('discover');
    expect(screen.getByTestId('for-you-chip')).toBeInTheDocument();
    expect(screen.getByTestId('reason')).toHaveTextContent("Because you're into #travel");
  });

  it('records views with completion and source when leaving a story', async () => {
    const { fetchMock, onSeen } = await renderViewer({ start: 'discover' });
    tapNext();
    await waitFor(() => expect(calls(fetchMock, 'POST', /stories\/z1\/view/)).toHaveLength(1));
    const [, init] = calls(fetchMock, 'POST', /stories\/z1\/view/)[0];
    const body = JSON.parse(init.body);
    expect(body.source).toBe('discover');
    expect(body.completion).toBeLessThan(0.3);
    expect(onSeen).toHaveBeenCalledWith('z1');
  });

  it('closes via the close button and Escape', async () => {
    const { onClose } = await renderViewer();
    fireEvent.click(screen.getByRole('button', { name: 'Close stories' }));
    expect(onClose).toHaveBeenCalledWith('closed');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('supports arrow keys', async () => {
    await renderViewer();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(viewerStoryId()).toBe('a2');
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(viewerStoryId()).toBe('a1');
  });

  it('asks for more recommendations at the end, then closes when there are none', async () => {
    const loadMore = vi.fn(async () => ({ groups: [], hasMore: false }));
    const { onClose } = await renderViewer({ start: 'discover', loadMore });
    tapNext();
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('end'));
    expect(loadMore).toHaveBeenCalledWith(['zoe']);
  });

  it('continues into newly loaded recommendations', async () => {
    const more = { author: author('kai'), stories: [s('k1', 'kai')], startIndex: 0, hasUnseen: true, reasons: [] };
    const loadMore = vi.fn(async () => ({ groups: [more], hasMore: false }));
    await renderViewer({ start: 'discover', loadMore });
    await waitFor(() => expect(loadMore).toHaveBeenCalled());
    tapNext();
    await waitFor(() => expect(viewerStoryId()).toBe('k1'));
  });
});

describe('StoryViewer playback', () => {
  it('auto-advances after the story duration', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await renderViewer();
    await act(async () => vi.advanceTimersByTime(5200));
    expect(viewerStoryId()).toBe('a2');
  });

  it('does not advance while paused', async () => {
    await renderViewer();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    await act(async () => vi.advanceTimersByTime(8000));
    expect(viewerStoryId()).toBe('a1');
    expect(screen.getByTestId('story-viewer').dataset.paused).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await act(async () => vi.advanceTimersByTime(5200));
    expect(viewerStoryId()).toBe('a2');
  });

  it('pauses while typing a reply', async () => {
    await renderViewer();
    fireEvent.focus(screen.getByLabelText('Reply to story'));
    expect(screen.getByTestId('story-viewer').dataset.paused).toBe('true');
  });
});

describe('StoryViewer interactions', () => {
  it('likes a story', async () => {
    const { fetchMock } = await renderViewer();
    fireEvent.click(screen.getByRole('button', { name: 'Like story' }));
    expect(screen.getByRole('button', { name: 'Unlike story' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(calls(fetchMock, 'POST', /stories\/a1\/like/)).toHaveLength(1));
  });

  it('reverts a like that fails', async () => {
    await renderViewer({}, { 'POST /stories/:id/like': fail(403, 'Likes are turned off for this story') });
    fireEvent.click(screen.getByRole('button', { name: 'Like story' }));
    expect(await screen.findByText('Likes are turned off for this story')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Like story' })).toBeInTheDocument();
  });

  it('sends a reply', async () => {
    const { fetchMock } = await renderViewer();
    const input = screen.getByLabelText('Reply to story');
    fireEvent.change(input, { target: { value: 'So cool!' } });
    fireEvent.submit(input.closest('form'));
    expect(await screen.findByText('Reply sent')).toBeInTheDocument();
    const [, init] = calls(fetchMock, 'POST', /stories\/a1\/reply/)[0];
    expect(JSON.parse(init.body)).toEqual({ text: 'So cool!' });
  });

  it('hides reply box when the creator turned replies off', async () => {
    const f = structuredClone(feed);
    f.friends[0].stories[0].repliesSetting = 'off';
    mockApi();
    renderApp(<StoryViewer initialQueue={buildQueue(f)} onClose={() => {}} />);
    expect(screen.getByText('Replies are off')).toBeInTheDocument();
    expect(screen.queryByLabelText('Reply to story')).not.toBeInTheDocument();
  });

  it('follows a For You creator from their story', async () => {
    const { fetchMock } = await renderViewer({ start: 'discover' }, { 'POST /users/:u/follow': { following: 'accepted' } });
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
    expect(await screen.findByText('Following zoe')).toBeInTheDocument();
    expect(calls(fetchMock, 'POST', /users\/zoe\/follow/)).toHaveLength(1);
  });

  it('"Not interested" hides the creator and skips ahead', async () => {
    const { fetchMock, onClose } = await renderViewer({ start: 'discover' });
    fireEvent.click(screen.getByRole('button', { name: 'More options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Not interested' }));
    await waitFor(() => expect(calls(fetchMock, 'POST', /users\/zoe\/not-interested/)).toHaveLength(1));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('end'));
  });

  it('shows insights and highlight actions on your own story', async () => {
    await renderViewer({ start: 'me' });
    expect(await screen.findByText('Your story')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3 views/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Highlight/ })).toBeInTheDocument();
    expect(screen.queryByLabelText('Reply to story')).not.toBeInTheDocument();
  });

  it('saves your story to a new highlight', async () => {
    const { fetchMock } = await renderViewer(
      { start: 'me' },
      {
        'GET /highlights/user/:u': { highlights: [] },
        'POST /highlights': ({ body }) => ({ highlight: { id: 'h1', title: body.title } }),
      },
    );
    fireEvent.click(await screen.findByRole('button', { name: /Highlight/ }));
    fireEvent.change(await screen.findByLabelText('New highlight name'), { target: { value: 'Bali' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Saved to new highlight Bali')).toBeInTheDocument();
    const [, init] = calls(fetchMock, 'POST', /\/api\/highlights$/)[0];
    expect(JSON.parse(init.body)).toEqual({ title: 'Bali', storyIds: ['m1'] });
  });
});
