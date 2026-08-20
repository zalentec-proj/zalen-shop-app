import { expect, test } from '@playwright/test';

test.describe('storefront pilot', () => {
  test.skip(!process.env.E2E_BASE_URL, 'Defina E2E_BASE_URL para homologação.');

  test('opens the cart drawer and guest checkout without exposing secrets', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    const content = await page.content();
    expect(content).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(content).not.toContain('MERCADO_PAGO_ACCESS_TOKEN');

    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).first().click();
    const cartDialog = page.getByRole('dialog', { name: 'Seu carrinho' });
    await expect(cartDialog).toBeVisible();
    await expect(cartDialog.getByText('Calculado no checkout')).toBeVisible();
    await expect(
      cartDialog.getByRole('button', { name: 'IR PARA O CHECKOUT' })
    ).toBeVisible();

    await cartDialog.getByRole('button', { name: 'IR PARA O CHECKOUT' }).click();
    await expect(page).toHaveURL(/\/carrinho$/);
    await expect(
      page.getByRole('heading', { name: 'Finalizar compra' })
    ).toBeVisible();
    await expect(page.getByText('Compre como convidado.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Entrar na conta' })).toBeVisible();
    await expect(page.getByText('Validar e-mail')).toHaveCount(0);
    await expect(page.getByText('A calcular', { exact: true })).toBeVisible();
    await expect(page.getByText('Grátis', { exact: true })).toHaveCount(0);

    await page.getByLabel('Nome completo').fill('Cliente Teste');
    await page
      .getByRole('textbox', { name: 'E-mail', exact: true })
      .fill('cliente.teste@example.com');
    await page.getByLabel('Telefone com DDD').fill('11999999999');
    await page.getByLabel('CPF').fill('52998224725');
    await page.getByRole('button', { name: 'Salvar dados' }).click();
    await expect(
      page.getByRole('heading', { name: 'Endereço de entrega' })
    ).toBeVisible();
    await expect(page.getByText('Validar e-mail')).toHaveCount(0);

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(hasHorizontalOverflow).toBe(false);

    await page.goto('/produto/dji-mavic-3-pro');
    await page.getByRole('button', { name: 'Comprar agora' }).click();
    await expect(page).toHaveURL(/\/carrinho$/);
  });
});
