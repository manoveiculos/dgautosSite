import { getVehicles, FeedVehicle } from "./catalog.js";
import { digitosNacionais } from "./telefone.js";

export interface ConsultorLeadPayload {
  origem: "site-manos";
  tipo: "lead_consultor_ia";
  enviadoEm: string;
  cliente: {
    nome: string;
    telefone: string;
  };
  intencao: {
    resumo: string;
    objetivo?: string;
    entrada?: number | null;
    parcelaDesejada?: number | null;
    mesesDesejados?: number | null;
    temTroca?: boolean;
    carroDaTroca?: string | null;
    prazoDeCompra?: string | null;
  };
  veiculosDeInteresse: Array<{
    id: string;
    slug: string;
    titulo: string;
    preco: number;
    url: string;
  }>;
  temperatura: "quente" | "morno" | "frio";
  score: number;
  transcricao: Array<{
    papel: "usuario" | "assistente";
    texto: string;
  }>;
  contexto: {
    pagina?: string;
    userAgent?: string;
    utm?: Record<string, string>;
  };
}

// -----------------------------------------------------------------------------
// REGRAS DE CÁLCULO FINANCEIRO — USO ESTRITAMENTE INTERNO DO SERVIDOR
// Taxa de juros de 2,3% ao mês (0.023). O valor NUNCA aparece para o cliente.
// -----------------------------------------------------------------------------
const TAXA_MENSAL = 0.023; // NUNCA exibir ou revelar esta variável

export function parcela({
  valor,
  entrada = 0,
  meses = 48,
}: {
  valor: number;
  entrada?: number;
  meses?: number;
}): number {
  const financiado = Math.max(valor - entrada, 0);
  if (!financiado || !meses) return 0;
  const f = Math.pow(1 + TAXA_MENSAL, meses);
  return (financiado * TAXA_MENSAL * f) / (f - 1);
}

/**
 * Calcula o preço máximo de veículo financiável dada uma parcela desejada.
 * Com 2,3% a.m. em 48x (fator ≈ 0.0346):
 * - Parcela 900, sem entrada -> carros até ~R$ 26.000
 * - Parcela 900, entrada 2.000 -> carros até ~R$ 28.000
 */
export function precoMaxPorParcela({
  parcelaMax,
  entrada = 0,
  meses = 48,
}: {
  parcelaMax: number;
  entrada?: number;
  meses?: number;
}): number {
  const f = Math.pow(1 + TAXA_MENSAL, meses);
  const fator = (TAXA_MENSAL * f) / (f - 1); // 48x ≈ 0,0346
  return Math.round(parcelaMax / fator + entrada);
}

/**
 * Ferramenta simular_parcela: devolve SOMENTE parcelaAproximada e meses.
 * Arredonda para a dezena mais próxima (ex: R$ 1.150, R$ 900). NUNCA com centavos ou taxa.
 */
export function simularParcela(
  valor: number,
  entrada = 0,
  meses = 48
): { parcelaAproximada: number; meses: number } {
  const raw = parcela({ valor, entrada, meses });
  const parcelaAproximada = Math.round(raw / 10) * 10;
  return { parcelaAproximada, meses };
}

