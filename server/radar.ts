// ---------------------------------------------------------------------------
// AI Visit Radar — logs two real signals into Supabase (table `ai_visits`):
//   1. bot_crawl  -> an AI/search crawler read one of our pages (GPTBot,
//      ClaudeBot, PerplexityBot, Googlebot, Bingbot, ...). Shows WHEN the
//      engines are ingesting our content.
//   2. referral   -> a real human landed here FROM an AI/search engine
//      (chatgpt.com, perplexity.ai, gemini, copilot, bing, google).
// Privacy: we store referrer host + truncated user-agent only, never raw IP.
// Fire-and-forget: logging never blocks or breaks the response.
// ---------------------------------------------------------------------------

import type { Request, Response, NextFunction } from "express";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://jkblxdxnbmciicakusnl.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_a_LZCcUT50c9-2JspQf1aQ_-khIilRb";

// User-agent crawlers (order matters: most specific first)
const BOT_PATTERNS: { re: RegExp; source: string }[] = [
  { re: /GPTBot/i, source: "gptbot" },
  { re: /OAI-SearchBot/i, source: "oai-searchbot" },
  { re: /ChatGPT-User/i, source: "chatgpt-user" },
  { re: /ClaudeBot|Claude-Web|anthropic-ai/i, source: "claudebot" },
  { re: /PerplexityBot/i, source: "perplexitybot" },
  { re: /Perplexity-User/i, source: "perplexity-user" },
  { re: /Google-Extended/i, source: "google-extended" },
  { re: /Googlebot/i, source: "googlebot" },
  { re: /bingbot/i, source: "bingbot" },
  { re: /Applebot/i, source: "applebot" },
  { re: /Bytespider/i, source: "bytespider" },
  { re: /CCBot/i, source: "ccbot" },
  { re: /Amazonbot/i, source: "amazonbot" },
  { re: /meta-externalagent|FacebookBot/i, source: "meta" },
];

function referrerSource(host: string): string | null {
  if (/(^|\.)chatgpt\.com$|(^|\.)openai\.com$/.test(host)) return "chatgpt";
  if (/(^|\.)perplexity\.ai$/.test(host)) return "perplexity";
  if (/(^|\.)gemini\.google\.com$|(^|\.)bard\.google\.com$/.test(host)) return "gemini";
  if (/(^|\.)copilot\.microsoft\.com$/.test(host)) return "copilot";
  if (/(^|\.)claude\.ai$/.test(host)) return "claude";
  if (/(^|\.)bing\.com$/.test(host)) return "bing";
  if (/(^|\.)duckduckgo\.com$/.test(host)) return "duckduckgo";
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return "google";
  return null;
}

function isLoggablePath(path: string): boolean {
  if (path.startsWith("/api") || path.startsWith("/assets") || path.startsWith("/@") || path.startsWith("/src")) {
    return false;
  }
  // skip static assets, but keep .xml/.txt (sitemap/robots/llms are bot signals)
  if (/\.(js|mjs|css|png|jpe?g|webp|svg|ico|gif|woff2?|ttf|map|json)$/i.test(path)) {
    return false;
  }
  return true;
}

function classify(req: Request): { type: string; source: string } | null {
  const ua = String(req.headers["user-agent"] || "");
  for (const b of BOT_PATTERNS) {
    if (b.re.test(ua)) return { type: "bot_crawl", source: b.source };
  }
  const ref = String(req.headers["referer"] || req.headers["referrer"] || "");
  if (ref) {
    try {
      const host = new URL(ref).hostname.toLowerCase();
      const src = referrerSource(host);
      if (src) return { type: "referral", source: src };
    } catch {
      /* malformed referer — ignore */
    }
  }
  return null;
}

function logVisit(req: Request, hit: { type: string; source: string }): void {
  let referrerHost: string | null = null;
  const ref = String(req.headers["referer"] || req.headers["referrer"] || "");
  if (ref) {
    try {
      referrerHost = new URL(ref).hostname.toLowerCase();
    } catch {
      referrerHost = null;
    }
  }

  const row = {
    type: hit.type,
    source: hit.source,
    path: req.path.slice(0, 300),
    referrer: referrerHost,
    user_agent: String(req.headers["user-agent"] || "").slice(0, 300),
  };

  // Fire-and-forget REST insert; never blocks the response.
  fetch(`${SUPABASE_URL}/rest/v1/ai_visits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  })
    .then((r) => {
      if (!r.ok) console.warn(`radar insert non-ok (${r.status}) — check the ai_visits table/RLS`);
    })
    .catch((err) => console.error("radar log failed:", err?.message || err));
}

export function radarMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    if (req.method === "GET" && isLoggablePath(req.path)) {
      const hit = classify(req);
      if (hit) logVisit(req, hit);
    }
  } catch (err) {
    console.error("radar middleware error:", err);
  }
  next();
}
