# Próximos passos — funil de conversão

> **Situação em 18/09/2026.** Tudo já foi mesclado na `main` e publicado — a
> hospedagem publica sozinha a cada push (ver [DEPLOY.md](DEPLOY.md)). O que
> falta é **configuração em sistemas externos**: nada disso quebra o site, mas
> cada item desliga um número em silêncio.
>
> Verificado direto na produção nesta data:
>
> | Item | Estado |
> |---|---|
> | 2. Tabela `lead_scores` | ✅ **feita** — já gravando leads reais |
> | 5. Senha do painel | ❌ **pendente** — `/leads-manos` responde **503**, nunca abriu |
> | 6. Meta CAPI (token) | ✅ **feito** — `meta_capi: configurado` |
> | 6b. Evento `Purchase` | ❌ **pendente** — `sem META_WEBHOOK_SECRET`, nenhuma venda é reportada |
> | 9. Mapeamento do catálogo | ❌ **pendente** — eventos saem com o id da Altimus |
> | 8. OpenAI Ads CAPI | ❌ **pendente** — `sem OPENAI_ADS_API_KEY` |
>
> Confira a qualquer momento com:
> `curl -s https://manosveiculoscompra.com/api/health/tracking`

Ordem sugerida pelo retorno: **6b → 9 → 5 → 10 → 8 → 3 → 4 → 7**.

> **Onde se configura:** no app Node.js do hPanel, não em `.env` de máquina
> local nem em VPS. O `deploy.sh` e o `pm2` que aparecem em textos antigos
> deste repositório descrevem uma infra que não é a que está no ar.

---

## 1. Subir em homologação e percorrer os dois funis no celular

```bash
git checkout cro/funil-conversao-2026-08
npm ci && npm run build
NODE_ENV=production node server.js
```

Percorra **no celular**, não no desktop — é onde está o tráfego:

- [ ] Home abre com carros visíveis e busca funcionando
- [ ] Tocar num carro leva direto à tela de contato, **com o carro na tela**
- [ ] Buscar um modelo que não existe (ex.: "Ferrari") mostra saída, não tela branca
- [ ] "Avaliar meu Carro agora" leva ao `/vendasrapidas`
- [ ] Financiamento: o botão "Finalizar" aparece na tela do formulário
- [ ] Link da Política de Privacidade abre
- [ ] Recarregar no meio do funil retoma de onde parou
- [ ] Abrir um carro em `/estoque`, clicar "Tenho interesse" e conferir que ele
      aparece na tela de contato
- [ ] `/estoque/qualquer-coisa-inventada` mostra "Esse carro já foi vendido"
- [ ] Desligar o JavaScript no navegador e abrir `/` → tem que aparecer telefone,
      WhatsApp e endereço (não tela preta)

> Se algo estiver visualmente errado, me diga antes de ir para produção. O que eu
> validei foi lógica, rotas e build — a sensação das telas novas no aparelho não
> tem como eu julgar daqui.

---

## 2. Supabase — criar a tabela `lead_scores` ✅ FEITO

A tabela existe, a RLS está correta e já há leads reais gravados (um mesmo
`lead_id` nos estágios `parcial` e `completo`, que é o comportamento esperado:
uma pessoa, dois momentos, sem duplicar).

Nada a fazer aqui. O texto abaixo fica como referência de como foi montada.

O SQL está pronto em **[`supabase/lead_scores.sql`](supabase/lead_scores.sql)** —
abrir o arquivo, copiar tudo, colar no **SQL Editor** do Supabase e dar Run.
Pode rodar mais de uma vez sem quebrar nada.

Além da tabela, ele cria:

- índice único em `(lead_id, stage)` — o servidor grava com upsert, então
  reenvio atualiza a nota em vez de contar a mesma pessoa duas vezes
- índices para o painel (data, campanha, canal)
- as policies de RLS para `anon`

No fim do arquivo há três consultas prontas em comentário: últimos registros,
desempenho por campanha, e a **fila de contatos que não finalizaram**.

