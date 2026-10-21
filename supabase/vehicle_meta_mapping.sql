-- ---------------------------------------------------------------------------
-- vehicle_meta_mapping — placa -> content_id do catálogo da Meta.
--
-- Rodar uma vez no SQL Editor do Supabase.
--
-- Existe porque o catálogo do Gerenciador de Comércio é alimentado pela Autos
-- 360, que numera os veículos do jeito dela: o `id` do feed da Altimus (que o
-- site usa em tudo) não é o `content_id` que a Meta conhece. Sem a tradução, os
-- eventos chegam com um id que o catálogo não reconhece e a correspondência
-- fica em 0%.
--
-- Quem preenche: server/catalogSync.ts, casando nome normalizado + preço.
-- Quem lê: server/catalog.ts, junto com a renovação do cache do feed.
-- ---------------------------------------------------------------------------

create table if not exists public.vehicle_meta_mapping (
  -- Placa é a única chave estável entre Altimus, catálogo da Meta e CRM.
  placa text primary key,
  altimus_id text not null,
  -- null = sem correspondência; o site cai no id da Altimus, como antes.
  meta_content_id text,
  matched_name text,
  match_confidence text not null
    check (match_confidence in ('exact', 'fuzzy', 'ambiguous', 'unmatched')),
  needs_review boolean not null default false,
  -- Quando a placa deixou de aparecer no feed (veículo vendido). A linha fica
  -- por mais um tempo de propósito: a venda é confirmada no CRM depois de o
  -- carro sair do estoque, e o evento Purchase precisa do content_id.
  left_stock_at timestamptz,
  synced_at timestamptz not null default now()
);

-- Para quem já rodou a versão anterior deste arquivo.
alter table public.vehicle_meta_mapping
  add column if not exists left_stock_at timestamptz;

comment on table public.vehicle_meta_mapping is
  'Mapeia a placa para o content_id do catálogo da Meta, resolvido por nome+preço porque Altimus e Autos 360 não fornecem essa correspondência.';

comment on column public.vehicle_meta_mapping.needs_review is
  'Match aproximado ou ambíguo. Serve para ViewContent (pior caso é ruído), mas não deve atribuir venda sem alguém confirmar: dois carros de nome e preço parecidos não se distinguem só por esses dados.';

-- A tabela guarda placa, que identifica veículo. Diferente de lead_scores (que
-- é anônima e usa a chave publishable), aqui só a service role entra.
alter table public.vehicle_meta_mapping enable row level security;

drop policy if exists "service role only" on public.vehicle_meta_mapping;
create policy "service role only"
  on public.vehicle_meta_mapping
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Fila de revisão: veículos que o matching não resolveu sozinho.
create index if not exists idx_vehicle_meta_mapping_revisar
  on public.vehicle_meta_mapping (needs_review)
  where needs_review = true;
