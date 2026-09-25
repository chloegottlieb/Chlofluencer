// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../../client/src/App.jsx';
import Avatar from '../../client/src/components/Avatar.jsx';
import { calls, fail, me, mockApi, renderApp } from './utils.jsx';
import { render } from '@testing-library/react';

const author = (id, extra = {}) => ({ id, username: id, displayName: id.toUpperCase(), avatarUrl: null, ...extra });
const story = (id, extra = {}) => ({ id, type: 'text', text: `text ${id}`, background: '#000', createdAt: Date.now(), likesEnabled: true, repliesSetting: 'everyone', ...extra });

const feed = {
  me: { author: me, stories: [] },
  friends: [
    { author: author('alice'), stories: [story('a1')], startIndex: 0, hasUnseen: true },
    { author: author('bob'), stories: [story('b1')], startIndex: 0, hasUnseen: false },
  ],
  discover: [{ author: author('zoe'), stories: [story('z1')], startIndex: 0, hasUnseen: true, reasons: ['Trending'] }],
  discoverEnabled: true,
  discoverHasMore: false,
};

describe('Home', () => {
  it('renders the story tray with unseen/seen rings and For You cards', async () => {
    mockApi({ 'GET /feed': feed });
    renderApp(<App />);
    const rings = await screen.findAllByTestId('friend-ring');
    expect(rings).toHaveLength(2);
    expect(within(rings[0]).getByRole('button')).toHaveAttribute('data-ring', 'unseen');
    expect(within(rings[1]).getByRole('button')).toHaveAttribute('data-ring', 'seen');
    expect(screen.getByRole('button', { name: /Watch 1 friend/ })).toBeInTheDocument();
    const card = screen.getByTestId('discover-card');
    expect(card).toHaveTextContent('zoe');
    expect(card).toHaveTextContent('Trending');
  });

  it('opens the viewer at a tapped friend', async () => {
    mockApi({ 'GET /feed': feed });
    renderApp(<App />);
    const rings = await screen.findAllByTestId('friend-ring');
    fireEvent.click(within(rings[1]).getByRole('button'));
    expect(screen.getByTestId('story-viewer').dataset.storyId).toBe('b1');
  });

  it('opens For You directly from a discover card', async () => {
    mockApi({ 'GET /feed': feed });
    renderApp(<App />);
    fireEvent.click(await screen.findByTestId('discover-card'));
    expect(screen.getByTestId('story-viewer').dataset.kind).toBe('discover');
  });

  it('explains when discovery is turned off', async () => {
    mockApi({ 'GET /feed': { ...feed, discover: [], discoverEnabled: false } });
    renderApp(<App />);
    expect(await screen.findByText(/Discovery is off/)).toBeInTheDocument();
  });

  it('shows an unread badge on the activity tab', async () => {
    mockApi({ 'GET /feed': feed, 'GET /notifications': { notifications: [], unread: 3 } });
    renderApp(<App />);
    expect(await screen.findByTestId('unread-badge')).toHaveTextContent('3');
  });
});

