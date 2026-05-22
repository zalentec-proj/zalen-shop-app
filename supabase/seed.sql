-- ============================================================
-- Seed inicial — Brasil Drones
-- Dados de desenvolvimento apenas. NÃO usar em produção.
-- ============================================================

-- Loja Brasil Drones
insert into stores (id, name, slug, status)
values (
  '00000000-0000-0000-0000-000000000001',
  'Brasil Drones & Parts',
  'brasil-drones',
  'active'
) on conflict (slug) do nothing;
