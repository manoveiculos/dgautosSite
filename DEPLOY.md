# Deploy — manosveiculoscompra.com

App = Vite/React (funil) + Express (SSR do catálogo para AEO + APIs).

## Como o deploy acontece hoje

**Publicação automática a partir do GitHub.** Um push na `main` entra no ar
sozinho, em poucos minutos. Não há comando de deploy para rodar.

Produção roda na **Hostinger, gerenciada pelo hPanel, atrás da CDN deles**
(os cabeçalhos da resposta dizem `platform: hostinger`, `panel: hpanel`,
`Server: hcdn`). Confirmado na prática em 15/09 e 18/09/2026: os commits
apareceram no ar minutos depois do push, sem ninguém executar nada no servidor.

> ⚠️ **`deploy.sh` e `ecosystem.config.cjs` não são usados.** Eles descrevem um
> outro arranjo — VPS com PM2 — que este site não usa. Ficam no repositório como
> referência caso a hospedagem mude. Se você estiver seguindo um passo a passo
> com `pm2 reload`, `git pull` no servidor ou SSH: **é o passo a passo errado**,
> e foi essa confusão que já custou tempo antes.

### Variáveis de ambiente

Ficam **no app Node.js do hPanel** (ou no `.env` da pasta do app, pelo
Gerenciador de Arquivos) — nunca no `.env` da sua máquina, que não sai daí.
Depois de alterar, reinicie/republique o app para o processo enxergar os valores
novos; um deploy também reinicia.

Uma variável `VITE_*` é lida no **build** do front, não em tempo de execução —
mudar uma delas exige nova publicação, não só reinício.

## Conferir se um deploy entrou

A CDN cacheia as páginas por 10 minutos (`Cache-Control: public, max-age=600`),
então acrescente uma query para furar o cache ao testar:

```bash
curl -s "https://manosveiculoscompra.com/api/health/tracking?nocache=1" 
curl -s "https://manosveiculoscompra.com/estoque?nocache=1" | grep -c fbevents
```

O `/api/health/tracking` é o jeito mais rápido de saber **qual build está
rodando e o que está configurado**: se um campo que você acabou de criar não
aparece ali, o build antigo ainda está no ar.

## Checklist a cada deploy

1. **Feed do OpenAI Ads** — tem que responder Parquet, não HTML:
   ```bash
   curl -sI https://manosveiculoscompra.com/feeds/openai/products.parquet
   ```
   Espera-se `Content-Type: application/vnd.apache.parquet`. Se vier
   `text/html`, a rota caiu no catch-all da SPA. Para revisar o conteúdo sem
   abrir o binário: mesma URL com `?preview=1`.

2. **Mensuração** — `curl -s https://manosveiculoscompra.com/api/health/tracking`
   responde o estado de cada integração. Em `lead_scores`, as mensagens são
   distintas de propósito:
   - `INACESSÍVEL (...)` → conserto de tabela/RLS;
   - `tabela ok e gravável, porém nenhum lead registrado até agora` → falta
     tráfego, não tem defeito;
   - `gravando — N registro(s), último em ...` → funcionando.

3. **Pixels nas DUAS superfícies**, que carregam por caminhos diferentes:
   ```bash
   curl -s "https://manosveiculoscompra.com/?nocache=1" | grep -c fbevents        # funil
   curl -s "https://manosveiculoscompra.com/estoque?nocache=1" | grep -c fbevents # catálogo SSR
   curl -s "https://manosveiculoscompra.com/estoque?nocache=1" | grep -c oaiq     # OpenAI Ads
   ```
   Zero em alguma delas = variável de pixel faltando naquele caminho. O pixel da
   Meta tem id padrão no código, então zero ali significa outra coisa (erro de
   build); o do OpenAI Ads depende de `OPENAI_ADS_PIXEL_ID`/`VITE_...`.

4. **Deduplicação** — no Gerenciador de Eventos, a mesma conversão aparece
   **uma vez**, marcada como "Navegador e servidor". Se aparecer duas, o
   `event_id` não está casando entre pixel e Conversions API.

