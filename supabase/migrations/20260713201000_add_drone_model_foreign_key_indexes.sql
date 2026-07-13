-- Índices dedicados às chaves estrangeiras do catálogo de compatibilidade.
-- Os índices compostos existentes atendem às consultas da aplicação; estes
-- também cobrem as verificações de integridade e exclusões por chave pai.

create index if not exists drone_models_line_id_idx
  on public.drone_models(line_id);

create index if not exists product_drone_models_drone_model_id_idx
  on public.product_drone_models(drone_model_id);
