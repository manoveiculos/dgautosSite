-- ---------------------------------------------------------------------------
-- Tabela lead_scores — alimenta o painel /leads-manos.
--
-- Responde "qual anúncio traz lead bom": cruza origem (canal, campanha,
-- criativo) com a nota de qualificação calculada em server/scoring.ts.
--
-- SEM DADO PESSOAL, de propósito. Nome, telefone e placa ficam no n8n/CRM, que
-- tem controle de acesso. A chave usada aqui é a publishable do Supabase (a
-- mesma do radar), então esta tabela guarda só o que pode ser lido sem expor
-- ninguém: tipo, nota, faixa, origem e cidade.
--
-- Como rodar: SQL Editor do Supabase -> colar tudo -> Run.
-- Pode rodar mais de uma vez sem quebrar nada (é idempotente).
-- ---------------------------------------------------------------------------

create table if not exists public.lead_scores (
  id            bigserial   primary key,
  created_at    timestamptz not null default now(),

  -- Mesmo id no registro parcial e no completo, para o funil contar UMA pessoa.
  lead_id       text        not null,
  -- 'parcial' = só o contato foi capturado; 'completo' = qualificação inteira.
  stage         text        not null,
  lead_type     text        not null,

  score         int         not null,
  faixa         text        not null,
  descartado    boolean     not null default false,
  fora_do_raio  boolean     not null default false,

  canal         text,
  utm_source    text,
  utm_campaign  text,
  utm_content   text,
  cidade        text
);

-- Impede que o mesmo lead conte duas vezes na mesma etapa (a pessoa pode
-- corrigir os dados e reenviar). O servidor envia com upsert, então o reenvio
-- ATUALIZA a nota em vez de criar uma linha nova ou dar erro.
create unique index if not exists lead_scores_lead_stage_uk
  on public.lead_scores (lead_id, stage);

-- O painel lê os últimos N registros ordenados por data.
create index if not exists lead_scores_created_at_idx
  on public.lead_scores (created_at desc);

-- Agregações por campanha e por canal.
create index if not exists lead_scores_campanha_idx
  on public.lead_scores (utm_campaign) where utm_campaign is not null;
create index if not exists lead_scores_canal_idx
  on public.lead_scores (canal) where canal is not null;

-- ---------------------------------------------------------------------------
-- RLS
--
-- Insert e select liberados para `anon` porque o servidor usa a chave
-- publishable. É aceitável AQUI porque a tabela não tem dado pessoal — quem
-- souber a chave vê números de campanha, não vê cliente.
-- Se um dia entrar qualquer campo pessoal nesta tabela, troque para a service
-- role e feche o select.
-- ---------------------------------------------------------------------------

alter table public.lead_scores enable row level security;

drop policy if exists "lead_scores insert anon" on public.lead_scores;
create policy "lead_scores insert anon"
  on public.lead_scores for insert to anon with check (true);

drop policy if exists "lead_scores update anon" on public.lead_scores;
create policy "lead_scores update anon"
  on public.lead_scores for update to anon using (true) with check (true);

drop policy if exists "lead_scores select anon" on public.lead_scores;
create policy "lead_scores select anon"
  on public.lead_scores for select to anon using (true);

-- ---------------------------------------------------------------------------
-- Conferência rápida (rodar depois do primeiro lead de teste)
-- ---------------------------------------------------------------------------

-- Últimos registros:
--   select created_at, lead_type, stage, score, faixa, canal, utm_campaign
--   from public.lead_scores order by created_at desc limit 20;

-- Desempenho por campanha — compare pela coluna pct_quente, não pelo total:
--   select coalesce(utm_campaign, '(sem campanha)') as campanha,
--          count(*) as leads,
--          count(*) filter (where faixa = 'quente') as quentes,
--          round(avg(score)) as nota_media,
--          round(100.0 * count(*) filter (where faixa = 'quente') / count(*)) as pct_quente
--   from public.lead_scores
--   where stage = 'completo'
--   group by 1 order by quentes desc;

-- Contatos que não finalizaram (fila de resgate):
--   select p.lead_id, p.created_at, p.canal, p.utm_campaign
--   from public.lead_scores p
--   where p.stage = 'parcial'
--     and not exists (
--       select 1 from public.lead_scores c
--       where c.lead_id = p.lead_id and c.stage = 'completo'
--     )
--   order by p.created_at desc;
