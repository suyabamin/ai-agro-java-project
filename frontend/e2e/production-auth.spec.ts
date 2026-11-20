import { expect, test } from '@playwright/test';

test('production build never exposes development mock authentication', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('agroai_mock_user', JSON.stringify({ uid: 'mock-owner-001', role: 'owner' }));
    localStorage.setItem('agroai_mock_token', 'mock.jwt.token.owner');
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Quick Dev Sign-In' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible();

  await page.goto('/login');
  await expect(page.getByText('Authentication is unavailable because Firebase is not configured.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign In as/ })).toHaveCount(0);

  await page.goto('/register');
  await expect(page.getByText('Registration is unavailable because Firebase is not configured.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign Up as/ })).toHaveCount(0);

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});
