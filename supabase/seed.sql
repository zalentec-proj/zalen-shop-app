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
) on conflict (slug) do update set
  name = excluded.name,
  status = excluded.status;

-- Categorias principais
insert into categories (id, store_id, name, slug, position)
values
  (
    '44444444-4444-4444-8444-444444444101',
    '00000000-0000-0000-0000-000000000001',
    'Drones',
    'drones',
    0
  ),
  (
    '44444444-4444-4444-8444-444444444102',
    '00000000-0000-0000-0000-000000000001',
    'Peças',
    'pecas',
    1
  ),
  (
    '44444444-4444-4444-8444-444444444103',
    '00000000-0000-0000-0000-000000000001',
    'Acessórios',
    'acessorios',
    2
  ),
  (
    '44444444-4444-4444-8444-444444444104',
    '00000000-0000-0000-0000-000000000001',
    'Baterias',
    'baterias',
    3
  ),
  (
    '44444444-4444-4444-8444-444444444105',
    '00000000-0000-0000-0000-000000000001',
    'Kits e Combos',
    'kits-e-combos',
    4
  )
on conflict (store_id, slug) do update set
  name = excluded.name,
  position = excluded.position;

-- Produtos mockados atuais do catálogo
insert into products (
  id,
  store_id,
  name,
  slug,
  description,
  brand,
  status,
  seo_title,
  seo_description,
  requires_shipping,
  created_at,
  updated_at
)
values
  (
    '11111111-1111-4111-8111-111111111101',
    '00000000-0000-0000-0000-000000000001',
    'DJI Mavic 3 Pro',
    'dji-mavic-3-pro',
    'Drone profissional com câmera Hasselblad, autonomia avançada e sistema inteligente de detecção para voos mais seguros e precisos.',
    'DJI',
    'active',
    'DJI Mavic 3 Pro — Drone Profissional com Câmera Hasselblad',
    'Compre o DJI Mavic 3 Pro com câmera Hasselblad 4/3 CMOS, autonomia de 46 min e transmissão de 15km.',
    true,
    '2024-01-01T00:00:00Z',
    '2024-01-01T00:00:00Z'
  ),
  (
    '11111111-1111-4111-8111-111111111102',
    '00000000-0000-0000-0000-000000000001',
    'DJI Mini 4 Pro',
    'dji-mini-4-pro',
    'Mini drone avançado com recursos de imagem, detecção omnidirecional, ActiveTrack 360° e transmissão de vídeo FHD a 20 km.',
    'DJI',
    'active',
    'DJI Mini 4 Pro — Mini Drone com Máxima Performance',
    'DJI Mini 4 Pro: câmera 1/1.3" CMOS, peso abaixo de 249g, autonomia de 34 min e detecção omnidirecional.',
    true,
    '2024-01-01T00:00:00Z',
    '2024-01-01T00:00:00Z'
  ),
  (
    '11111111-1111-4111-8111-111111111103',
    '00000000-0000-0000-0000-000000000001',
    'DJI Air 3 Fly More Combo',
    'dji-air-3-fly-more',
    'Combo com sistema de câmeras duplas, baterias adicionais, hélices extras, hub de carregamento e bolsa de transporte.',
    'DJI',
    'active',
    null,
    null,
    true,
    '2024-01-01T00:00:00Z',
    '2024-01-01T00:00:00Z'
  ),
  (
    '11111111-1111-4111-8111-111111111104',
    '00000000-0000-0000-0000-000000000001',
    'Bateria DJI Mini 3 Pro',
    'bateria-dji-mini-3-pro',
    'Bateria de Voo Inteligente DJI original para Mini 3 Pro e Mini 4 Pro com monitoramento de status em tempo real.',
    'DJI',
    'active',
    null,
    null,
    true,
    '2024-01-01T00:00:00Z',
    '2024-01-01T00:00:00Z'
  ),
  (
    '11111111-1111-4111-8111-111111111105',
    '00000000-0000-0000-0000-000000000001',
    'Hélices DJI Air 3 (Par)',
    'helices-dji-air-3',
    'Hélices de reposição originais para DJI Air 3, projetadas para menor ruído e maior eficiência aerodinâmica.',
    'DJI',
    'active',
    null,
    null,
    true,
    '2024-01-01T00:00:00Z',
    '2024-01-01T00:00:00Z'
  ),
  (
    '11111111-1111-4111-8111-111111111106',
    '00000000-0000-0000-0000-000000000001',
    'Case Impermeável Pro',
    'case-impermeavel',
    'Maleta rígida hermética à prova d''água, poeira e impactos externos, com espuma interna recortada a laser.',
    'Brasil Drones',
    'active',
    null,
    null,
    true,
    '2024-01-01T00:00:00Z',
    '2024-01-01T00:00:00Z'
  )
