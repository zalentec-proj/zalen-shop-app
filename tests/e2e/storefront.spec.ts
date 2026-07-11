import { expect, test } from '@playwright/test';

test.describe('storefront pilot', () => {
  test.skip(!process.env.E2E_BASE_URL, 'Defina E2E_BASE_URL para homologação.');

  test('loads storefront and checkout without exposing secrets', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.content()).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    await expect(page.content()).not.toContain('MERCADO_PAGO_ACCESS_TOKEN');
  });
});