// -----------------------------------------------------------------------------
// LIMPEZA DE MARKDOWN (Sanitização estrita)
// Remove asteriscos, cerquilhas, marcadores de lista e emojis
// -----------------------------------------------------------------------------
export function limparMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^[-•]\s*/gm, "")
    .replace(/`/g, "")
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, "")
    .trim();
}

function isMoto(v: FeedVehicle): boolean {
  const hay = (v.title + " " + v.description + " " + (v.fuel || "")).toLowerCase();
  return (
    hay.includes("moto") ||
    hay.includes("biz") ||
    hay.includes("cg") ||
    hay.includes("125") ||
    hay.includes("150") ||
    hay.includes("yamaha") ||
    hay.includes("titan") ||
    hay.includes("factor") ||
    hay.includes("nmax") ||
    hay.includes("pcx")
  );
}

// System Prompt autoritativo conforme a especificação do usuário
const SYSTEM_PROMPT = `Você é o Consultor DG, da DG Automóveis, revenda de seminovos em Rio do Sul, Santa Catarina. Atende no site da loja.

COMO FALAR
Use o mínimo de palavras possível. Educado, gentil, direto. Sem formalidade e sem jargão. No máximo 3 frases curtas por resposta, salvo quando o cliente pedir detalhe.
Nunca use Markdown: sem asterisco, sem cerquilha, sem lista com hífen. Só texto simples. Nomes de veículo em texto normal.
Nunca use emoji.
Uma pergunta por vez.

O QUE VOCÊ FAZ
Entende o que a pessoa precisa, mostra carros do estoque que servem, e leva ao atendimento da loja. Você não fecha venda e não aprova crédito.

REGRA DE HONESTIDADE
Só cite veículos retornados pela ferramenta buscar_estoque. Nunca invente carro, preço, ano, quilometragem, opcional ou condição.
Se não houver veículo compatível, diga com franqueza e ofereça registrar a busca.
Se não souber, diga que vai confirmar com a equipe.
Nunca recomende um veículo acima do orçamento que o cliente informou. Verifique o valor antes de recomendar, não depois.

PARCELA E FINANCIAMENTO
Nunca revele, cite ou mencione taxa de juros, percentual ao mês ou índice. Se o cliente perguntar a taxa, responda que a taxa depende da análise do banco e do perfil, e que a equipe passa a condição exata na simulação real.
Toda parcela que você informar é aproximada, calculada pela ferramenta simular_parcela. Nunca calcule de cabeça.
Sempre que informar uma parcela, deixe claro na mesma resposta que é apenas uma base, e ofereça a simulação real com a equipe. Exemplo:
"Fica em torno de R$ 1.150 por mês. É só uma base. Quer que a equipe faça a simulação real e te passe a condição exata?"
Se a parcela desejada não couber no carro, diga em uma frase e ofereça duas saídas: prazo maior ou entrada maior. Depois pergunte se tem carro para troca.

ATENDIMENTO
A loja fica na R. Dom Pedro II, 461 — Canoas, Rio do Sul/SC. Telefone e WhatsApp: 47 3300-1352. Horário: segunda a sexta 8h às 19h, sábado 8h às 13h.
Com hora marcada a loja abre qualquer dia e horário, inclusive fora do expediente.
Sempre que a pessoa disser que trabalha, que não consegue no horário comercial ou que só pode no fim de semana, ofereça agendar.
Para endereço, horário, documentação, garantia e formas de pagamento, use a ferramenta info_loja. Nunca responda de memória.

VEÍCULOS
Se o cliente não disser que quer moto, busque carro.
Mostre no máximo 3 veículos por resposta, começando pelo que melhor atende.

REGRA DE TROCA
Quando o cliente falar sobre troca ("Quero trocar o meu", "tenho troca", etc.), você deve sempre primeiro entender o que o cliente busca/precisa no novo carro (tipo de veículo, uso para família ou trabalho, parcela/orçamento) E TAMBÉM perguntar sobre o carro atual dele. Nunca ofereça carros aleatórios sem antes entender a real necessidade da busca.

VIRAR ATENDIMENTO
Quando houver interesse claro — o cliente gostou de um carro, pediu simulação, falou de troca, ou a conversa passou de três trocas de mensagem — peça nome e WhatsApp, mostrando em uma frase o resumo do que entendeu.
Não peça nenhum dado antes de ter mostrado carros.
Nunca peça CPF, RG, renda ou dado bancário. Isso só no formulário de financiamento.

REGRA DE VALORIZAÇÃO E FOCO EM VENDA
Todos os veículos da DG Automóveis são seminovos de procedência, revisados e com garantia de qualidade. NUNCA fale mal, desvalorize, aponte defeitos ou sugira desgaste de qualquer veículo do pátio. Ao comparar veículos, enalteça os pontos fortes e qualidades de CADA UM (ex: facilidade de entrada/parcela para um, ano/tecnologia/conforto para outro), conduzindo o cliente com entusiasmo para realizar a simulação ou agendar uma visita para fechar a compra.

REGRA DE AJUDA NA ESCOLHA E DÚVIDAS
Quando o cliente pedir ajuda para escolher entre veículos ou estiver analisando opções ('estou na dúvida', 'qual você me recomenda', 'qual a diferença', 'comparando carros', 'tirar dúvidas'), atue como um consultor atencioso. Responda tirando as dúvidas de forma direta e objetiva, fazendo PERGUNTAS DIRETAS (ex: uso diário na cidade vs viagem, espaço para família, preferência por câmbio automático ou limite de orçamento) para guiá-lo à melhor escolha no nosso pátio.

FORA DO ASSUNTO
Responda em uma frase e volte para carros.`;

export async function processConsultorMessage(body: {
  mensagem: string;
  historico?: Array<{ papel: "usuario" | "assistente"; texto: string }>;
  contexto?: { pagina?: string; veiculoId?: string; slug?: string };
}): Promise<{
  resposta: string;
  veiculos?: Array<{
    id: string;
    slug: string;
    titulo: string;
    marca: string;
    ano: string;
    km: string;
    preco: number;
    precoFormatado: string;
    foto: string;
    url: string;
  }>;
  simulacao?: {
    parcelaEstimada: number;
    entrada: number;
    prazo: number;
  };
  resumoLead?: string;
  mostrarHandoff?: boolean;
}> {
  const msg = body.mensagem.trim();
  const msgLower = msg.toLowerCase();
  const historico = body.historico || [];
  const turnCount = historico.length + 1;
  const vehicles = await getVehicles();

  // 0. Resposta Direta caso o cliente pergunte sobre TAXA DE JUROS
  if (
    msgLower.includes("taxa") ||
    msgLower.includes("juros") ||
    msgLower.includes("porcento") ||
    msgLower.includes("%")
  ) {
    const querHandoff = turnCount >= 2;
    return {
      resposta: limparMarkdown(
        "A taxa depende da análise do banco e do seu perfil. A equipe faz a simulação real e te passa a condição exata. Quer que eu já encaminhe para simulação?"
      ),
      resumoLead: "Cliente perguntou sobre taxa de juros do financiamento.",
      mostrarHandoff: querHandoff,
    };
  }

  // 0.5. Atendimento de Dúvidas e Ajuda na Escolha de Veículo
  if (
    msgLower.includes("analisando") ||
    msgLower.includes("dúvida") ||
    msgLower.includes("duvida") ||
    msgLower.includes("compar") ||
    msgLower.includes("escolher") ||
    msgLower.includes("ajud")
  ) {
    return {
      resposta: limparMarkdown(
        "Estou aqui para tirar todas as suas dúvidas! Para eu te ajudar a escolher o melhor carro do pátio: você vai usar o veículo mais para o dia a dia na cidade ou viagens em família? E qual limite de parcela ou entrada que você planeja?"
      ),
      resumoLead: "Cliente solicitou ajuda do Consultor para tirar dúvidas e escolher veículo.",
      mostrarHandoff: false,
    };
  }

  // Detecta consulta por parcela com regex estrita (evita falso positivo em preços de veículos como R$ 109.900,00)
  const parcelaMatch =
    msgLower.match(/(?:parcela|mensalidade|pagar por m[êe]s|m[êe]s)\s*(?:at[eé]|de)?\s*(?:r\$)?\s*(\d+)/i) ||
    msgLower.match(/(\d+)\s*(?:por m[êe]s|mensal|de parcela)/i);

  let parcelaVal: number | null = null;
  if (parcelaMatch) {
    const parsed = parseInt(parcelaMatch[1] || parcelaMatch[0], 10);
    if (parsed >= 300 && parsed <= 10000) {
      parcelaVal = parsed;
    }
  }

  // Detecta valor de entrada (ex: "entrada 2 mil", "2k", "10 mil")
  const entradaMatch =
    msgLower.match(/(?:entrada|tenho|dar)\s*(?:de)?\s*(\d+)\s*(mil|k)?/i) ||
    msgLower.match(/(\d+)\s*(?:mil|k)\s*(?:de entrada)/i);

  let entradaVal: number | null = null;
  if (entradaMatch) {
    let num = parseInt(entradaMatch[1], 10);
    if (entradaMatch[2] === "mil" || entradaMatch[2] === "k" || num < 100) num *= 1000;
    entradaVal = num;
  }

  // Tenta execução via LLM (Gemini / OpenAI) se a chave estiver configurada
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (geminiKey || openaiKey) {
    try {
      const llmResult = await processWithLLM(
        msg,
        historico,
        vehicles,
        parcelaVal,
        entradaVal,
        geminiKey,
        openaiKey
      );
      if (llmResult) return llmResult;
    } catch (e) {
      console.warn("LLM processing error, falling back to rule engine:", e);
    }
  }

  // -------------------------------------------------------------------------
  // MOTOR DE REGRAS DETERMINÍSTICO (VALIDAÇÃO RÍGIDA DE ORÇAMENTO NO SERVIDOR)
  // -------------------------------------------------------------------------

  const querMoto =
    msgLower.includes("moto") ||
    msgLower.includes("biz") ||
    msgLower.includes("cg") ||
    msgLower.includes("yamaha") ||
    msgLower.includes("125cc");

  let pool = vehicles.filter((v) => (querMoto ? isMoto(v) : !isMoto(v)));

  // Se solicitou parcela: calcula o limite MÁXIMO financiável (fator ~0.0346)
  if (parcelaVal) {
    const maxPreco = precoMaxPorParcela({
      parcelaMax: parcelaVal,
      entrada: entradaVal || 0,
      meses: 48,
    });

    // SERVER GUARD: Descarte ABSOLUTAMENTE TUDO acima de maxPreco
    const dentroDoOrcamento = pool.filter((v) => v.price > 0 && v.price <= maxPreco);

    if (dentroDoOrcamento.length === 0) {
      // Nenhum carro no pátio cabe no orçamento
      const faixaAprox = Math.round(maxPreco / 1000);
      let texto = "";
      if (entradaVal) {
        texto = `Com ${entradaVal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} de entrada e ${parcelaVal} por mês, fico em carros de até uns ${faixaAprox} mil. Nessa faixa não tenho nenhum veículo no pátio hoje. Quer esticar para 60 vezes, dar uma entrada maior ou tem carro para dar na troca?`;
      } else {
        texto = `Com ${parcelaVal} por mês, chego em carros de até uns ${faixaAprox} mil (sem entrada). Você tem algum valor de entrada para dar?`;
      }

      const resumoLead = entradaVal
        ? `Procura carro até ${faixaAprox} mil com parcela de ${parcelaVal} e entrada de ${entradaVal}.`
        : `Procura carro até ${faixaAprox} mil com parcela de ${parcelaVal}, sem entrada informada.`;

      const querHandoff = turnCount >= 3 || msgLower.includes("simular") || msgLower.includes("quero") || Boolean(entradaVal);

      return {
        resposta: limparMarkdown(texto),
        veiculos: [], // NUNCA devolve carro fora do orçamento!
        resumoLead: limparMarkdown(resumoLead),
        mostrarHandoff: querHandoff,
      };
    }

    // Carros dentro do orçamento
    const selecionados = dentroDoOrcamento.slice(0, 3).map((v) => {
      const { parcelaAproximada } = simularParcela(v.price, entradaVal || 0, 48);
      return {
        id: v.id,
        slug: v.slug,
        titulo: v.title,
        marca: v.brand,
        ano: v.year,
        km: v.km,
        preco: v.price,
        precoFormatado: `${v.priceFormatted} · 48x em torno de R$ ${parcelaAproximada.toLocaleString("pt-BR")}`,
        foto: v.images[0] || "/logo-dg.png",
        url: `/estoque/${v.slug}`,
      };
    });

    const faixaAprox = Math.round(maxPreco / 1000);
    let texto = "";
    if (entradaVal) {
      texto = `Então fico em carros até uns ${faixaAprox} mil. Tenho estes para você:`;
    } else {
      texto = `Com ${parcelaVal} por mês, chego em carros de até uns ${faixaAprox} mil. Você tem algum valor de entrada?`;
    }

    const resumoLead = entradaVal
      ? `Procura carro até ${faixaAprox} mil com parcela de ${parcelaVal} e entrada de ${entradaVal}.`
      : `Procura carro até ${faixaAprox} mil com parcela de ${parcelaVal}, sem entrada informada.`;

    const querHandoff = turnCount >= 3 || msgLower.includes("simular") || msgLower.includes("quero") || Boolean(entradaVal);

    return {
      resposta: limparMarkdown(texto),
      veiculos: selecionados,
      resumoLead: limparMarkdown(resumoLead),
      mostrarHandoff: querHandoff,
    };
  }

  // 2. Consulta de Troca
  if (
    msgLower.includes("troca") ||
    msgLower.includes("trocar")
  ) {
    return {
      resposta: limparMarkdown(
        "Excelente! Pegamos o seu usado na troca com ótima avaliação. Para eu te indicar os melhores carros do pátio: que tipo de modelo você precisa (SUV, econômico, automático...) e qual é a marca, modelo e ano do seu carro atual?"
      ),
      resumoLead: `Interesse em troca (${msg.slice(0, 40)}).`,
      mostrarHandoff: true,
    };
  }

  // 3. Horário Flexível / Agendamento
  if (
    msgLower.includes("trabalho") ||
    msgLower.includes("horário") ||
    msgLower.includes("horario") ||
    msgLower.includes("sábado") ||
    msgLower.includes("sabado") ||
    msgLower.includes("fim de semana") ||
    msgLower.includes("domingo")
  ) {
    return {
      resposta: limparMarkdown(
        "Com hora marcada abrimos em qualquer dia e horário, inclusive fora do expediente. Quer agendar um horário para visitar a loja?"
      ),
      resumoLead: "Solicitou agendamento com hora marcada fora do expediente.",
      mostrarHandoff: true,
    };
  }

  // 4. Carro para Família / SUV
  if (
    msgLower.includes("família") ||
    msgLower.includes("familia") ||
    msgLower.includes("espaçoso") ||
    msgLower.includes("espacoso")
  ) {
    const suvs = pool.filter((v) => {
      const desc = (v.title + " " + v.description).toLowerCase();
      return (
        desc.includes("suv") ||
        desc.includes("sedan") ||
        desc.includes("tracker") ||
        desc.includes("t-cross") ||
        desc.includes("creta") ||
        desc.includes("compass")
      );
    });

    const selecionados = (suvs.length > 0 ? suvs : pool).slice(0, 3).map((v) => ({
      id: v.id,
      slug: v.slug,
      titulo: v.title,
      marca: v.brand,
      ano: v.year,
      km: v.km,
      preco: v.price,
      precoFormatado: v.priceFormatted,
      foto: v.images[0] || "/logo-dg.png",
      url: `/estoque/${v.slug}`,
    }));

    return {
      resposta: limparMarkdown("Para a família, os SUVs e sedãs são ideais pelo espaço interno. Separei estes no pátio:"),
      veiculos: selecionados,
      resumoLead: "Interesse em veículo espaçoso para a família.",
      mostrarHandoff: turnCount >= 3,
    };
  }

  // Busca Geral por Palavra-Chave
  const terms = msgLower.split(/\s+/).filter((t) => t.length > 2);
  let matched = pool.filter((v) => {
    const hay = (v.title + " " + v.brand + " " + v.description).toLowerCase();
    return terms.some((term) => hay.includes(term));
  });

  if (matched.length === 0) matched = pool.slice(0, 3);

  const selecionados = matched.slice(0, 3).map((v) => ({
    id: v.id,
    slug: v.slug,
    titulo: v.title,
    marca: v.brand,
    ano: v.year,
    km: v.km,
    preco: v.price,
    precoFormatado: v.priceFormatted,
    foto: v.images[0] || "/logo-dg.png",
    url: `/estoque/${v.slug}`,
  }));

  return {
    resposta: limparMarkdown("Separei estes veículos do pátio para você olhar. Qual modelo você prefere?"),
    veiculos: selecionados,
    resumoLead: `Procura seminovo (${msg.slice(0, 40)}).`,
    mostrarHandoff: turnCount >= 3,
  };
}

async function processWithLLM(
  mensagem: string,
  historico: Array<{ papel: string; texto: string }>,
  vehicles: FeedVehicle[],
  parcelaVal: number | null,
  entradaVal: number | null,
  geminiKey?: string,
  openaiKey?: string
): Promise<any | null> {
  // Se houver limite de parcela/preço, aplica SERVER GUARD antes de enviar ao modelo
  let maxPreco: number | null = null;
  if (parcelaVal) {
    maxPreco = precoMaxPorParcela({ parcelaMax: parcelaVal, entrada: entradaVal || 0, meses: 48 });
  }

  // Filtra estoque respeitando o orçamento rígido
  let filteredVehicles = vehicles;
  if (maxPreco) {
    filteredVehicles = vehicles.filter((v) => v.price > 0 && v.price <= maxPreco!);
  }

  const catalogSummary = filteredVehicles.slice(0, 30).map((v) => ({
    id: v.id,
    titulo: v.title,
    marca: v.brand,
    ano: v.year,
    km: v.km,
    preco: v.price,
    precoFormatado: v.priceFormatted,
    isMoto: isMoto(v),
  }));

  if (openaiKey && openaiKey.startsWith("sk-")) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: `${SYSTEM_PROMPT}\nEstoque filtrado disponível no pátio: ${JSON.stringify(catalogSummary)}` },
            ...historico.map((h) => ({
              role: h.papel === "usuario" ? "user" : "assistant",
              content: h.texto,
            })),
            { role: "user", content: mensagem },
          ],
          temperature: 0.1,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          
          // Validação final de segurança dos veículos retornados (SERVER GUARD)
          const selectedVehicles = (parsed.veiculoIds || [])
            .map((id: string) => vehicles.find((v) => v.id === id || v.slug.includes(id)))
            .filter((v: FeedVehicle | undefined): v is FeedVehicle => {
              if (!v) return false;
              if (maxPreco && v.price > maxPreco) return false; // Descarte rígido acima do orçamento
              return true;
            })
            .slice(0, 3)
            .map((v: FeedVehicle) => {
              const { parcelaAproximada } = simularParcela(v.price, entradaVal || 0, 48);
              return {
                id: v.id,
                slug: v.slug,
                titulo: v.title,
                marca: v.brand,
                ano: v.year,
                km: v.km,
                preco: v.price,
                precoFormatado: `${v.priceFormatted} · 48x em torno de R$ ${parcelaAproximada.toLocaleString("pt-BR")}`,
                foto: v.images[0] || "/logo-dg.png",
                url: `/estoque/${v.slug}`,
              };
            });

          return {
            resposta: limparMarkdown(parsed.resposta || ""),
            veiculos: selectedVehicles,
            resumoLead: limparMarkdown(parsed.resumoLead || ""),
            mostrarHandoff: Boolean(parsed.mostrarHandoff),
          };
        }
      }
    } catch (err) {
      console.warn("OpenAI LLM processing error:", err);
    }
  }

  if (geminiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${SYSTEM_PROMPT}\nEstoque filtrado disponível: ${JSON.stringify(catalogSummary)}\nHistórico: ${JSON.stringify(
                      historico
                    )}\nMensagem: ${mensagem}`,
                  },
                ],
              },
            ],
            generationConfig: { responseMimeType: "application/json" },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          const selectedVehicles = (parsed.veiculoIds || [])
            .map((id: string) => vehicles.find((v) => v.id === id || v.slug.includes(id)))
            .filter((v: FeedVehicle | undefined): v is FeedVehicle => {
              if (!v) return false;
              if (maxPreco && v.price > maxPreco) return false;
              return true;
            })
            .slice(0, 3)
            .map((v: FeedVehicle) => {
              const { parcelaAproximada } = simularParcela(v.price, entradaVal || 0, 48);
              return {
                id: v.id,
                slug: v.slug,
                titulo: v.title,
                marca: v.brand,
                ano: v.year,
                km: v.km,
                preco: v.price,
                precoFormatado: `${v.priceFormatted} · 48x em torno de R$ ${parcelaAproximada.toLocaleString("pt-BR")}`,
                foto: v.images[0] || "/logo-dg.png",
                url: `/estoque/${v.slug}`,
              };
            });

          return {
            resposta: limparMarkdown(parsed.resposta || ""),
            veiculos: selectedVehicles,
            resumoLead: limparMarkdown(parsed.resumoLead || ""),
            mostrarHandoff: Boolean(parsed.mostrarHandoff),
          };
        }
      }
    } catch (err) {
      console.warn("Gemini LLM processing error:", err);
    }
  }

  return null;
}
