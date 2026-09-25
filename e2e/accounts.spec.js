// Implements features/accounts.feature
import { expect, test } from '@playwright/test';
import { apiSignup, openAs, uniqueName } from './helpers.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

test.describe('Feature: Accounts and profiles', () => {
  test('Sign up with interests', async ({ page }) => {
    const username = uniqueName('new');
    await page.goto('/signup');
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Email').fill(`${username}@example.com`);
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: '#travel' }).click();
    await page.getByRole('button', { name: '#food' }).click();
    await expect(page.getByRole('button', { name: 'Sign up' })).toBeDisabled();
    await page.getByRole('checkbox', { name: /agree to the Terms/ }).check();
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page.getByText('Your story')).toBeVisible();
    await page.getByRole('link', { name: 'Profile' }).click();
    await expect(page.getByRole('heading', { name: username })).toBeVisible();
    await expect(page.locator('.bio').getByText('#travel')).toBeVisible();
    await expect(page.locator('.bio').getByText('#food')).toBeVisible();
  });

  test('Log in with the demo account', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Username or email').fill('demo');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Log in' }).click();
    const tray = page.getByRole('region', { name: 'Stories' });
    for (const friend of ['maya.travels', 'leo.lifts', 'priya.cooks']) {
      await expect(tray.getByText(friend)).toBeVisible();
    }
    await expect(page.getByRole('heading', { name: 'For You' })).toBeVisible();
    await expect(page.getByTestId('discover-card').first()).toBeVisible();
  });

  test('Log in with a wrong password', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Username or email').fill('demo');
    await page.getByLabel('Password').fill('wrong-password1');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('alert')).toHaveText('Incorrect username or password');
  });

  test('Edit my profile picture and bio', async ({ page, request }) => {
    const me = await apiSignup(request, 'bio');
    await openAs(page, me.token, '/edit-profile');
    await page.getByLabel('Upload profile picture').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByText('Profile picture updated')).toBeVisible();
    await page.getByLabel('Bio').fill('Vlogging my life one story at a time');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('bio')).toHaveText('Vlogging my life one story at a time');
    await expect(page.locator('.profile-head img')).toHaveAttribute('src', /\/uploads\/.+\.png/);
  });

  test('Bio length is limited', async ({ page, request }) => {
    const me = await apiSignup(request, 'long');
    await openAs(page, me.token, '/edit-profile');
    await page.getByLabel('Bio').fill('x'.repeat(151));
    await expect(page.getByText('151/150')).toBeVisible();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByRole('alert')).toHaveText('Bio must be 150 characters or fewer');
  });
});
