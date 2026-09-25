// Implements features/safety.feature
import { expect, test } from '@playwright/test';
import { apiLogin, apiPostStory, apiSignup, authed, openAs, uniqueName, viewer } from './helpers.js';

/** The seeded moderator account ("mod" / password123). */
const modToken = async (request) => (await apiLogin(request, 'mod')).token;

test.describe('Feature: Safety, moderation and legal', () => {
  test('Terms must be accepted to sign up', async ({ page }) => {
    const username = uniqueName('terms');
    await page.goto('/signup');
    await expect(page.getByRole('button', { name: 'Sign up' })).toBeDisabled();
    await page.getByRole('link', { name: 'Community Guidelines' }).click();
    await expect(page.getByRole('heading', { name: 'Community Guidelines', level: 1 })).toBeVisible();
    await page.goBack();
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Email').fill(`${username}@example.com`);
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('checkbox', { name: /agree to the Terms/ }).check();
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page.getByText('Your story')).toBeVisible();
  });

  test('Legal pages are public', async ({ page }) => {
    for (const [path, heading] of [
      ['/privacy', 'Privacy Policy'],
      ['/terms', 'Terms of Use'],
      ['/guidelines', 'Community Guidelines'],
      ['/delete-account', 'Delete your Storytime account'],
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
      if (path === '/terms') await expect(page.getByText(/no tolerance/i).first()).toBeVisible();
    }
  });

  test('Report a story and block the creator', async ({ page, request }) => {
    const me = await apiSignup(request, 'reporter');
    await openAs(page, me.token);
    await page.getByRole('button', { name: 'Start watching' }).click();
    const creator = await viewer(page).getAttribute('data-author');
    await page.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('menuitem', { name: 'Report' }).click();
    await page.getByRole('button', { name: 'Spam or scam' }).click();
    await page.getByRole('switch', { name: `Also block @${creator}` }).check();
    await page.getByRole('button', { name: 'Submit report' }).click();
    await expect(page.getByTestId('report-done')).toContainText('Thanks for letting us know');
    await page.getByRole('button', { name: 'Done' }).click();
    const rel = await (await authed(request, me.token).get(`/users/${creator}`)).json();
    expect(rel.relationship.blocked).toBe(true);
    await page.goto('/settings');
    await page.getByText('Your reports').click();
    await expect(page.getByText('In review')).toBeVisible();
  });

  test("Abusive language is blocked before it's posted", async ({ page, request }) => {
    const me = await apiSignup(request, 'clean');
    await openAs(page, me.token, '/create');
    await page.getByLabel('Story text').fill('you are all f4gg0ts');
    await page.getByRole('button', { name: 'Share to your story' }).click();
    await expect(page.getByRole('alert')).toContainText("isn't allowed on Storytime");
    const { stories } = await (await authed(request, me.token).get('/stories/archive')).json();
    expect(stories).toHaveLength(0);
  });

  test('Heavily reported stories are hidden until reviewed', async ({ page, request }) => {
    const creator = await apiSignup(request, 'hidden');
    const story = await apiPostStory(request, creator.token, { text: 'Reported three times' });
    for (let i = 0; i < 3; i++) {
      const r = await apiSignup(request, `rep${i}`);
      await authed(request, r.token).post('/reports', { targetType: 'story', targetId: story.id, reason: 'spam' });
    }
    const stranger = await apiSignup(request, 'stranger');
    expect((await authed(request, stranger.token).get(`/stories/${story.id}`)).status()).toBe(404);
    await openAs(page, creator.token);
    await page.getByRole('region', { name: 'Stories' }).locator('.tray-item').first().getByRole('button').first().click();
    await expect(page.getByRole('status').filter({ hasText: 'Under review' })).toBeVisible();
  });

  test('A moderator removes a story and suspends the account', async ({ page, request }) => {
    const creator = await apiSignup(request, 'badactor');
    const story = await apiPostStory(request, creator.token, { text: 'Buy cheap followers here!!!' });
    const reporter = await apiSignup(request, 'goodcitizen');
    await authed(request, reporter.token).post('/reports', {
      targetType: 'story',
      targetId: story.id,
      reason: 'spam',
      details: 'selling followers',
    });

    await openAs(page, await modToken(request), '/settings');
    await page.getByRole('link', { name: /Moderation queue/ }).click();
    const card = page.getByTestId('mod-item').filter({ hasText: `@${creator.username}` });
    await expect(card).toContainText('selling followers');
    page.once('dialog', (d) => d.accept('spam bot'));
    await card.getByRole('button', { name: 'Remove + suspend' }).click();
    await expect(card).toHaveCount(0);

    expect((await authed(request, reporter.token).get(`/stories/${story.id}`)).status()).toBe(404);
    const login = await request.post('/api/auth/login', { data: { login: creator.username, password: 'password123' } });
    expect(login.status()).toBe(403);
    expect((await login.json()).error).toMatch(/suspended.*help@storytime\.test/);

    const reporterPage = await page.context().browser().newPage();
    await openAs(reporterPage, reporter.token, '/activity');
    await expect(reporterPage.getByTestId('safety-notice').first()).toContainText('took action');
    await reporterPage.close();
  });

  test('Report a direct message', async ({ page, request }) => {
    const alex = await apiSignup(request, 'alex');
    const blair = await apiSignup(request, 'blair');
    await authed(request, alex.token).post(`/users/${blair.username}/follow`);
    await authed(request, blair.token).post(`/users/${alex.username}/follow`);
    await authed(request, alex.token).post(`/messages/${blair.username}`, { text: 'This is harassment' });
    await openAs(page, blair.token, `/messages/${alex.username}`);
    await page.getByRole('button', { name: 'Report message' }).click();
    await page.getByRole('button', { name: 'Bullying or harassment' }).click();
    await page.getByRole('button', { name: 'Submit report' }).click();
    await expect(page.getByTestId('report-done')).toBeVisible();
    const queue = await (await authed(request, await modToken(request)).get('/moderation/queue')).json();
    expect(queue.items.some((i) => i.targetType === 'message' && i.snapshot.text === 'This is harassment')).toBe(true);
  });
});
