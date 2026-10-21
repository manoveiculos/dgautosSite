# Manos Veículos — funil de compra

Aplicação de `manosveiculoscompra.com`: captação e qualificação de leads para a
Manos Veículos, revenda de seminovos em Rio do Sul/SC.

> O site institucional é outro (`manosveiculos.com.br`, WordPress). Este repositório
> é só o funil e o catálogo indexável.

## Duas superfícies, propósitos diferentes

| | O que é | Para quem |
|---|---|---|
| **Funil** (`/`, `/vendasrapidas`) | SPA em React, client-side | pessoa vinda de anúncio |
| **Catálogo** (`/estoque`, `/sobre`, `/perguntas-frequentes`) | HTML renderizado no servidor, com JSON-LD | buscador e motor de IA |

A separação é proposital: o funil é interativo e invisível para crawler; o
catálogo é HTML completo, legível sem JavaScript, e existe para o estoque
aparecer em resposta do Google e do ChatGPT.

O estoque dos dois vem do mesmo feed XML da Altimus, com cache de 10 minutos.

## Stack

Vite + React 19 + Tailwind 4 no front. Express no back (SSR do catálogo, APIs de
lead, proxies). Supabase para métricas. Hospedado na Hostinger, com publicação automática a
partir da branch `main` (ver DEPLOY.md).

## Rodar localmente

```bash
npm install
npm run dev      # tsx watch server.ts — sobe Express + Vite juntos
```

Copie `.env.example` para `.env` e preencha o que for usar. Nenhuma variável é
obrigatória para subir: o app funciona com os recursos que faltam desligados.

```bash
npm run build    # gera dist/ (front) e server.js (back)
npm run lint     # tsc --noEmit
```

## Rotas principais

| Rota | O que faz |
|---|---|
| `/` | funil de compra, venda e financiamento |
| `/vendasrapidas` | avaliação rápida do usado, com consulta de placa |
| `/estoque`, `/estoque/:slug` | catálogo SSR indexável (filtros por marca e faixa de preço) |
| `/bolao`, `/radar-manos` | campanhas sazonais |
| `/leads-manos` | painel interno de leads por origem e nota (Basic Auth) |
| `/feeds/openai/products.parquet` | catálogo para os anúncios do OpenAI Ads |
| `/api/health/tracking` | diagnóstico da mensuração |
| `/sitemap.xml`, `/robots.txt`, `/llms.txt` | superfície para crawler |

## Documentação

| Arquivo | Assunto |
|---|---|
| [DEPLOY.md](DEPLOY.md) | como publicar e o que conferir depois |
| [RASTREAMENTO-OPENAI-ADS.md](RASTREAMENTO-OPENAI-ADS.md) | pixel e Conversions API do OpenAI Ads |
| [PROXIMOS-PASSOS.md](PROXIMOS-PASSOS.md) | configuração pendente em sistemas externos |
| [supabase/lead_scores.sql](supabase/lead_scores.sql) | tabela de notas de lead |

## Princípio que atravessa o código

**Mensuração nunca derruba a entrega do lead.** Todo envio para plataforma de
anúncio é fire-and-forget e falha em silêncio. Se o pixel, o Supabase ou a
Conversions API caírem, o lead continua chegando no consultor.
