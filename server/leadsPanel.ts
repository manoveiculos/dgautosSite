// ---------------------------------------------------------------------------
// Painel /leads-manos — responde "qual anúncio traz lead bom".
//
// Custo por lead não decide nada sozinho: uma campanha pode gerar o dobro de
// leads pela metade do preço e ainda assim não fechar negócio nenhum. O que
// decide é o custo por lead QUALIFICADO. Este painel cruza origem x nota.
//
// Sem dado pessoal: nome, telefone e placa ficam no n8n/CRM. Aqui só entram
// tipo, nota, faixa, origem e cidade (ver server/leadStats.ts).
// ---------------------------------------------------------------------------

import type { LinhaLeadScore } from './leadStats';

function esc(input: string): string {
  return (input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface Agregado {
  chave: string;
  total: number;
  quentes: number;
  mornos: number;
  frios: number;
  descartados: number;
  somaScore: number;
}

function agregar(linhas: LinhaLeadScore[], campo: (l: LinhaLeadScore) => string): Agregado[] {
  const mapa = new Map<string, Agregado>();
  for (const l of linhas) {
    const chave = campo(l) || '(sem origem)';
    const a = mapa.get(chave) ?? {
      chave, total: 0, quentes: 0, mornos: 0, frios: 0, descartados: 0, somaScore: 0,
    };
    a.total += 1;
    a.somaScore += l.score;
    if (l.descartado) a.descartados += 1;
    else if (l.faixa === 'quente') a.quentes += 1;
    else if (l.faixa === 'morno') a.mornos += 1;
    else a.frios += 1;
    mapa.set(chave, a);
  }
  // Ordena por leads quentes: a coluna que importa para decidir verba.
  return [...mapa.values()].sort((a, b) => b.quentes - a.quentes || b.total - a.total);
}

function tabela(titulo: string, rotuloChave: string, dados: Agregado[]): string {
  if (!dados.length) return '';
  const linhas = dados
    .map((d) => {
      const pctQuente = d.total ? Math.round((d.quentes / d.total) * 100) : 0;
      return `<tr>
        <td>${esc(d.chave)}</td>
        <td class="n">${d.total}</td>
        <td class="n hot">${d.quentes}</td>
        <td class="n">${d.mornos}</td>
        <td class="n dim">${d.frios}</td>
        <td class="n dim">${d.descartados}</td>
        <td class="n">${Math.round(d.somaScore / Math.max(1, d.total))}</td>
        <td class="n"><span class="bar"><i style="width:${pctQuente}%"></i></span> ${pctQuente}%</td>
      </tr>`;
    })
    .join('\n');

  return `
  <h2>${esc(titulo)}</h2>
  <div class="tw"><table>
    <thead><tr>
      <th>${esc(rotuloChave)}</th><th>Leads</th><th>Quentes</th><th>Mornos</th>
      <th>Frios</th><th>Descartados</th><th>Nota média</th><th>% quente</th>
    </tr></thead>
    <tbody>${linhas}</tbody>
  </table></div>`;
}

export function renderLeadsPanel(linhas: LinhaLeadScore[]): string {
  // Só o lead completo entra nas contas: o parcial é o mesmo lead numa etapa
  // anterior e contaria a mesma pessoa duas vezes.
  const completos = linhas.filter((l) => l.stage === 'completo');
  const parciais = linhas.filter((l) => l.stage === 'parcial');

  const quentes = completos.filter((l) => !l.descartado && l.faixa === 'quente').length;
  const descartados = completos.filter((l) => l.descartado).length;
  const notaMedia = completos.length
    ? Math.round(completos.reduce((s, l) => s + l.score, 0) / completos.length)
    : 0;
  // Quantos deixaram contato e não terminaram o funil — o resgate mais barato
  // que existe, e que antes nem era visível.
  const abandonos = Math.max(0, parciais.length - completos.length);

  const css = `
*{box-sizing:border-box}
body{margin:0;background:#0A0A0A;color:#fff;font-family:Inter,system-ui,Arial,sans-serif;line-height:1.5}
.wrap{max-width:1100px;margin:0 auto;padding:24px 20px 80px}
header{display:flex;align-items:center;gap:14px;padding:16px 20px;border-bottom:1px solid #1c1c1c}
header img{height:32px}
h1{font-size:26px;font-weight:800;letter-spacing:-.02em;margin:18px 0 4px}
h2{font-size:17px;font-weight:800;margin:32px 0 10px}
.muted{color:#9a9a9a}.small{font-size:13px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:20px 0}
.tile{background:#141414;border:1px solid #1f1f1f;border-radius:14px;padding:14px 16px}
.tile b{display:block;font-size:12px;color:#9a9a9a;font-weight:600;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px}
.tile span{font-size:30px;font-weight:800;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.tile span.hot{color:#ED1C24}
.tw{overflow-x:auto;border:1px solid #1f1f1f;border-radius:14px;background:#141414}
table{width:100%;border-collapse:collapse;font-size:14px;min-width:640px}
th,td{text-align:left;padding:10px 14px;border-bottom:1px solid #1f1f1f;white-space:nowrap}
th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9a9a9a;background:#181818}
tbody tr:last-child td{border-bottom:0}
td.n{font-variant-numeric:tabular-nums;font-weight:700}
td.hot{color:#ED1C24}td.dim{color:#7a7a7a;font-weight:400}
.bar{display:inline-block;width:60px;height:6px;background:#232323;border-radius:99px;overflow:hidden;vertical-align:middle;margin-right:6px}
.bar i{display:block;height:100%;background:#ED1C24}
.nota{background:#141414;border:1px solid #1f1f1f;border-left:3px solid #ED1C24;border-radius:12px;padding:14px 16px;margin:24px 0;color:#cfcfcf;font-size:14px}
footer{border-top:1px solid #1c1c1c;margin-top:40px;padding:20px;color:#7a7a7a;font-size:12px}`;

  const vazio = !linhas.length
    ? `<div class="nota">
        Nenhum lead registrado ainda. Se o funil já está no ar, confira se a tabela
        <code>lead_scores</code> existe no Supabase e se a policy de insert para
        <code>anon</code> está ativa — o SQL está em <code>server/leadStats.ts</code>.
      </div>`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Leads por origem e nota — DG Automóveis</title>
<style>${css}</style>
</head>
<body>
<header>
  <img src="/logo-dg.png" alt="DG Automóveis">
  <span class="muted small">Painel interno</span>
</header>
<div class="wrap">
  <h1>Leads por origem e nota</h1>
  <p class="muted small">Últimos ${linhas.length} registros. Sem dado pessoal — nome e telefone ficam no CRM.</p>

  ${vazio}

  <div class="tiles">
    <div class="tile"><b>Leads completos</b><span>${completos.length}</span></div>
    <div class="tile"><b>Quentes</b><span class="hot">${quentes}</span></div>
    <div class="tile"><b>Nota média</b><span>${notaMedia}</span></div>
    <div class="tile"><b>Contatos sem finalizar</b><span>${abandonos}</span></div>
    <div class="tile"><b>Descartados</b><span>${descartados}</span></div>
  </div>

  ${tabela('Por canal', 'Canal', agregar(completos, (l) => l.canal ?? ''))}
  ${tabela('Por campanha', 'utm_campaign', agregar(completos.filter((l) => l.utm_campaign), (l) => l.utm_campaign ?? ''))}
  ${tabela('Por criativo', 'utm_content', agregar(completos.filter((l) => l.utm_content), (l) => l.utm_content ?? ''))}
  ${tabela('Por tipo de negócio', 'Tipo', agregar(completos, (l) => l.lead_type))}
  ${tabela('Por cidade', 'Cidade', agregar(completos.filter((l) => l.cidade), (l) => l.cidade ?? ''))}

  <div class="nota">
    <strong>Como ler:</strong> compare as campanhas pela coluna <em>% quente</em>, não pelo total de leads.
    Uma campanha com muitos leads e pouca nota está gastando verba para encher a fila do consultor.
    Os pesos da nota estão em <code>server/scoring.ts</code> — depois de uns 200 leads, cruze nota
    com negócio fechado e recalibre.
  </div>
</div>
<footer>DG Automóveis — painel interno. Não indexado.</footer>
</body>
</html>`;
}
