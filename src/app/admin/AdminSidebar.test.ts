import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminSidebar } from './AdminSidebar';

describe('AdminSidebar', () => {
  it('preserves the navigation labels and icons without numbers or acronyms', () => {
    const html = renderToStaticMarkup(createElement(AdminSidebar, {
      activeKey: 'orders',
      storeShortName: 'Brasil Drones',
    }));
    const navigation = html.match(/<nav\b[\s\S]*?<\/nav>/)?.[0];

    expect(navigation).toBeDefined();
    for (const label of ['Visão geral', 'Pedidos', 'Produtos', 'Clientes', 'Loja online', 'Integrações', 'Bling', 'WhatsApp', 'Marketing', 'Preços', 'Pagamentos', 'Envios', 'Domínios', 'Configurações']) {
      expect(navigation).toContain(`>${label}<`);
    }
    expect(navigation).toContain('<svg');
    for (const badge of ['01', '00', '--', '04', 'ERP', 'Msg', 'SEO', 'PJ', 'Cfg', '02', 'ON', 'Fut']) {
      expect(navigation).not.toContain(`>${badge}<`);
    }
  });

  it('keeps the store context, navigation routes and mobile menu available', () => {
    const html = renderToStaticMarkup(createElement(AdminSidebar, {
      storeShortName: 'Brasil Drones',
    }));

    expect(html).toContain('Brasil Drones');
    expect(html).toContain('href="/admin/pedidos"');
    expect(html).toContain('href="/admin/produtos"');
    expect(html).toContain('href="/admin/configuracoes"');
    expect(html).toContain('aria-label="Abrir navegação do admin"');
  });
});
