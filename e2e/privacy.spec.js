// Implements features/privacy-and-settings.feature
import { expect, test } from '@playwright/test';
import { apiPostStory, apiSignup, authed, openAs, viewer } from './helpers.js';

test.describe('Feature: Privacy and settings', () => {
  test('Private account requires follow approval', async ({ browser, request }) => {
    const owner = await apiSignup(request, 'owner');
    const fan = await apiSignup(request, 'fan');
    const s = await apiPostStory(request, owner.token, { text: 'private moment' });
    await authed(request, owner.token).post('/highlights', { title: 'Secrets', storyIds: [s.id] });

    const ownerPage = await browser.newPage();
    await openAs(ownerPage, owner.token, '/settings');
    await ownerPage.getByRole('switch', { name: 'Private account' }).click();
    await expect(ownerPage.getByText('Saved')).toBeVisible();

    const fanPage = await browser.newPage();
    await openAs(fanPage, fan.token, `/u/${owner.username}`);
    await expect(fanPage.getByText('This account is private')).toBeVisible();
    await fanPage.getByRole('button', { name: 'Follow', exact: true }).click();
    await expect(fanPage.getByRole('button', { name: 'Requested' })).toBeVisible();

    await ownerPage.goto('/activity');
    await ownerPage.getByRole('button', { name: 'Confirm' }).click();
    await expect(ownerPage.getByRole('button', { name: 'Confirm' })).toHaveCount(0);

    await fanPage.reload();
    await expect(fanPage.getByTestId('highlight').filter({ hasText: 'Secrets' })).toBeVisible();
    await ownerPage.close();
    await fanPage.close();
  });

  test('Block a user', async ({ page, request }) => {
    const me = await apiSignup(request, 'blocker');
    const pest = await apiSignup(request, 'pest');
    await openAs(page, me.token, `/u/${pest.username}`);
    await page.getByRole('button', { name: 'Profile options' }).click();
    await page.getByRole('menuitem', { name: 'Block' }).click();
    await expect(page.getByRole('button', { name: 'Unblock' })).toBeVisible();
    const res = await authed(request, pest.token).get(`/users/${me.username}`);
    expect(res.status()).toBe(404);
    await page.goto('/settings');
    await page.getByText('Blocked accounts').click();
    await page.getByRole('button', { name: 'Unblock' }).click();
    expect((await authed(request, pest.token).get(`/users/${me.username}`)).status()).toBe(200);
  });

  test('Turn off story replies', async ({ page, request }) => {
    const creator = await apiSignup(request, 'quiet');
    const follower = await apiSignup(request, 'fol');
    await authed(request, creator.token).patch('/settings', { privacy: { storyReplies: 'off' } });
    await apiPostStory(request, creator.token, { text: 'no replies please' });
    await authed(request, follower.token).post(`/users/${creator.username}/follow`);
    await openAs(page, follower.token);
    await page.getByTestId('friend-ring').filter({ hasText: creator.username }).getByRole('button').click();
    await expect(viewer(page)).toContainText('no replies please');
    await expect(page.getByText('Replies are off')).toBeVisible();
    await expect(page.getByLabel('Reply to story')).toHaveCount(0);
  });

  test('Switch to light theme', async ({ page, request }) => {
    const me = await apiSignup(request, 'light');
    await openAs(page, me.token, '/settings');
    await page.getByLabel('Theme').selectOption('light');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('Change password', async ({ page, request }) => {
    const me = await apiSignup(request, 'pw');
    await openAs(page, me.token, '/settings');
    await page.getByLabel('Current password').fill('password123');
    await page.getByLabel('New password', { exact: true }).fill('brandnew456');
    await page.getByRole('button', { name: 'Change password' }).click();
    await expect(page.getByText(/Password changed/)).toBeVisible();
    const oldLogin = await request.post('/api/auth/login', { data: { login: me.username, password: 'password123' } });
    expect(oldLogin.status()).toBe(401);
    const newLogin = await request.post('/api/auth/login', { data: { login: me.username, password: 'brandnew456' } });
    expect(newLogin.status()).toBe(200);
  });
});