Não há dado pessoal nessa tabela de propósito — nome, telefone e placa ficam só
no n8n/CRM, que tem controle de acesso. Se um dia entrar qualquer campo pessoal
ali, troque a chave para a service role e feche o `select`.

**Conferir:** abrir `/api/health/tracking`. O campo `lead_scores` deve sair de
"sem registros ainda" para "gravando" depois do primeiro lead.

> **Limpar o registro de teste.** Ao validar a tabela eu gravei uma linha
> `_smoke_test_` pelo caminho real (REST + chave publishable) para confirmar que
> o upsert funciona. Ela ainda está lá e apareceria no painel. Rode uma vez:
>
> ```sql
> delete from public.lead_scores where lead_id = '_smoke_test_';
> ```

---

## 3. n8n — deduplicar por `lead_id` ⚠️ o mais importante

**Sem este passo o volume de registros dobra.** Cada lead agora chega duas vezes
no mesmo webhook:

| Quando | `stage` | Conteúdo |
|---|---|---|
| A pessoa digita nome e WhatsApp | `parcial` | contato + carro (se já escolheu) |
| A pessoa termina o funil | `completo` | tudo + qualificação |

Os dois carregam o **mesmo `lead_id`**. Nos três workflows (Compra, Venda,
Financiamento) e no de Vendas Rápidas:

1. Buscar registro existente por `lead_id`
2. Se existir → **atualizar**; se não → criar
3. Nunca sobrescrever campo preenchido com valor vazio (o parcial tem menos dados
   que o completo)

### Campos novos que chegam no payload

| Campo | Para que serve |
|---|---|
| `lead_id` | chave de deduplicação |
| `stage` | `parcial` ou `completo` |
| `score` | 0 a 100 |
| `faixa` | `quente` / `morno` / `frio` |
| `score_motivos` | lista em texto — mostrar direto para o consultor |
| `acao_recomendada` | `ligar_agora_meta_5min` / `fila_do_dia_whatsapp` / `nutricao_automatica` / `descartar_telefone_invalido` |
| `fora_do_raio` | fora da área de atendimento (não é descarte) |
| `atribuicao` | canal, utm_*, gclid, fbclid, first_touch |

### Roteamento sugerido

- `faixa = quente` → notificação imediata ao consultor de plantão, meta de 5 min
- `faixa = morno` → fila normal do dia, WhatsApp
- `faixa = frio` → automação, sem consumir consultor
- `stage = parcial` sem completo depois de 30 min → mensagem de retomada citando
  o carro que a pessoa estava olhando (é o resgate mais barato que existe, e
  antes nem era visível)

---

## 4. GTM — criar os gatilhos

O código já publica os eventos no `dataLayer`. Falta o GTM escutar.
Container: `GTM-MNL7Z6XR`.

| Evento | O que fazer |
|---|---|
| `lead` | **Conversão principal** do Google Ads + evento `generate_lead` no GA4 |
| `lead_parcial` | Conversão **secundária** (marcar como "secundária" no Google Ads) |
| `funnel_start`, `funnel_step` | Eventos GA4, para ver onde as pessoas param |
| `select_vehicle`, `view_vehicle` | Eventos GA4 |
| `contato_direto` | Eventos GA4 (cliques em WhatsApp e telefone) |

**Não deixe `lead_parcial` como conversão principal.** O lance passaria a
otimizar por quem só deixa telefone, que é exatamente o oposto do que queremos.

Variáveis do dataLayer que vale criar no GTM: `lead_tipo`, `canal`,
`utm_source`, `utm_campaign`, `utm_content`, `value`, `event_id`.

**Conferir:** modo Preview do GTM, percorrer o funil, ver `lead` disparar uma vez.

---

## 5. Senha do painel `/leads-manos` ⚠️ PENDENTE — e está bloqueando você

Conferido em 19/08/2026: o painel responde **503**. Ou seja, `PANEL_PASSWORD`
nunca foi definida e **o painel nunca abriu para ninguém** — inclusive para
você. Os leads estão sendo gravados, mas não há como olhá-los pela interface.