> **Medição não roda fora de produção.** Os pixels e os envios server-side são
> desligados quando o host é `localhost`/`127.0.0.1`/`.local`. Isso existe
> porque máquina de desenvolvimento chegou a mandar milhares de eventos por dia
> para o dataset real, e eles entram no cálculo de qualidade da correspondência
> como se fossem visita de verdade. Para testar de propósito, use o
> `META_TEST_EVENT_CODE` (modo "Eventos de teste") ou um dataset separado.

## Variáveis que o servidor espera

Ver `.env.example` para a lista completa e os comentários. Sem elas o app sobe,
mas com recursos desligados em silêncio:

| Variável | Sem ela |
|---|---|
| `PANEL_PASSWORD` | `/leads-manos` responde 503 (falha fechada, de propósito) |
| `META_CAPI_TOKEN` | envio server-side para a Meta é ignorado; só o pixel do navegador reporta |
| `META_WEBHOOK_SECRET` | `/api/meta/venda-confirmada` responde 503 — **nenhuma venda vira evento `Purchase`** |
| `META_CATALOG_ACCESS_TOKEN` | sem mapeamento de catálogo: os eventos saem com o id da Altimus, que o catálogo da Meta não reconhece |
| `SUPABASE_SERVICE_ROLE_KEY` | idem — a tabela do mapeamento é service-role-only |
| `INTERNAL_SYNC_SECRET` | `/api/internal/sync-catalog-mapping` responde 503 |
| `META_PIXEL_ID` | opcional; sem ela usa o dataset de produção embutido no código (vale para a CAPI e as páginas SSR) |
| `VITE_META_PIXEL_ID` | o mesmo id, lido no build do funil; sem ela o funil fica no dataset embutido, e trocar só uma das duas separa funil e catálogo |
| `OPENAI_ADS_API_KEY` | Conversions API do OpenAI Ads não envia |
| `OPENAI_ADS_PIXEL_ID` | idem — a CAPI precisa dos dois |
| `VITE_OPENAI_ADS_PIXEL_ID` | o pixel do OpenAI Ads não inicializa em nenhuma superfície |

As duas variáveis de pixel do OpenAI Ads recebem o **mesmo id**: uma é lida no
build do front, a outra em tempo de execução no servidor.

## Supabase (uma vez por tabela)

Rodar no SQL Editor, na ordem que precisar:

- `supabase/lead_scores.sql` — radar de qualificação de leads (tabela anônima,
  usa a chave publishable).
- `supabase/vehicle_meta_mapping.sql` — mapeamento placa → `content_id` do
  catálogo da Meta (guarda placa, então é service-role-only).

## Mapeamento do catálogo da Meta

O catálogo do Gerenciador de Comércio é alimentado pela Autos 360, que numera os
veículos do jeito dela — o `id` do feed da Altimus **não** é o `content_id` que a
Meta conhece. Sem a tradução, a taxa de correspondência fica em 0% mesmo com o
pixel perfeito.

`server/catalogSync.ts` resolve isso casando o feed com o catálogo por nome
normalizado, usando o preço como trava. Para rodar uma sincronização:

```bash
curl -s -X POST https://manosveiculoscompra.com/api/internal/sync-catalog-mapping \
  -H "x-internal-secret: $INTERNAL_SYNC_SECRET"
```

A resposta traz `matched`, `needsReview`, `unmatched`, `marcadosForaDeEstoque` e
`purgados`, além da lista do que precisa de olho humano. Agende de hora em hora
com `pg_cron` + `pg_net` (o SQL está no comentário da rota, em `server.ts`).

Match aproximado sai marcado como `needs_review`: serve para `ViewContent`, mas
o evento de venda o recusa de propósito — produto errado numa venda credita
dinheiro ao veículo errado.

## Desenvolvimento local

```bash
npm ci
npm run build          # gera dist/ e server.js (ambos gitignored)
NODE_ENV=production node server.js
```

Sem `NODE_ENV=production` o servidor tenta subir em modo dev/Vite.
