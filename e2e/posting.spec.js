// Implements features/posting-and-highlights.feature
import { expect, test } from '@playwright/test';
import { apiPostStory, apiSignup, authed, openAs, viewer } from './helpers.js';

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

  test('Post a photo story from the camera roll', async ({ page, request }) => {
    const me = await apiSignup(request, 'photo');
    await openAs(page, me.token, '/create');
    await page.getByRole('tab', { name: /Photo/ }).click();
    await page.getByLabel('Choose photo or video').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByAltText('Story preview')).toBeVisible();
    await page.getByRole('button', { name: 'Share to your story' }).click();
    await page.getByRole('region', { name: 'Stories' }).locator('.tray-item').first().getByRole('button').first().click();
    await expect(viewer(page).locator('img.story-media')).toHaveAttribute('src', /\/uploads\/.+\.png/);
  });

  test('Take a photo with the in-app camera and post it', async ({ page, request }) => {
    const me = await apiSignup(request, 'snap');
    await openAs(page, me.token, '/create');
    await page.getByRole('tab', { name: /Photo/ }).click();
    await page.getByRole('button', { name: /Open camera/ }).click();
    const camera = page.getByTestId('camera');
    await expect(camera).toHaveAttribute('data-status', 'ready');
    await page.getByRole('button', { name: 'Take photo' }).click();
    await expect(camera).toHaveAttribute('data-status', 'review');
    await expect(page.getByAltText('Captured photo')).toBeVisible();
    await page.getByRole('button', { name: 'Use photo' }).click();
    await expect(page.getByAltText('Story preview')).toBeVisible();
    await page.getByRole('button', { name: 'Share to your story' }).click();
    await page.getByRole('region', { name: 'Stories' }).locator('.tray-item').first().getByRole('button').first().click();
    await expect(viewer(page).locator('img.story-media')).toHaveAttribute('src', /\/uploads\/.+\.jpg/);
  });

  test('Record a video with the in-app camera and post it', async ({ page, request }) => {
    const me = await apiSignup(request, 'vlog');
    await openAs(page, me.token, '/create');
    await page.getByRole('tab', { name: /Photo/ }).click();
    await page.getByRole('button', { name: /Open camera/ }).click();
    await expect(page.getByTestId('camera')).toHaveAttribute('data-status', 'ready');
    await page.getByRole('radio', { name: 'Video' }).click();
    await page.getByRole('button', { name: 'Start recording' }).click();
    await expect(page.getByRole('timer')).toBeVisible();
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: 'Stop recording' }).click();
    await page.getByRole('button', { name: 'Use video' }).click();
    await page.getByRole('button', { name: 'Share to your story' }).click();
    await expect(page.getByRole('region', { name: 'Stories' })).toBeVisible();
    const { stories } = await (await authed(request, me.token).get('/stories/mine')).json();
    expect(stories).toHaveLength(1);
    expect(stories[0].type).toBe('video');
    expect(stories[0].durationMs).toBeGreaterThan(1500);
    expect(stories[0].durationMs).toBeLessThan(10_000);
    await page.getByRole('region', { name: 'Stories' }).locator('.tray-item').first().getByRole('button').first().click();
    await expect(page.getByTestId('story-video')).toBeVisible();
  });

  test('Record hands-free with a countdown', async ({ page, request }) => {
    test.slow(); // really waits for the 3s countdown + 15s recording
    const me = await apiSignup(request, 'handsfree');
    await openAs(page, me.token, '/create');
    await page.getByRole('tab', { name: /Photo/ }).click();
    await page.getByRole('button', { name: /Open camera/ }).click();
    const camera = page.getByTestId('camera');
    await expect(camera).toHaveAttribute('data-status', 'ready');
    await page.getByRole('radio', { name: 'Hands-free' }).click();
    await page.getByRole('radio', { name: '3s' }).click();
    await page.getByRole('radio', { name: '15s' }).click();
    await page.getByRole('button', { name: 'Start hands-free recording' }).click();
    // Hands off from here on.
    await expect(page.getByTestId('countdown')).toContainText('3');
    await expect(page.getByTestId('countdown')).toContainText('1', { timeout: 4000 });
    await expect(camera).toHaveAttribute('data-status', 'recording', { timeout: 4000 });
    await expect(page.getByRole('timer')).toContainText('/ 0:15');
    await expect(camera).toHaveAttribute('data-status', 'review', { timeout: 20_000 });
    await page.getByRole('button', { name: 'Use video' }).click();
    await page.getByRole('button', { name: 'Share to your story' }).click();
    await expect(page.getByRole('region', { name: 'Stories' })).toBeVisible();
    const { stories } = await (await authed(request, me.token).get('/stories/mine')).json();
    expect(stories[0].type).toBe('video');
    // Stopped by itself at the 15s limit (the file's own length may be a few ms shorter).
    expect(stories[0].durationMs).toBeGreaterThan(14_000);
    expect(stories[0].durationMs).toBeLessThanOrEqual(15_000);
  });

  test('Cancel a hands-free countdown', async ({ page, request }) => {
    const me = await apiSignup(request, 'cancel');
    await openAs(page, me.token, '/create');
    await page.getByRole('tab', { name: /Photo/ }).click();
    await page.getByRole('button', { name: /Open camera/ }).click();
    const camera = page.getByTestId('camera');
    await expect(camera).toHaveAttribute('data-status', 'ready');
    await page.getByRole('radio', { name: 'Hands-free' }).click();
    await page.getByRole('radio', { name: '10s' }).click();
    await page.getByRole('button', { name: 'Start hands-free recording' }).click();
    await expect(page.getByTestId('countdown')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel countdown' }).click();
    await expect(camera).toHaveAttribute('data-status', 'ready');
    await expect(page.getByTestId('countdown')).toHaveCount(0);
  });

  test('Hands-free settings are remembered', async ({ page, request }) => {
    const me = await apiSignup(request, 'remember');
    await openAs(page, me.token, '/create');
    await page.getByRole('tab', { name: /Photo/ }).click();
    await page.getByRole('button', { name: /Open camera/ }).click();
    await page.getByRole('radio', { name: 'Hands-free' }).click();
    await page.getByRole('radio', { name: '10s' }).click();
    await page.getByRole('radio', { name: '60s' }).click();
    await page.getByRole('button', { name: 'Close camera' }).click();
    await page.reload();
    await page.getByRole('tab', { name: /Photo/ }).click();
    await page.getByRole('button', { name: /Open camera/ }).click();
    await page.getByRole('radio', { name: 'Hands-free' }).click();
    await expect(page.getByRole('radio', { name: '10s' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radio', { name: '60s' })).toHaveAttribute('aria-checked', 'true');
  });

  test('Retake and flip the camera', async ({ page, request }) => {
    const me = await apiSignup(request, 'flip');
    await openAs(page, me.token, '/create');
    await page.getByRole('tab', { name: /Photo/ }).click();
    await page.getByRole('button', { name: /Open camera/ }).click();
    const camera = page.getByTestId('camera');
    await expect(camera).toHaveAttribute('data-status', 'ready');
    await page.getByRole('button', { name: 'Flip camera' }).click();
    await expect(page.getByTestId('camera-feed')).toHaveClass(/mirrored/);
    await expect(camera).toHaveAttribute('data-status', 'ready');
    await page.getByRole('button', { name: 'Take photo' }).click();
    await page.getByRole('button', { name: 'Retake' }).click();
    await expect(camera).toHaveAttribute('data-status', 'ready');
    await expect(page.getByTestId('camera-feed')).toBeVisible();
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