É o item de maior retorno imediato da lista: dois minutos de configuração
destravam a leitura de tudo que já está sendo medido.

O painel está protegido por Basic Auth, e **falha fechada**: sem senha definida
ele responde 503 em vez de ficar aberto. Ou seja, ou você configura, ou o painel
não abre para ninguém.

No `.env` do servidor:

```bash
PANEL_USER="manos"
PANEL_PASSWORD="cole-aqui-a-senha-gerada"
```

Gerar uma senha longa:

```bash
openssl rand -base64 24
```

Depois de gravar a variável no hPanel, reinicie/republique o app — o processo
só enxerga valores novos ao subir de novo.

**Conferir:** abrir `/leads-manos` no navegador — tem que aparecer a caixa de
usuário e senha. O resto do site (`/`, `/estoque`, `/vendasrapidas`) continua
público, sem senha nenhuma.

> Basic Auth trafega a senha em base64, não criptografada — só é seguro sobre
> HTTPS. O site já está em HTTPS, então está tudo certo; só não use essa senha
> em nenhum outro lugar.

---

## 6. Meta — Conversions API ✅ TOKEN FEITO

`META_CAPI_TOKEN` está configurado desde 18/09/2026 e o health responde
`meta_capi: configurado`. Os eventos de lead agora saem pelos dois caminhos com
o mesmo `event_id`, e o envio do servidor leva `_fbp`, `_fbc`, `external_id`,
telefone, nome e cidade.

**Validar quando houver tráfego:** com `META_TEST_EVENT_CODE` preenchido por
alguns minutos, complete um lead e confira em "Eventos de teste" que o `Lead`
aparece **uma vez**, como "Navegador e servidor". Duas linhas = `event_id` não
está casando. Apague o código de teste depois, senão os eventos reais continuam
contando como teste.

### 6b. Evento `Purchase` ⚠️ PENDENTE — nenhuma venda é medida hoje

Não existe checkout no site: "compra" só existe quando o CRM marca a venda como
fechada. O gancho é `POST /api/meta/venda-confirmada`, protegido por segredo
compartilhado — e **sem `META_WEBHOOK_SECRET` ele responde 503**, ou seja,
nenhuma venda vira evento.

```bash
META_WEBHOOK_SECRET="$(openssl rand -base64 24)"
```

O CRM chama assim (a `placa` é o que permite achar o produto certo no catálogo;
o `event_id` deve ser o id da venda, para reenvio não contar duas vezes):

```bash
curl -s -X POST https://manosveiculoscompra.com/api/meta/venda-confirmada \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $META_WEBHOOK_SECRET" \
  -d '{"event_id":"venda-123","placa":"ABC1D23","value":89900,
       "phone":"5547999998888","name":"Maria","city":"Rio do Sul",
       "external_id":"id-do-visitante-guardado-na-captura"}'
```

A resposta diz o que aconteceu: `content_id` preenchido quando o mapeamento
resolveu a placa, ou um `aviso` explicando por que não resolveu.

### Qualidade da correspondência

Desde 18/09 todo evento carrega um `external_id` — um id anônimo por visitante,
em cookie de primeira parte (`manos_vid`, 2 anos), lido tanto pelo pixel quanto
pelo Express. Na captura do lead, nome e telefone também entram no advanced
matching do pixel. É o que o CRM deve guardar junto do lead para devolver no
`Purchase`, semanas depois.

---

## 8. OpenAI Ads — pixel e Conversions API ⚠️ PENDENTE

Anúncios dentro do ChatGPT. O código está pronto e publicado; falta a chave.

Em Ads Manager → Conversões → **Criar chave de conversão**. Depois, no `.env` do
servidor:

```bash
OPENAI_ADS_API_KEY="a-chave-gerada"
OPENAI_ADS_PIXEL_ID="QhX8YkwW1KcmEMR9JPQD8Q"
VITE_OPENAI_ADS_PIXEL_ID="QhX8YkwW1KcmEMR9JPQD8Q"
```

