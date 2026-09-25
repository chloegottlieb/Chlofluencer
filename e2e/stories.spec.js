// Implements features/stories.feature
import { expect, test } from '@playwright/test';
import { apiLogin, apiPostStory, apiSignup, authed, openAs, tapNext, tapPrev, viewer } from './helpers.js';

let me;
let friendA;
let friendB;

test.beforeEach(async ({ request }) => {
  me = await apiSignup(request, 'me');
  friendA = await apiSignup(request, 'fa');
  friendB = await apiSignup(request, 'fb');
  // friend-a posted most recently, so they lead the tray.
  await apiPostStory(request, friendB.token, { text: 'B one' });
  await apiPostStory(request, friendA.token, { text: 'A one' });
  await apiPostStory(request, friendA.token, { text: 'A two' });
  const api = authed(request, me.token);
  await api.post(`/users/${friendA.username}/follow`);
  await api.post(`/users/${friendB.username}/follow`);
});

test.describe('Feature: Instagram-style tap-through stories', () => {
  test("Tap through friends' stories in order", async ({ page }) => {
    await openAs(page, me.token);
    await page.getByRole('button', { name: "Watch 2 friends' stories" }).click();
    await expect(viewer(page)).toContainText('A one');
    await expect(page.getByTestId('progress-fill')).toHaveCount(2);
    await tapNext(page);
    await expect(viewer(page)).toContainText('A two');
    await tapNext(page);
    await expect(viewer(page)).toContainText('B one');
    await tapPrev(page);
    await expect(viewer(page)).toContainText('A two');
  });

  test("Finishing friends' stories rolls into strangers' stories", async ({ page }) => {
    await openAs(page, me.token);
    await page.getByRole('button', { name: "Watch 2 friends' stories" }).click();
    for (let i = 0; i < 3; i++) await tapNext(page);
    await expect(page.getByText("You're all caught up")).toBeVisible();
    await page.getByRole('button', { name: 'Discover new creators' }).click();
    await expect(viewer(page)).toHaveAttribute('data-kind', 'discover');
    await expect(page.getByTestId('for-you-chip')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Follow', exact: true })).toBeVisible();
    const firstCreator = await viewer(page).locator('.viewer-username').textContent();
    // Tap through the first creator's stories and into the next recommendation.
    for (let i = 0; i < 5; i++) {
      await tapNext(page);
      const current = await viewer(page).locator('.viewer-username').textContent();
      if (current !== firstCreator) break;
    }
    await expect(viewer(page).locator('.viewer-username')).not.toHaveText(firstCreator);
    await expect(viewer(page)).toHaveAttribute('data-kind', 'discover');
  });

  test('Press and hold pauses the story', async ({ page }) => {
    await openAs(page, me.token);
    await page.getByTestId('friend-ring').filter({ hasText: friendA.username }).getByRole('button').click();
    await expect(viewer(page)).toContainText('A one');
    const box = await page.getByRole('button', { name: 'Next story' }).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(400);
    await expect(viewer(page)).toHaveAttribute('data-paused', 'true');
    await page.waitForTimeout(5000);
    await expect(viewer(page)).toContainText('A one');
    await page.mouse.up();
    await expect(viewer(page)).toHaveAttribute('data-paused', 'false');
    await expect(viewer(page)).toContainText('A one');
  });

  test('Stories auto-advance', async ({ page }) => {
    await openAs(page, me.token);
    await page.getByTestId('friend-ring').filter({ hasText: friendB.username }).getByRole('button').click();
    await expect(viewer(page)).toContainText('B one');
    await expect(viewer(page)).not.toContainText('B one', { timeout: 8000 });
  });

  test('Watched friends move to the end of the tray', async ({ page }) => {
    await openAs(page, me.token);
    const ringA = page.getByTestId('friend-ring').filter({ hasText: friendA.username });
    await ringA.getByRole('button').click();
    await expect(viewer(page)).toContainText('A one');
    await tapNext(page);
    await expect(viewer(page)).toContainText('A two');
    await page.getByRole('button', { name: 'Close stories' }).click();
    const rings = page.getByTestId('friend-ring');
    await expect(rings.last()).toContainText(friendA.username);
    await expect(ringA.getByRole('button')).toHaveAttribute('data-ring', 'seen');
    await expect(rings.first().getByRole('button')).toHaveAttribute('data-ring', 'unseen');
  });

  test("Like and reply to a friend's story", async ({ page, request }) => {
    await openAs(page, me.token);
    await page.getByTestId('friend-ring').filter({ hasText: friendA.username }).getByRole('button').click();
    await page.getByRole('button', { name: 'Like story' }).click();
    await expect(page.getByRole('button', { name: 'Unlike story' })).toBeVisible();
    await page.getByLabel('Reply to story').fill('Love this!');
    await page.getByLabel('Reply to story').press('Enter');
    await expect(page.getByText('Reply sent')).toBeVisible();

    const { token } = await apiLogin(request, friendA.username);
    const friendPage = await page.context().browser().newPage();
    await openAs(friendPage, token, '/activity');
    await expect(friendPage.getByText('liked your story.')).toBeVisible();
    await friendPage.getByRole('tab', { name: /Story replies/ }).click();
    await expect(friendPage.getByText('Love this!')).toBeVisible();
    await friendPage.close();
  });
});
