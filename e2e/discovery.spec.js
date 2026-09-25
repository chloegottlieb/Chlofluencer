// Implements features/discovery.feature
import { expect, test } from '@playwright/test';
import { apiPostStory, apiSignup, authed, currentAuthor, openAs, viewer } from './helpers.js';

test.describe('Feature: For You discovery of new creators', () => {
  test('Follow a creator straight from their story', async ({ page, request }) => {
    const me = await apiSignup(request, 'nobody');
    await openAs(page, me.token);
    await page.getByRole('button', { name: 'Start watching' }).click();
    await expect(viewer(page)).toHaveAttribute('data-kind', 'discover');
    const creator = await currentAuthor(page);
    await page.getByRole('button', { name: 'Follow', exact: true }).click();
    await expect(page.getByText(`Following ${creator}`)).toBeVisible();
    await page.getByRole('button', { name: 'Close stories' }).click();
    await expect(page.getByTestId('friend-ring').filter({ hasText: creator })).toBeVisible();
  });

  test('"Not interested" hides a creator from For You', async ({ page, request }) => {
    const me = await apiSignup(request, 'picky');
    await openAs(page, me.token);
    await page.getByRole('button', { name: 'Start watching' }).click();
    const creator = await currentAuthor(page);
    await page.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('menuitem', { name: 'Not interested' }).click();
    await page.getByRole('button', { name: 'Close stories' }).click();
    await expect(page.getByTestId('discover-card').first()).toBeVisible();
    await expect(page.getByTestId('discover-card').filter({ hasText: creator })).toHaveCount(0);
    await page.goto('/settings');
    await page.getByText('Hidden from For You').click();
    await expect(page.getByRole('link', { name: creator })).toBeVisible();
  });

  test('Turning off discovery stops after friends', async ({ page, request }) => {
    const me = await apiSignup(request, 'nodisc');
    await openAs(page, me.token, '/settings');
    await page.getByRole('switch', { name: 'Discover new creators' }).click();
    await expect(page.getByText('Saved')).toBeVisible();
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByText(/Discovery is off/)).toBeVisible();
    await expect(page.getByTestId('discover-card')).toHaveCount(0);
  });

  test('Recommendations match my interests', async ({ page, request }) => {
    const me = await apiSignup(request, 'traveler', { interests: ['travel'] });
    await openAs(page, me.token);
    await expect(page.getByTestId('discover-card').first()).toContainText("Because you're into #travel");
  });

  test('Private accounts never appear in For You', async ({ page, request }) => {
    const priv = await apiSignup(request, 'hidden');
    await authed(request, priv.token).patch('/settings', { privacy: { privateAccount: true } });
    await apiPostStory(request, priv.token, { text: 'secret' });
    const me = await apiSignup(request, 'looker');
    await openAs(page, me.token);
    await expect(page.getByTestId('discover-card').first()).toBeVisible();
    await expect(page.getByTestId('discover-card').filter({ hasText: 'sam.private' })).toHaveCount(0);
    await expect(page.getByTestId('discover-card').filter({ hasText: priv.username })).toHaveCount(0);
  });
});
