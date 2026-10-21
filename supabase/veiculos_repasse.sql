-- ===========================================================================
-- BANCO DE DADOS MANOS VEÍCULOS — SCRIPT COMPLETO REPASSE + STORAGE
-- ===========================================================================
--
-- Instruções de Execução:
-- 1. Acesse o painel do Supabase (https://supabase.com/dashboard)
-- 2. Selecione seu projeto -> Vá em "SQL Editor" na barra lateral esquerda.
-- 3. Cole TODO este script abaixo e clique em "Run" (ou digite Ctrl+Enter).
-- 4. O script criará as tabelas, os buckets de upload de foto e todas as
--    permissões (RLS) para o admin cadastrar carros e o público visualizar.
--
-- ===========================================================================

-- 1. TABELA DE VEÍCULOS DE REPASSE
create table if not exists public.veiculos_repasse (
  id                  bigserial primary key,
  created_at          timestamptz not null default now(),
  titulo              text not null,
  marca               text not null,
  modelo              text not null,
  ano                 text not null,
  km                  integer not null default 0,
  cor                 text not null,
  combustivel         text not null default 'Flex',
  cambio              text not null default 'Manual',
  placa_final         text,
  preco_fipe          numeric(12, 2) not null,
  preco_repasse       numeric(12, 2) not null,
  preco_lojista       numeric(12, 2),
  fotos               jsonb not null default '[]'::jsonb,
  descricao           text not null,
  observacoes_repasse text not null,
  destaque            boolean not null default false,
  status              text not null default 'disponivel' check (status in ('disponivel', 'reservado', 'vendido'))
);

-- Garantir que a coluna preco_lojista exista se a tabela já tiver sido criada anteriormente
alter table public.veiculos_repasse add column if not exists preco_lojista numeric(12, 2);

-- Índices de busca performática
create index if not exists veiculos_repasse_status_idx on public.veiculos_repasse (status);
create index if not exists veiculos_repasse_marca_idx on public.veiculos_repasse (marca);
create index if not exists veiculos_repasse_preco_idx on public.veiculos_repasse (preco_repasse);
create index if not exists veiculos_repasse_created_idx on public.veiculos_repasse (created_at desc);

-- Políticas RLS da Tabela veiculos_repasse
alter table public.veiculos_repasse enable row level security;

drop policy if exists "veiculos_repasse select anon" on public.veiculos_repasse;
create policy "veiculos_repasse select anon"
  on public.veiculos_repasse for select to anon, authenticated using (true);

drop policy if exists "veiculos_repasse insert anon" on public.veiculos_repasse;
create policy "veiculos_repasse insert anon"
  on public.veiculos_repasse for insert to anon, authenticated with check (true);

drop policy if exists "veiculos_repasse update anon" on public.veiculos_repasse;
create policy "veiculos_repasse update anon"
  on public.veiculos_repasse for update to anon, authenticated using (true) with check (true);

drop policy if exists "veiculos_repasse delete anon" on public.veiculos_repasse;
create policy "veiculos_repasse delete anon"
  on public.veiculos_repasse for delete to anon, authenticated using (true);


-- 1B. TABELA DE LOJISTAS E REPASSADORES CADASTRADOS (ÁREA RESTRITA)
create table if not exists public.repassadores (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  nome_completo text not null,
  cpf_cnpj      text not null,
  nome_loja     text not null,
  cidade        text,
  telefone      text not null unique,
  status        text not null default 'ativo' check (status in ('ativo', 'bloqueado')),
  observacoes   text
);

alter table public.repassadores add column if not exists cidade text;

create index if not exists repassadores_telefone_idx on public.repassadores (telefone);
create index if not exists repassadores_status_idx on public.repassadores (status);

alter table public.repassadores enable row level security;

drop policy if exists "repassadores select anon" on public.repassadores;
create policy "repassadores select anon"
  on public.repassadores for select to anon, authenticated using (true);

drop policy if exists "repassadores insert anon" on public.repassadores;
create policy "repassadores insert anon"
  on public.repassadores for insert to anon, authenticated with check (true);

drop policy if exists "repassadores update anon" on public.repassadores;
create policy "repassadores update anon"
  on public.repassadores for update to anon, authenticated using (true) with check (true);

drop policy if exists "repassadores delete anon" on public.repassadores;
create policy "repassadores delete anon"
  on public.repassadores for delete to anon, authenticated using (true);



-- 2. TABELA DE LEADS / PROPOSTAS DE REPASSE
create table if not exists public.leads_repasse (
  id                bigserial primary key,
  created_at        timestamptz not null default now(),
  lead_id           text not null,
  nome              text not null,
  telefone          text not null,
  cidade            text not null,
  veiculo_id        bigint references public.veiculos_repasse(id) on delete set null,
  veiculo_titulo    text,
  valor_repasse     numeric(12, 2),
  proposta_mensagem text,
  aceitou_termos    boolean not null default true
);

alter table public.leads_repasse enable row level security;

drop policy if exists "leads_repasse insert anon" on public.leads_repasse;
create policy "leads_repasse insert anon"
  on public.leads_repasse for insert to anon, authenticated with check (true);

drop policy if exists "leads_repasse select anon" on public.leads_repasse;
create policy "leads_repasse select anon"
  on public.leads_repasse for select to anon, authenticated using (true);

drop policy if exists "leads_repasse delete anon" on public.leads_repasse;
create policy "leads_repasse delete anon"
  on public.leads_repasse for delete to anon, authenticated using (true);


-- 2B. TABELA DE PROPOSTAS E CONTRAPROPOSTAS DE REPASSADORES
create table if not exists public.propostas_repasse (
  id                    bigserial primary key,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  repassador_id         bigint references public.repassadores(id) on delete set null,
  repassador_nome       text not null,
  repassador_telefone   text not null,
  repassador_loja       text not null,
  repassador_cidade     text,
  veiculo_id            bigint references public.veiculos_repasse(id) on delete set null,
  veiculo_titulo        text not null,
  valor_veiculo         numeric(12, 2) not null,
  valor_proposta        numeric(12, 2) not null,
  mensagem_lojista      text,
  status                text not null default 'pendente' check (status in ('pendente', 'aceita', 'recusada', 'contraproposta')),
  valor_contraproposta  numeric(12, 2),
  resposta_manos        text
);

create index if not exists propostas_repasse_telefone_idx on public.propostas_repasse (repassador_telefone);
create index if not exists propostas_repasse_status_idx on public.propostas_repasse (status);

alter table public.propostas_repasse enable row level security;

drop policy if exists "propostas_repasse insert anon" on public.propostas_repasse;
create policy "propostas_repasse insert anon"
  on public.propostas_repasse for insert to anon, authenticated with check (true);

drop policy if exists "propostas_repasse select anon" on public.propostas_repasse;
create policy "propostas_repasse select anon"
  on public.propostas_repasse for select to anon, authenticated using (true);

drop policy if exists "propostas_repasse update anon" on public.propostas_repasse;
create policy "propostas_repasse update anon"
  on public.propostas_repasse for update to anon, authenticated using (true) with check (true);

drop policy if exists "propostas_repasse delete anon" on public.propostas_repasse;
create policy "propostas_repasse delete anon"
  on public.propostas_repasse for delete to anon, authenticated using (true);


-- 3. BUCKET DE ARMAZENAMENTO DE FOTOS DO COMPUTADOR NO SUPABASE STORAGE
insert into storage.buckets (id, name, public)
values ('fotos-repasse', 'fotos-repasse', true)
on conflict (id) do update set public = true;

-- Políticas de segurança para o Bucket fotos-repasse no Supabase Storage
drop policy if exists "fotos_repasse_select_public" on storage.objects;
create policy "fotos_repasse_select_public"
  on storage.objects for select to public using (bucket_id = 'fotos-repasse');

drop policy if exists "fotos_repasse_insert_public" on storage.objects;
create policy "fotos_repasse_insert_public"
  on storage.objects for insert to anon, authenticated with check (bucket_id = 'fotos-repasse');

drop policy if exists "fotos_repasse_update_public" on storage.objects;
create policy "fotos_repasse_update_public"
  on storage.objects for update to anon, authenticated using (bucket_id = 'fotos-repasse');

drop policy if exists "fotos_repasse_delete_public" on storage.objects;
create policy "fotos_repasse_delete_public"
  on storage.objects for delete to anon, authenticated using (bucket_id = 'fotos-repasse');


-- 4. SEED INICIAL COM VEÍCULOS DE REPASSE DE EXEMPLO (DEMONSTRAÇÃO IMEDIATA)
insert into public.veiculos_repasse (
  titulo, marca, modelo, ano, km, cor, combustivel, cambio, placa_final,
  preco_fipe, preco_repasse, fotos, descricao, observacoes_repasse, destaque, status
)
values 
(
  'Volkswagen Gol 1.6 MSI TotalFlex 8V',
  'Volkswagen',
  'Gol',
  '2019/2020',
  82000,
  'Branca',
  'Flex',
  'Manual',
  '7',
  52400.00,
  39900.00,
  '[
    "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80"
  ]'::jsonb,
  'Completo com ar condicionado, direção hidráulica, vidros elétricos e travas. Excelente estrutura e mecânica confiável.',
  'Veículo de repasse com desconto de R$ 12.500 abaixo da FIPE. Pequenos riscos no para-choque traseiro e detalhe estético no banco do motorista. Documentação 2026 ok, motor e câmbio testados. Vendido no estado sem garantia de loja.',
  true,
  'disponivel'
),
(
  'Chevrolet Onix 1.0 LT Flex 8V',
  'Chevrolet',
  'Onix',
  '2018/2018',
  95000,
  'Prata',
  'Flex',
  'Manual',
  '3',
  54800.00,
  41500.00,
  '[
    "https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1583121274602-3e2820c69888?auto=format&fit=crop&w=1200&q=80"
  ]'::jsonb,
  'Onix LT com MyLink, volante multifuncional, ar condicionado e direção elétrica. Econômico e ótimo para o dia a dia.',
  'Desconto expressivo de R$ 13.300 em relação à Tabela FIPE. Pneus dianteiros com meia vida, pequeno detalhe de pintura na porta direita. Estrutura 100% selada. Repasse direto para giro rápido.',
  true,
  'disponivel'
);