As duas últimas recebem o mesmo id: uma é lida no build do front, a outra em
tempo de execução no servidor (as páginas SSR do catálogo carregam o pixel por
outro caminho). Como a `VITE_*` é lida no build, mudá-la exige **republicar** o
app, não só reiniciar.

**Conferir:** `/api/health/tracking` deve mostrar `"openai_ads_capi":
"configurado"`.

Detalhes de eventos, deduplicação e validação estão em
**[RASTREAMENTO-OPENAI-ADS.md](RASTREAMENTO-OPENAI-ADS.md)**.

---

## 9. Catálogo da Meta — mapeamento placa → content_id ⚠️ PENDENTE

O catálogo do Gerenciador de Comércio é alimentado pela Autos 360, que numera os
veículos do jeito dela: o `id` do feed da Altimus — que o site manda em todos os
eventos — **não** é o `content_id` que a Meta conhece. Confirmado com um veículo
real (Altimus `3563862` = catálogo `3405412`, mesmo nome e mesmo preço). A
Altimus foi acionada e não fornece essa correspondência.

Enquanto isso não for resolvido, a taxa de correspondência do catálogo fica em
**0% mesmo com o pixel perfeito** — foram sempre dois problemas independentes.

`server/catalogSync.ts` resolve sozinho, casando nome normalizado + preço contra
o catálogo lido pela Graph API. Para ligar:

1. Rodar `supabase/vehicle_meta_mapping.sql` no SQL Editor.
2. Gerar um token de System User com permissão `catalog_management` no catálogo
   (Configurações da Empresa → Usuários do sistema) — é **diferente** do token do
   CAPI.
3. No hPanel: `META_CATALOG_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY` e
   `INTERNAL_SYNC_SECRET`.
4. Rodar uma vez à mão e olhar o resultado antes de agendar:
   ```bash
   curl -s -X POST https://manosveiculoscompra.com/api/internal/sync-catalog-mapping \
     -H "x-internal-secret: $INTERNAL_SYNC_SECRET"
   ```
5. Agendar de hora em hora com `pg_cron` + `pg_net` (SQL no comentário da rota,
   em `server.ts`).

Essa primeira rodada é a prova da tese: se vier quase tudo `exact`, a
correspondência por nome e preço funciona. Muito `unmatched` significa que os
nomes do catálogo divergem mais do que o exemplo sugeria — nesse caso, revisar o
critério antes de usar isso para atribuir venda.

**Conferir:** `/api/health/tracking` deve mostrar
`"meta_catalogo_mapping": "configurado"`.

---

## 9b. Catálogo da Meta — feed próprio (resolve a causa, não o sintoma)

O mapeamento do item 9 é um contorno: ele adivinha, por nome e preço, qual
produto da Autos 360 corresponde a qual veículo nosso. A correção de raiz é o
catálogo deixar de ser alimentado por terceiro e passar a ler um feed nosso, em
que o `vehicle_id` **é** o `id` da Altimus que o pixel já envia. Aí a
correspondência é exata por construção e o `catalogSync` vira redundante.

Duas URLs, porque a Meta valida o arquivo contra o **tipo** do catálogo e os
nomes das colunas mudam entre eles (`server/metaFeed.ts`):

| Tipo do catálogo no Gerenciador de Comércio | URL para colar |
|---|---|
| **Veículos** (anúncios de inventário automotivo) | `https://manosveiculoscompra.com/feeds/meta/veiculos.csv` |
| **E-commerce / Produtos** | `https://manosveiculoscompra.com/feeds/meta/produtos.csv` |

Colar a errada dá erro de coluna obrigatória ausente **na hora do upload**, não
silenciosamente depois — dá para testar as duas sem risco.

Onde colar: Gerenciador de Comércio → Catálogo → **Fontes de dados** →
*Usar um URL ou o Planilhas Google*. Sem usuário e sem senha: as rotas são
públicas. Agendamento **diário** basta — o estoque gira em dias, não em horas.

Cuidados que já custaram tempo neste projeto:

