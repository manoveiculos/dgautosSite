-- ---------------------------------------------------------------------------
-- Agendamento da sincronização placa -> content_id do catálogo da Meta.
--
-- RODAR SÓ DEPOIS de uma execução manual bem-sucedida da rota. Agendar antes
-- disso só repete o mesmo erro de hora em hora:
--
--   curl -s -X POST https://manosveiculoscompra.com/api/internal/sync-catalog-mapping \
--     -H "x-internal-secret: <INTERNAL_SYNC_SECRET>"
--
-- Pré-requisitos (já conferidos em 18/09/2026 neste projeto):
--   - extensões pg_cron e pg_net habilitadas;
--   - segredo guardado no Vault com o nome `internal_sync_secret`, com o MESMO
--     valor da variável INTERNAL_SYNC_SECRET no hPanel.
--
-- O segredo fica no Vault, e não escrito aqui, porque a definição de um job do
-- pg_cron é legível em `cron.job` por quem tiver acesso ao banco.
-- ---------------------------------------------------------------------------

-- Gravar/atualizar o segredo no Vault (só quando o valor mudar):
--
--   select vault.create_secret('<valor>', 'internal_sync_secret', 'Segredo da rota de sync do catálogo');
--
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'internal_sync_secret'),
--     '<novo valor>'
--   );

-- Minuto 7 de propósito: os outros jobs do projeto rodam no minuto 0, e não há
-- motivo para disputar a mesma janela.
select cron.schedule(
  'sync-catalog-mapping-hourly',
  '7 * * * *',
  $$
  select net.http_post(
    url := 'https://manosveiculoscompra.com/api/internal/sync-catalog-mapping',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'internal_sync_secret')
    ),
    timeout_milliseconds := 60000
  );
  $$
);

-- ---------------------------------------------------------------------------
-- Conferir depois da primeira hora
-- ---------------------------------------------------------------------------

-- O job rodou? (status 'succeeded' aqui significa que o SQL rodou, não que o
-- site respondeu 200 — a resposta HTTP é assíncrona, ver a consulta seguinte.)
-- select j.jobname, d.status, d.return_message, d.start_time
-- from cron.job_run_details d
-- join cron.job j using (jobid)
-- where j.jobname = 'sync-catalog-mapping-hourly'
-- order by d.start_time desc
-- limit 5;

-- O que o site respondeu:
-- select id, status_code, left(content, 400) as resposta, created
-- from net._http_response
-- order by created desc
-- limit 5;
--   200 = sincronizou (o corpo traz matched/needsReview/unmatched)
--   401 = o segredo do Vault não bate com o do hPanel
--   503 = INTERNAL_SYNC_SECRET não está configurado no hPanel

-- Resultado do mapeamento em si:
-- select match_confidence, count(*)
-- from public.vehicle_meta_mapping
-- group by 1 order by 2 desc;

-- Veículos que precisam de olho humano (não usar para atribuir venda):
-- select placa, altimus_id, matched_name, match_confidence
-- from public.vehicle_meta_mapping
-- where needs_review or meta_content_id is null;

-- Desligar o agendamento:
-- select cron.unschedule('sync-catalog-mapping-hourly');