on conflict (store_id, slug) do update set
  name = excluded.name,
  description = excluded.description,
  brand = excluded.brand,
  status = excluded.status,
  seo_title = excluded.seo_title,
  seo_description = excluded.seo_description,
  requires_shipping = excluded.requires_shipping,
  updated_at = excluded.updated_at;

-- Variações, preço e estoque
insert into product_variants (
  id,
  store_id,
  product_id,
  sku,
  price,
  stock,
  weight,
  attributes_json,
  created_at
)
values
  (
    '22222222-2222-4222-8222-222222222101',
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-4111-8111-111111111101',
    'DJI-M3P-001',
    12999.00,
    5,
    895.000,
    '{}'::jsonb,
    '2024-01-01T00:00:00Z'
  ),
  (
    '22222222-2222-4222-8222-222222222102',
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-4111-8111-111111111102',
    'DJI-M4P-001',
    6999.00,
    8,
    249.000,
    '{}'::jsonb,
    '2024-01-01T00:00:00Z'
  ),
  (
    '22222222-2222-4222-8222-222222222103',
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-4111-8111-111111111103',
    'DJI-AIR3-FM',
    10999.00,
    3,
    null,
    '{}'::jsonb,
    '2024-01-01T00:00:00Z'
  ),
  (
    '22222222-2222-4222-8222-222222222104',
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-4111-8111-111111111104',
    'DJI-BAT-M3P',
    899.00,
    20,
    80.500,
    '{}'::jsonb,
    '2024-01-01T00:00:00Z'
  ),
  (
    '22222222-2222-4222-8222-222222222105',
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-4111-8111-111111111105',
    'DJI-HEL-AIR3',
    199.00,
    50,
    null,
    '{}'::jsonb,
    '2024-01-01T00:00:00Z'
  ),
  (
    '22222222-2222-4222-8222-222222222106',
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-4111-8111-111111111106',
    'BD-CASE-PRO',
    349.00,
    15,
    1200.000,
    '{}'::jsonb,
    '2024-01-01T00:00:00Z'
  )
on conflict (id) do update set
  sku = excluded.sku,
  price = excluded.price,
  stock = excluded.stock,
  weight = excluded.weight,
  attributes_json = excluded.attributes_json;

-- Imagens usam sentinelas asset:* mapeadas no repository para os assets locais
insert into product_images (id, store_id, product_id, url, position, alt)
values
  (
    '33333333-3333-4333-8333-333333333101',
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-4111-8111-111111111101',
    'asset:mavic_3_pro',
    0,
    'DJI Mavic 3 Pro'
  ),
  (
    '33333333-3333-4333-8333-333333333102',
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-4111-8111-111111111101',
    'asset:mini_4_pro',
    1,
    'DJI Mavic 3 Pro — vista lateral'
  ),
  (
    '33333333-3333-4333-8333-333333333103',
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-4111-8111-111111111102',
    'asset:mini_4_pro',
    0,
    'DJI Mini 4 Pro'
  ),
  (
    '33333333-3333-4333-8333-333333333104',
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-4111-8111-111111111103',
    'asset:mavic_3_pro',
    0,
    'DJI Air 3 Fly More Combo'
  ),
  (
    '33333333-3333-4333-8333-333333333105',
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-4111-8111-111111111104',
    'asset:drone_accessories',
    0,
    'Bateria DJI Mini 3 Pro'
  ),
  (
    '33333333-3333-4333-8333-333333333106',
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-4111-8111-111111111105',
    'asset:drone_accessories',
    0,
    'Hélices DJI Air 3'
  ),
  (
    '33333333-3333-4333-8333-333333333107',
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-4111-8111-111111111106',
    'asset:drone_accessories',
    0,
    'Case Impermeável Pro'
  )
on conflict (id) do update set
  url = excluded.url,
  position = excluded.position,
  alt = excluded.alt;

insert into product_categories (product_id, category_id)
values
  (
    '11111111-1111-4111-8111-111111111101',
    '44444444-4444-4444-8444-444444444101'
  ),
  (
    '11111111-1111-4111-8111-111111111102',
    '44444444-4444-4444-8444-444444444101'
  ),
  (
    '11111111-1111-4111-8111-111111111103',
    '44444444-4444-4444-8444-444444444105'
  ),
  (
    '11111111-1111-4111-8111-111111111104',
    '44444444-4444-4444-8444-444444444104'
  ),
  (
    '11111111-1111-4111-8111-111111111105',
    '44444444-4444-4444-8444-444444444102'
  ),
  (
    '11111111-1111-4111-8111-111111111106',
    '44444444-4444-4444-8444-444444444103'
  )
on conflict do nothing;