- A URL só funciona **depois do deploy**. Antes disso o catch-all do SPA
  responde `200` com HTML para qualquer caminho, então a Meta aceita o endereço
  e falha ao ler o arquivo. Conferir com
  `curl -sI .../feeds/meta/veiculos.csv | grep content-type` → tem que ser
  `text/csv`.
- Se o catálogo continuar recebendo o feed da Autos 360 em paralelo, cada
  veículo entra **duas vezes**, com ids diferentes, e o problema de
  correspondência volta pela outra porta. Uma fonte de dados por catálogo.
- `?preview=1` devolve as mesmas linhas em JSON, para conferir o conteúdo sem
  abrir o CSV.

---

## 10. Duplicação de PageView — investigação em aberto

Diagnóstico de 18/09/2026, no breakdown por fonte do `PageView`:

| Fonte | Volume |
|---|---|
| Browser | 2.389 |
| Integração direta e parceiros da API de Conversões | 3.457 |
| API de Conversões com a Meta | 2.877 |

**Este servidor nunca envia `PageView` pela Conversions API** — só `Lead`,
`QualifiedLead`, `AddToCart` e `Purchase`. Os dois baldes server-side vêm de
integração configurada fora deste repositório.

Isso explica a nota baixa de correspondência melhor que qualquer outra hipótese:
só 27% dos eventos vêm do navegador, e a cobertura de `_fbp` medida é 23% —
`_fbp` é cookie de navegador, então evento server-side sem ele conta como zero.

- Em 18/09 o recurso de enriquecimento automático da Meta foi **desligado**.
  Observar se o balde "API de Conversões com a Meta" cai.
- Se o balde "integração direta e parceiros" continuar alto, a origem é uma tag
  no GTM (container `GTM-MNL7Z6XR`) repassando `{{Event}}` do dataLayer como
  nome de evento da Meta. O código já manda os eventos com nomes próprios e
  `event_id`; a tag do GTM duplicaria tudo sem desduplicação.

Também em 18/09, a tag `<noscript>` do pixel foi removida das páginas do
catálogo: ela disparava um `PageView` por carregamento de imagem, sem JS e
portanto sem cookie nenhum, e o catálogo é a superfície mais visitada por
crawler do site.

---

## 7. Primeira semana — o que olhar

Abra `/leads-manos` (protegido por senha, ver passo 5).

Quatro números que antes não existiam:

1. **Contatos sem finalizar** — gente que deixou telefone e não terminou. Antes
   era invisível; agora é fila de resgate.
2. **% de quentes por campanha** — compare as campanhas por esta coluna, **não**
   pelo total de leads. Campanha com muito lead e pouca nota está enchendo a fila
   do consultor sem trazer negócio.
3. **Nota média por canal** — decide onde colocar verba.
4. **Custo por lead qualificado** — cruze o gasto da plataforma com a contagem de
   quentes, não com o total.

Depois de uns **200 leads com nota gravada**, cruze nota × negócio fechado e
recalibre os pesos em `server/scoring.ts`. Os pesos atuais são um ponto de
partida defensável, não verdade revelada.

---

## Pendências conhecidas

- **O funil não está recebendo tráfego.** Levantamento de 15 dias em agosto: o
  radar registrou 481 leituras de robô e **1 visita humana** vinda de busca.
  No mesmo período o CRM recebeu 184 leads — todos por WhatsApp, Google e
  Facebook, nenhum pelo funil. Nada disso é defeito de código: as campanhas não
  estão apontando para cá. É a pendência de maior impacto da lista.
- **Largura de 500px no desktop.** Não mexi: alargar a casca mexe na composição
  de todas as telas e eu não teria como avaliar o resultado visual daqui. Veja a
  home nova primeiro e decida.
- **Descarte por geografia.** No plano eu tinha escrito que lead fora da área
  seria descartado. Implementei como sinal negativo, não veto — só telefone
  inválido descarta. O campo `fora_do_raio` está no payload se você quiser
  endurecer.
- **Lista de cidades atendidas** em `server/scoring.ts` foi montada por mim a
  partir do Alto Vale + litoral. Vale revisar se falta alguma praça sua.
