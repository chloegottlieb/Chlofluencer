// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../../client/src/App.jsx';
import { calls, fail, me, mockApi, renderApp } from './utils.jsx';

const emptyFeed = { me: { author: me, stories: [] }, friends: [], discover: [], discoverEnabled: true, discoverHasMore: false };

describe('auth gate', () => {
  it('shows the login screen when logged out', async () => {
    mockApi();
    renderApp(<App />, { loggedIn: false });
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
  });

  it('shows home when a saved session is valid', async () => {
    mockApi({ 'GET /feed': emptyFeed });
    renderApp(<App />);
    expect(await screen.findByText('Your story')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
  });

  it('drops an expired session and returns to login', async () => {
    mockApi({ 'GET /auth/me': fail(401, 'Session expired') });
    renderApp(<App />);
    expect(await screen.findByRole('button', { name: 'Log in' })).toBeInTheDocument();
    expect(localStorage.getItem('cf_token')).toBeNull();
  });
});

describe('Login page', () => {
  it('logs in and stores the token', async () => {
    const fetchMock = mockApi({ 'POST /auth/login': { token: 'abc', user: me }, 'GET /feed': emptyFeed });
    renderApp(<App />, { loggedIn: false });
    fireEvent.change(await screen.findByLabelText('Username or email'), { target: { value: 'demo' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Your story')).toBeInTheDocument();
    expect(localStorage.getItem('cf_token')).toBe('abc');
    expect(JSON.parse(calls(fetchMock, 'POST', /auth\/login/)[0][1].body)).toEqual({ login: 'demo', password: 'password123' });
  });

  it('shows the server error for bad credentials', async () => {
    mockApi({ 'POST /auth/login': fail(401, 'Incorrect username or password') });
    renderApp(<App />, { loggedIn: false });
    fireEvent.change(await screen.findByLabelText('Username or email'), { target: { value: 'demo' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password');
  });
});

describe('Signup page', () => {
  it('signs up with selected interests', async () => {
    const fetchMock = mockApi({ 'POST /auth/signup': { token: 't', user: me }, 'GET /feed': emptyFeed });
    renderApp(<App />, { route: '/signup', loggedIn: false });
    fireEvent.change(await screen.findByLabelText('Username'), { target: { value: 'newbie' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'n@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password1' } });
    fireEvent.click(screen.getByRole('button', { name: '#travel' }));
    fireEvent.click(screen.getByRole('button', { name: '#music' }));
    fireEvent.click(screen.getByRole('button', { name: '#music' }));
    expect(screen.getByRole('button', { name: '#travel' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    await waitFor(() => expect(calls(fetchMock, 'POST', /auth\/signup/)).toHaveLength(1));
    const body = JSON.parse(calls(fetchMock, 'POST', /auth\/signup/)[0][1].body);
    expect(body).toMatchObject({ username: 'newbie', email: 'n@example.com', interests: ['travel'] });
  });

  it('shows validation errors from the server', async () => {
    mockApi({ 'POST /auth/signup': fail(409, 'That username is taken') });
    renderApp(<App />, { route: '/signup', loggedIn: false });
    fireEvent.change(await screen.findByLabelText('Username'), { target: { value: 'demo' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'n@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That username is taken');
  });
});