describe('Settings', () => {
  it('toggles a setting and saves it', async () => {
    const fetchMock = mockApi({
      'PATCH /settings': ({ body }) => ({ settings: { ...me.settings, discovery: { ...me.settings.discovery, ...body.discovery } } }),
    });
    renderApp(<App />, { route: '/settings' });
    const toggle = await screen.findByRole('switch', { name: 'Discover new creators' });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(toggle).not.toBeChecked();
    expect(JSON.parse(calls(fetchMock, 'PATCH', /settings/)[0][1].body)).toEqual({ discovery: { showDiscover: false } });
  });

  it('changes select settings with the right types', async () => {
    const fetchMock = mockApi({ 'PATCH /settings': { settings: me.settings } });
    renderApp(<App />, { route: '/settings' });
    fireEvent.change(await screen.findByLabelText('Photo story duration'), { target: { value: '10' } });
    await waitFor(() => expect(calls(fetchMock, 'PATCH', /settings/)).toHaveLength(1));
    expect(JSON.parse(calls(fetchMock, 'PATCH', /settings/)[0][1].body)).toEqual({ playback: { imageDurationSec: 10 } });
  });

  it('reverts and shows an error when saving fails', async () => {
    mockApi({ 'PATCH /settings': fail(400, 'Invalid value for "privacy.privateAccount"') });
    renderApp(<App />, { route: '/settings' });
    const toggle = await screen.findByRole('switch', { name: 'Private account' });
    fireEvent.click(toggle);
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid value');
    expect(toggle).not.toBeChecked();
  });

  it('logs out', async () => {
    mockApi();
    renderApp(<App />, { route: '/settings' });
    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it('changes password and stores the new token', async () => {
    mockApi({ 'POST /settings/password': { ok: true, token: 'fresh' } });
    renderApp(<App />, { route: '/settings' });
    fireEvent.change(await screen.findByLabelText('Current password'), { target: { value: 'password1' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'password2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText(/Password changed/)).toBeInTheDocument();
    expect(localStorage.getItem('storytime_token')).toBe('fresh');
  });
});

describe('Create story', () => {
  it('requires text for a text story', async () => {
    const fetchMock = mockApi();
    renderApp(<App />, { route: '/create' });
    fireEvent.click(await screen.findByRole('button', { name: 'Share to your story' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Write something');
    expect(calls(fetchMock, 'POST', /stories/)).toHaveLength(0);
  });

  it('posts a text story as multipart form data', async () => {
    const fetchMock = mockApi({ 'POST /stories': { story: {} }, 'GET /feed': feed });
    renderApp(<App />, { route: '/create' });
    fireEvent.change(await screen.findByLabelText('Story text'), { target: { value: 'Hello world' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Background 2' }));
    fireEvent.change(screen.getByLabelText(/Tags/), { target: { value: '#travel' } });
    fireEvent.change(screen.getByLabelText('Who can see this?'), { target: { value: 'followers' } });
    expect(screen.getByRole('switch', { name: 'Show in For You' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Share to your story' }));
    await waitFor(() => expect(calls(fetchMock, 'POST', /\/api\/stories$/)).toHaveLength(1));
    const form = calls(fetchMock, 'POST', /\/api\/stories$/)[0][1].body;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('text')).toBe('Hello world');
    expect(form.get('background')).toMatch(/0072ff/);
    expect(form.get('tags')).toBe('#travel');
    expect(form.get('audience')).toBe('followers');
    expect(form.get('allowDiscovery')).toBe('false');
    expect(await screen.findAllByTestId('friend-ring')).toHaveLength(2);
  });

  it('requires a file in photo/video mode', async () => {
    mockApi();
    renderApp(<App />, { route: '/create' });
    fireEvent.click(await screen.findByRole('tab', { name: /Photo/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Share to your story' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a photo or video');
  });
});

describe('Profile', () => {
  const profile = (extra = {}) => ({
    user: author('maya', { bio: 'Travel vlogger', website: 'https://maya.example.com', interests: ['travel'] }),
    counts: { followers: 10, following: 2, highlights: 1 },
    isMe: false,
    isPrivate: false,
    canView: true,
    relationship: { following: 'none', followsYou: true, blocked: false, muted: false, notInterested: false },
    hasActiveStory: false,
    hasUnseenStory: false,
    lastActiveAt: null,
    ...extra,
  });

  it('shows bio, counts, highlights and follow back', async () => {
    const fetchMock = mockApi({
      'GET /users/:u': profile(),
      'GET /highlights/user/:u': { highlights: [{ id: 'h1', title: 'Bali', storyCount: 2, cover: { background: '#000' } }] },
      'POST /users/:u/follow': { following: 'accepted' },
    });
    renderApp(<App />, { route: '/u/maya' });
    expect(await screen.findByTestId('bio')).toHaveTextContent('Travel vlogger');
    expect(screen.getByTestId('followers-count')).toHaveTextContent('10');
    expect(screen.getByText('maya.example.com')).toBeInTheDocument();
    expect(screen.getByTestId('highlight')).toHaveTextContent('Bali');
    fireEvent.click(screen.getByRole('button', { name: 'Follow back' }));
    await waitFor(() => expect(calls(fetchMock, 'POST', /users\/maya\/follow/)).toHaveLength(1));
  });

  it('shows a private notice to non-followers', async () => {
    mockApi({ 'GET /users/:u': profile({ canView: false, isPrivate: true, relationship: { ...profile().relationship, following: 'pending' } }), 'GET /highlights/user/:u': { highlights: [] } });
    renderApp(<App />, { route: '/u/maya' });
    expect(await screen.findByText('🔒 This account is private')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Requested' })).toBeInTheDocument();
  });

  it('shows edit + archive links on your own profile', async () => {
    mockApi({ 'GET /users/:u': profile({ isMe: true }), 'GET /highlights/user/:u': { highlights: [] } });
    renderApp(<App />, { route: '/u/demo' });
    expect(await screen.findByRole('link', { name: 'Edit profile' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New highlight' })).toBeInTheDocument();
  });

  it('blocks from the options menu', async () => {
    const fetchMock = mockApi({ 'GET /users/:u': profile(), 'GET /highlights/user/:u': { highlights: [] } });
    renderApp(<App />, { route: '/u/maya' });
    fireEvent.click(await screen.findByRole('button', { name: 'Profile options' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Block' }));
    await waitFor(() => expect(calls(fetchMock, 'POST', /users\/maya\/block/)).toHaveLength(1));
  });

  it('shows not found errors', async () => {
    mockApi({ 'GET /users/:u': fail(404, 'User not found'), 'GET /highlights/user/:u': fail(404, 'User not found') });
    renderApp(<App />, { route: '/u/ghost' });
    expect(await screen.findByText('User not found')).toBeInTheDocument();
  });
});

describe('Edit profile', () => {
  it('saves name, bio and interests', async () => {
    const fetchMock = mockApi({
      'PATCH /users/me': ({ body }) => ({ user: { ...me, ...body } }),
      'GET /users/:u': { user: me, counts: { followers: 0, following: 0, highlights: 0 }, isMe: true, canView: true, relationship: {}, hasActiveStory: false },
      'GET /highlights/user/:u': { highlights: [] },
    });
    renderApp(<App />, { route: '/edit-profile' });
    fireEvent.change(await screen.findByLabelText('Bio'), { target: { value: 'New bio!' } });
    expect(screen.getByText('8/150')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '#food' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls(fetchMock, 'PATCH', /users\/me/)).toHaveLength(1));
    expect(JSON.parse(calls(fetchMock, 'PATCH', /users\/me/)[0][1].body)).toMatchObject({ bio: 'New bio!', interests: ['travel', 'food'] });
  });
});

describe('Activity', () => {
  it('lists notifications, replies and follow requests', async () => {
    const fetchMock = mockApi({
      'GET /notifications': { notifications: [{ id: 'n1', type: 'like', actor: author('leo'), createdAt: Date.now(), read: false }], unread: 1 },
      'GET /stories/replies': { replies: [{ id: 'r1', text: 'nice!', from: author('zoe'), createdAt: Date.now() }] },
      'GET /users/me/requests': { requests: [{ user: author('sam'), createdAt: Date.now() }] },
    });
    renderApp(<App />, { route: '/activity' });
    expect(await screen.findByText(/liked your story/)).toBeInTheDocument();
    await waitFor(() => expect(calls(fetchMock, 'POST', /notifications\/read/)).toHaveLength(1));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(calls(fetchMock, 'POST', /requests\/sam\/accept/)).toHaveLength(1));
    fireEvent.click(screen.getByRole('tab', { name: /Story replies/ }));
    expect(screen.getByText('nice!')).toBeInTheDocument();
  });
});

describe('Avatar', () => {
  it('shows initials without a picture, and the image with one', () => {
    const { rerender } = render(<Avatar user={{ username: 'maya', displayName: 'Maya Chen' }} />);
    expect(screen.getByLabelText("maya's profile picture")).toHaveTextContent('MC');
    rerender(<Avatar user={{ username: 'maya', avatarUrl: '/uploads/a.png' }} ring="unseen" onClick={vi.fn()} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', '/uploads/a.png');
    expect(screen.getByRole('button')).toHaveAttribute('data-ring', 'unseen');
  });
});

describe('Create story with the camera', () => {
  it('offers both the in-app camera and the camera roll', async () => {
    mockApi();
    renderApp(<App />, { route: '/create' });
    fireEvent.click(await screen.findByRole('tab', { name: /Photo/ }));
    expect(screen.getByRole('button', { name: /Open camera/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Choose from camera roll/ })).toBeInTheDocument();
    // No camera API in jsdom: the camera explains why and offers the camera roll instead.
    fireEvent.click(screen.getByRole('button', { name: /Open camera/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('https://');
  });
});
