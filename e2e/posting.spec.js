// Implements features/posting-and-highlights.feature
import { expect, test } from '@playwright/test';
import { apiPostStory, apiSignup, openAs, viewer } from './helpers.js';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

test.describe('Feature: Posting stories and saving highlights', () => {
  test('Post a text story', async ({ page, request }) => {
    const me = await apiSignup(request, 'poster');
    await openAs(page, me.token);
    await page.getByRole('link', { name: 'New story' }).click();
    await page.getByLabel('Story text').fill('My first vlog day!');
    await page.getByRole('radio', { name: 'Background 3' }).click();
    await page.getByLabel(/Tags/).fill('#vlog #travel');
    await page.getByRole('button', { name: 'Share to your story' }).click();
    const mine = page.getByRole('region', { name: 'Stories' }).locator('.tray-item').first().getByRole('button').first();
    await expect(mine).toHaveAttribute('data-ring', 'seen');
    await mine.click();
    await expect(viewer(page)).toContainText('My first vlog day!');
    await expect(page.getByRole('button', { name: /0 views/ })).toBeVisible();
  });

  test('Post a photo story', async ({ page, request }) => {
    const me = await apiSignup(request, 'photo');
    await openAs(page, me.token, '/create');
    await page.getByRole('tab', { name: /Photo/ }).click();
    await page.getByLabel('Choose photo or video').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByAltText('Story preview')).toBeVisible();
    await page.getByRole('button', { name: 'Share to your story' }).click();
    await page.getByRole('region', { name: 'Stories' }).locator('.tray-item').first().getByRole('button').first().click();
    await expect(viewer(page).locator('img.story-media')).toHaveAttribute('src', /\/uploads\/.+\.png/);
  });

  test('Save my story to a new highlight from the viewer', async ({ page, request }) => {
    const me = await apiSignup(request, 'hl');
    await apiPostStory(request, me.token, { text: 'Highlight me' });
    await openAs(page, me.token);
    await page.getByRole('region', { name: 'Stories' }).locator('.tray-item').first().getByRole('button').first().click();
    await page.getByRole('button', { name: /Highlight/ }).click();
    await page.getByLabel('New highlight name').fill('Best of');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Saved to new highlight Best of')).toBeVisible();
    await page.getByRole('button', { name: 'Close stories' }).click();
    await page.goto(`/u/${me.username}`);
    await page.getByTestId('highlight').filter({ hasText: 'Best of' }).click();
    await expect(viewer(page)).toContainText('Highlight me');
    await expect(viewer(page)).toHaveAttribute('data-kind', 'highlight');
  });

  test('Build a highlight from the archive', async ({ page, request }) => {
    const me = await apiSignup(request, 'arch');
    await apiPostStory(request, me.token, { text: 'one' });
    await apiPostStory(request, me.token, { text: 'two' });
    await openAs(page, me.token, '/archive');
    const tiles = page.getByTestId('archive-tile');
    await expect(tiles).toHaveCount(2);
    await tiles.nth(0).click();
    await tiles.nth(1).click();
    await page.getByRole('button', { name: 'Add to highlight (2)' }).click();
    await page.getByLabel('New highlight name').fill('Trips');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByText('Saved to new highlight Trips')).toBeVisible();
    await page.goto(`/u/${me.username}`);
    await page.getByTestId('highlight').filter({ hasText: 'Trips' }).click();
    await expect(page.getByTestId('progress-fill')).toHaveCount(2);
  });

  test('Delete a story', async ({ page, request }) => {
    const me = await apiSignup(request, 'del');
    await apiPostStory(request, me.token, { text: 'oops' });
    await openAs(page, me.token);
    page.on('dialog', (d) => d.accept());
    const mine = page.getByRole('region', { name: 'Stories' }).locator('.tray-item').first().getByRole('button').first();
    await mine.click();
    await page.getByRole('button', { name: /Delete/ }).click();
    await expect(viewer(page)).toHaveCount(0);
    await expect(mine).toHaveAttribute('data-ring', 'none');
  });
});
