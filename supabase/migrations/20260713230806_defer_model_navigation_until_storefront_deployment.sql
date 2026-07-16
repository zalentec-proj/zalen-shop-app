-- A implementação das rotas /modelos depende do próximo deployment seguro.
-- Mantemos a taxonomia pronta, mas não expomos itens sem destino no storefront
-- enquanto a publicação de produção estiver bloqueada pela validação de pagamento.

update public.storefront_navigation_items
set enabled = false,
    updated_at = now()
where store_id = (select id from public.stores where slug = 'brasil-drones' limit 1)
  and href like '/modelos/%';

update public.storefront_navigation_items
set show_in_navbar = true,
    show_in_categories_dropdown = true,
    updated_at = now()
where store_id = (select id from public.stores where slug = 'brasil-drones' limit 1)
  and lower(label) in ('baterias', 'master airscrew');
