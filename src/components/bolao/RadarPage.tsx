import React, { useState, useEffect, useMemo } from 'react';
import { Lock, RefreshCw, Bot, MousePointerClick, Activity, Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const ADMIN_PASSWORD = (import.meta as any).env?.VITE_BOLAO_ADMIN_PASSWORD || (import.meta as any).env?.VITE_ADMIN_PASSWORD || '';

interface AiVisit {
  id: number;
  created_at: string;
  type: 'bot_crawl' | 'referral' | string;
  source: string;
  path: string | null;
  referrer: string | null;
  user_agent: string | null;
}

// Friendly labels for known sources
const LABELS: Record<string, string> = {
  gptbot: 'GPTBot (OpenAI)',
  'oai-searchbot': 'OAI-SearchBot',
  'chatgpt-user': 'ChatGPT (navegando)',
  claudebot: 'ClaudeBot (Anthropic)',
  perplexitybot: 'PerplexityBot',
  'perplexity-user': 'Perplexity (navegando)',
  googlebot: 'Googlebot',
  'google-extended': 'Google-Extended',
  bingbot: 'Bingbot',
  applebot: 'Applebot',
  bytespider: 'Bytespider (TikTok)',
  ccbot: 'CCBot (Common Crawl)',
  amazonbot: 'Amazonbot',
  meta: 'Meta AI',
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  copilot: 'Copilot',
  claude: 'Claude',
  bing: 'Bing',
  google: 'Google',
  duckduckgo: 'DuckDuckGo',
};

const label = (s: string) => LABELS[s] || s;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function RadarPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [visits, setVisits] = useState<AiVisit[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('ai_visits')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3000);
      if (error) throw error;
      setVisits((data || []) as AiVisit[]);
    } catch (e) {
      console.error('radar load error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authed) load();
  }, [authed]);

  const crawls = useMemo(() => visits.filter((v) => v.type === 'bot_crawl'), [visits]);
  const referrals = useMemo(() => visits.filter((v) => v.type === 'referral'), [visits]);

  const bySource = (list: AiVisit[]) => {
    const map: Record<string, number> = {};
    list.forEach((v) => (map[v.source] = (map[v.source] || 0) + 1));
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  };

  const crawlSources = useMemo(() => bySource(crawls), [crawls]);
  const referralSources = useMemo(() => bySource(referrals), [referrals]);

  // Last 14 days timeline (total events per day)
  const timeline = useMemo(() => {
    const days: { day: string; crawl: number; ref: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ day: key, crawl: 0, ref: 0 });
    }
    const idx: Record<string, number> = {};
    days.forEach((d, i) => (idx[d.day] = i));
    visits.forEach((v) => {
      const key = v.created_at.slice(0, 10);
      if (key in idx) {
        if (v.type === 'bot_crawl') days[idx[key]].crawl++;
        else if (v.type === 'referral') days[idx[key]].ref++;
      }
    });
    return days;
  }, [visits]);

  const maxDay = Math.max(1, ...timeline.map((d) => d.crawl + d.ref));
  const lastActivity = visits[0] ? timeAgo(visits[0].created_at) : '—';

  if (!authed) {
    return (
      <div className="min-h-screen bg-manos-dark text-white flex items-center justify-center p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (password === ADMIN_PASSWORD) setAuthed(true);
            else setPwError('Senha incorreta.');
          }}
          className="w-full max-w-sm space-y-6 text-center"
        >
          <div className="w-16 h-16 bg-manos-red/10 border border-manos-red/20 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-manos-red" />
          </div>
          <h1 className="text-2xl font-black italic uppercase tracking-tighter">
            Radar de <span className="text-manos-red">IA</span>
          </h1>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => { setPassword(e.target.value); setPwError(''); }}
            className="w-full py-4 px-5 bg-[#1A1A1A] border border-white/10 rounded-2xl outline-none text-center tracking-widest"
            placeholder="Senha de acesso"
          />
          {pwError && <p className="text-xs text-red-400 font-bold">{pwError}</p>}
          <button className="w-full py-4 bg-manos-red text-white font-black uppercase rounded-2xl active:scale-95 transition-all">
            Entrar
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-manos-dark text-white">
      <header className="flex items-center justify-between px-5 py-4 border-b border-white/5 sticky top-0 bg-manos-dark/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-manos-red" />
          <h1 className="text-sm font-black uppercase tracking-tighter italic">Radar de IA — DG Automóveis</h1>
        </div>
        <button onClick={load} disabled={loading} className="text-white/50 hover:text-white p-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <main className="max-w-5xl mx-auto p-5 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card icon={<Bot className="w-4 h-4 text-manos-red" />} label="Rastreios de IA" value={crawls.length} />
          <Card icon={<MousePointerClick className="w-4 h-4 text-green-500" />} label="Visitas vindas de IA" value={referrals.length} />
          <Card icon={<Search className="w-4 h-4 text-yellow-500" />} label="Fontes distintas" value={new Set(visits.map((v) => v.source)).size} />
          <Card icon={<Activity className="w-4 h-4 text-white/60" />} label="Última atividade" value={lastActivity} />
        </div>

        {visits.length === 0 && !loading && (
          <div className="card-glass p-6 text-center text-sm text-white/40 italic">
            Nenhum registro ainda. Assim que os robôs de IA rastrearem o site (ou alguém chegar via ChatGPT/Perplexity), aparece aqui.
          </div>
        )}

        {/* Timeline */}
        <div className="card-glass p-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-white/60 mb-4">Atividade — últimos 14 dias</h2>
          <div className="flex items-end gap-1.5 h-32">
            {timeline.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="w-full flex flex-col justify-end h-28">
                  <div className="w-full bg-green-500/70 rounded-t" style={{ height: `${(d.ref / maxDay) * 100}%` }} title={`${d.ref} visitas`} />
                  <div className="w-full bg-manos-red/70" style={{ height: `${(d.crawl / maxDay) * 100}%` }} title={`${d.crawl} rastreios`} />
                </div>
                <span className="text-[8px] text-white/30">{d.day.slice(8, 10)}/{d.day.slice(5, 7)}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-[10px] text-white/40">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-manos-red/70 rounded-sm" /> Rastreios de robôs</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500/70 rounded-sm" /> Visitas reais de IA</span>
          </div>
        </div>

        {/* By source */}
        <div className="grid sm:grid-cols-2 gap-4">
          <SourceList title="Quem está rastreando (robôs de IA)" rows={crawlSources} color="bg-manos-red/70" empty="Nenhum robô rastreou ainda." />
          <SourceList title="De onde vêm as visitas reais" rows={referralSources} color="bg-green-500/70" empty="Nenhuma visita de IA/busca ainda." />
        </div>

        {/* Recent */}
        <div className="card-glass p-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-white/60 mb-3">Atividade recente</h2>
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto custom-scrollbar">
            {visits.slice(0, 100).map((v) => (
              <div key={v.id} className="flex items-center gap-3 text-xs py-2 border-b border-white/5">
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${v.type === 'bot_crawl' ? 'bg-manos-red/15 text-manos-red' : 'bg-green-500/15 text-green-400'}`}>
                  {v.type === 'bot_crawl' ? 'rastreio' : 'visita'}
                </span>
                <span className="font-bold text-white/90 w-40 truncate">{label(v.source)}</span>
                <span className="text-white/40 flex-1 truncate font-mono">{v.path}</span>
                <span className="text-white/30 w-12 text-right">{timeAgo(v.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function Card({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="card-glass p-4">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-[9px] font-black uppercase tracking-widest text-white/40">{label}</span></div>
      <p className="text-2xl font-black italic tracking-tighter">{value}</p>
    </div>
  );
}

function SourceList({ title, rows, color, empty }: { title: string; rows: [string, number][]; color: string; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="card-glass p-4">
      <h2 className="text-xs font-black uppercase tracking-wider text-white/60 mb-3">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-xs text-white/30 italic py-3">{empty}</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map(([src, count]) => (
            <div key={src} className="flex items-center gap-3">
              <span className="text-xs text-white/70 w-40 truncate">{label(src)}</span>
              <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full ${color} rounded-full`} style={{ width: `${(count / max) * 100}%` }} />
              </div>
              <span className="text-xs font-black text-white/60 w-8 text-right">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
