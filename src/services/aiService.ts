import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || '';

let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  try {
    aiClient = new GoogleGenAI({ apiKey });
  } catch (err) {
    console.warn('Could not initialize GoogleGenAI client:', err);
  }
}

export interface VehicleAiPromptParams {
  titulo: string;
  marca: string;
  modelo: string;
  ano: string;
  km: number;
  cor: string;
  combustivel: string;
  cambio: string;
  preco_fipe: number;
  preco_repasse: number;
  detalhes_extras?: string;
}

/**
 * Gera legenda de Observações do Repasse com Inteligência Artificial.
 */
export async function gerarObservacoesIA(params: VehicleAiPromptParams): Promise<string> {
  const economia = params.preco_fipe - params.preco_repasse;
  const pct = Math.round((economia / params.preco_fipe) * 100);

  const prompt = `Você é um especialista em vendas automotivas da DG Automóveis.
Escreva um texto curto, transparente e persuasivo para a seção "Observações do Repasse" de um anúncio de carro.

Dados do veículo:
- Veículo: ${params.titulo} (${params.ano})
- KM: ${params.km.toLocaleString('pt-BR')} km | Cor: ${params.cor} | Câmbio: ${params.cambio}
- Tabela FIPE: R$ ${params.preco_fipe.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Valor de Repasse: R$ ${params.preco_repasse.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Desconto FIPE: R$ ${economia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${pct}% abaixo da FIPE)
${params.detalhes_extras ? `- Detalhes informados: ${params.detalhes_extras}` : ''}

Requisitos:
1. Destaque a economia de R$ ${economia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} abaixo da FIPE.
2. Explique com transparência total que é um veículo repassado no estado de conservação em que se encontra, sem garantia de loja.
3. Mencione que a documentação está 100% ok e quitada, pronta para transferência.
4. Mantenha o texto em no máximo 3 frases diretas e profissionais. Não use hashtags ou emojis excessivos.`;

  if (aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      if (response.text) {
        return response.text.trim();
      }
    } catch (err) {
      console.warn('Gemini API call failed, falling back to smart template generator:', err);
    }
  }

  // Fallback didático caso a chave da API não esteja configurada no ambiente
  return `Veículo de repasse com desconto exclusivo de R$ ${economia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} abaixo da Tabela FIPE (${pct}% de desconto). Vendido no estado de conservação em que se encontra, sem garantia mecânica de loja de varejo. Documentação 2026 quitada, sem débitos, pronta para transferência imediata.`;
}

/**
 * Gera a Descrição Completa do Veículo com Inteligência Artificial.
 */
export async function gerarDescricaoIA(params: VehicleAiPromptParams): Promise<string> {
  const prompt = `Você é um especialista em redação publicitária da DG Automóveis.
Escreva uma descrição completa e elegante para um anúncio de veículo de repasse.

Dados do veículo:
- Veículo: ${params.titulo}
- Marca: ${params.marca} | Modelo: ${params.modelo} | Ano: ${params.ano}
- KM: ${params.km.toLocaleString('pt-BR')} km | Cor: ${params.cor} | Câmbio: ${params.cambio} | Combustível: ${params.combustivel}

Requisitos:
1. Apresente os principais atributos de conforto, economia e dirigibilidade do veículo.
2. Destaque que é uma excelente oportunidade tanto para uso diário quanto para revendedores buscando margem rápida.
3. Mantenha o tom profissional, atraente e honesto. Máximo de 2 parágrafos curtos.`;

  if (aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      if (response.text) {
        return response.text.trim();
      }
    } catch (err) {
      console.warn('Gemini API call failed for description, falling back to smart template:', err);
    }
  }

  // Fallback inteligente
  return `${params.titulo} (${params.ano}) em versão ${params.cambio} com combustível ${params.combustivel} e apenas ${params.km.toLocaleString('pt-BR')} km rodados. Veículo com excelente estrutura, ótimo espaço interno, conforto de rodagem e mecânica consagrada pelo mercado.\n\nExcelente oportunidade para quem busca um carro completo por um valor significativamente abaixo do mercado, seja para uso próprio no dia a dia ou para investimento e giro rápido.`;
}
