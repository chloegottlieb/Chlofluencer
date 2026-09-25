// Implements features/messages.feature
import { expect, test } from '@playwright/test';
import { apiPostStory, apiSignup, authed, openAs, viewer } from './helpers.js';

async function mutualPair(request) {
  const alex = await apiSignup(request, 'alex');
  const blair = await apiSignup(request, 'blair');
  await authed(request, alex.token).post(`/users/${blair.username}/follow`);
  await authed(request, blair.token).post(`/users/${alex.username}/follow`);
  return { alex, blair };
}

test.describe('Feature: Direct messages and story replies', () => {
  test('Mutual follows can message each other', async ({ browser, request }) => {
    const { alex, blair } = await mutualPair(request);
    const alexPage = await browser.newPage();
    await openAs(alexPage, alex.token);
    await alexPage.getByRole('link', { name: 'Messages' }).click();
    await alexPage.getByRole('button', { name: 'New message' }).click();
    await alexPage.getByRole('button', { name: new RegExp(blair.username) }).click();
    await alexPage.getByLabel('Message', { exact: true }).fill('Coffee later?');
    await alexPage.getByRole('button', { name: 'Send' }).click();
    await expect(alexPage.getByTestId('message').last()).toContainText('Coffee later?');

    const blairPage = await browser.newPage();
    await openAs(blairPage, blair.token);
    await expect(blairPage.getByTestId('dm-badge')).toHaveText('1');
    await blairPage.getByRole('link', { name: /Messages/ }).click();
    await blairPage.getByTestId('conversation').filter({ hasText: alex.username }).click();
    await expect(blairPage.getByText('Coffee later?')).toBeVisible();
    await blairPage.getByLabel('Message', { exact: true }).fill('Yes! 3pm');
    await blairPage.getByRole('button', { name: 'Send' }).click();

    // Alex's open thread refreshes on its own.
    await expect(alexPage.getByText('Yes! 3pm')).toBeVisible({ timeout: 10_000 });
    await expect(alexPage.getByTestId('message').first()).toContainText('Seen');
    await alexPage.close();
    await blairPage.close();
  });

  test('A story reply between mutuals goes to DMs', async ({ browser, request }) => {
    const { alex, blair } = await mutualPair(request);
    await apiPostStory(request, blair.token, { text: 'Hidden waterfall' });
    const alexPage = await browser.newPage();
    await openAs(alexPage, alex.token);
    await alexPage.getByTestId('friend-ring').filter({ hasText: blair.username }).getByRole('button').click();
    const input = alexPage.getByPlaceholder(`Message ${blair.username}…`);
    await input.fill('Where is this?!');
    await input.press('Enter');
    await expect(alexPage.getByText('Sent to your messages')).toBeVisible();

    const blairPage = await browser.newPage();
    await openAs(blairPage, blair.token, `/messages/${alex.username}`);
    const bubble = blairPage.getByTestId('message').first();
    await expect(bubble).toContainText('Replied to your story');
    await expect(bubble).toContainText('Hidden waterfall');
    await expect(bubble).toContainText('Where is this?!');
    await blairPage.getByLabel('Message', { exact: true }).fill('Iceland!');
    await blairPage.getByRole('button', { name: 'Send' }).click();
    await expect(blairPage.getByTestId('message').last()).toContainText('Iceland!');
    await alexPage.close();
    await blairPage.close();
  });

  test('One-way follow gives a one-way story reply', async ({ browser, request }) => {
    const fan = await apiSignup(request, 'fan');
    const creator = await apiSignup(request, 'creator');
    await authed(request, fan.token).post(`/users/${creator.username}/follow`);
    await apiPostStory(request, creator.token, { text: 'Behind the scenes' });

    const fanPage = await browser.newPage();
    await openAs(fanPage, fan.token);
    await fanPage.getByTestId('friend-ring').filter({ hasText: creator.username }).getByRole('button').click();
    const input = fanPage.getByPlaceholder(`Reply to ${creator.username}…`);
    await input.fill('Huge fan!');
    await input.press('Enter');
    await expect(fanPage.getByText('Reply sent')).toBeVisible();
    await fanPage.getByRole('button', { name: 'Close stories' }).click();
    await fanPage.goto(`/u/${creator.username}`);
    await expect(fanPage.getByRole('button', { name: 'Following', exact: true })).toBeVisible();
    await expect(fanPage.getByRole('link', { name: 'Message' })).toHaveCount(0);

    const creatorPage = await browser.newPage();
    await openAs(creatorPage, creator.token, '/activity');
    await creatorPage.getByRole('tab', { name: /Story replies/ }).click();
    await expect(creatorPage.getByText('Huge fan!')).toBeVisible();
    await expect(creatorPage.getByText(/One-way reply/)).toBeVisible();
    await creatorPage.goto('/messages');
    await expect(creatorPage.getByText('No messages yet')).toBeVisible();
    await fanPage.close();
    await creatorPage.close();
  });

  test('Strangers can only reply to stories', async ({ page, request }) => {
    const stranger = await apiSignup(request, 'stranger');
    const creator = await apiSignup(request, 'creator');
    await openAs(page, stranger.token, `/u/${creator.username}`);
    await expect(page.getByRole('button', { name: 'Follow', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Message' })).toHaveCount(0);
    await page.goto(`/messages/${creator.username}`);
    await expect(page.getByTestId('read-only')).toContainText('once you both follow each other');
    await expect(page.getByLabel('Message', { exact: true })).toHaveCount(0);
  });

  test('Unfollowing makes a conversation read-only', async ({ page, request }) => {
    const { alex, blair } = await mutualPair(request);
    await authed(request, alex.token).post(`/messages/${blair.username}`, { text: 'See you Friday' });
    await authed(request, blair.token).delete(`/users/${alex.username}/follow`);
    await openAs(page, alex.token, `/messages/${blair.username}`);
    await expect(page.getByText('See you Friday')).toBeVisible();
    await expect(page.getByTestId('read-only')).toContainText('once you both follow each other');
  });
});
