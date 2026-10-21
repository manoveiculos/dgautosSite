// Horário de atendimento da loja.
//
// A versão anterior lia o relógio DO APARELHO do cliente e fixava seg–sex das
// 8h às 18h. Dois efeitos ruins: sábado de manhã — pico de quem procura carro —
// a home anunciava "1 consultor disponível" com a loja aberta; e às 3h da manhã
// anunciava a mesma coisa ao lado de "Resposta em até 5 minutos", uma promessa
// que ninguém acredita.
//
// Horário real, o mesmo declarado no schema e no FAQ (server/catalog.ts):
//   Segunda a sexta  08h–19h
//   Sábado           08h–13h
//   Domingo          fechado

const TZ = 'America/Sao_Paulo';

interface HorarioBRT {
  diaSemana: number; // 0 = domingo
  hora: number;
  minuto: number;
}

/** Hora atual em Brasília, independente do fuso do aparelho do visitante. */
function agoraBRT(): HorarioBRT {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const partes = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  const dias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    diaSemana: dias[partes.weekday] ?? 1,
    // Intl devolve "24" para meia-noite em algumas engines com hour12: false.
    hora: parseInt(partes.hour, 10) % 24,
    minuto: parseInt(partes.minute, 10),
  };
}

export function lojaAberta(): boolean {
  const { diaSemana, hora } = agoraBRT();
  if (diaSemana === 0) return false; // domingo
  if (diaSemana === 6) return hora >= 8 && hora < 13; // sábado
  return hora >= 8 && hora < 19; // segunda a sexta
}

/**
 * Promessa de retorno honesta. Fora do expediente, prometer "5 minutos" queima
 * a confiança logo no momento em que a pessoa está entregando o telefone.
 */
export function promessaDeRetorno(): string {
  if (lojaAberta()) return 'Resposta em até 5 minutos';

  const { diaSemana, hora } = agoraBRT();

  // Sábado depois das 13h, ou domingo: só volta segunda.
  if (diaSemana === 0 || (diaSemana === 6 && hora >= 13)) {
    return 'Primeiro da fila na segunda, às 8h';
  }
  // Sexta depois das 19h: o próximo atendimento é sábado de manhã.
  if (diaSemana === 5 && hora >= 19) {
    return 'Primeiro da fila no sábado, às 8h';
  }
  return 'Primeiro da fila amanhã, às 8h';
}

/** Texto do rodapé — só afirma consultor online quando a loja está de fato aberta. */
export function statusConsultores(): string {
  return lojaAberta()
    ? 'Consultores online agora'
    : 'Deixe seu contato — respondemos assim que abrirmos';
}
