// ---------------------------------------------------------------------------
// Basic Auth para as páginas internas (/leads-manos).
//
// O painel não tem dado pessoal, mas expõe desempenho por campanha e criativo —
// informação de negócio que não deve ficar aberta para quem descobrir a URL.
//
// Feito no Express, e não no nginx, para a proteção viajar junto com o código:
// não depende de alguém lembrar de configurar o servidor no próximo deploy.
//
// Configuração (no .env do servidor):
//   PANEL_USER="manos"
//   PANEL_PASSWORD="uma-senha-longa-e-aleatoria"
//
// FALHA FECHADA de propósito: sem PANEL_PASSWORD definida, a página responde 503
// em vez de ficar aberta. Um controle de acesso que se desliga sozinho quando
// mal configurado é pior do que não ter controle nenhum, porque dá a impressão
// de que está protegido.
// ---------------------------------------------------------------------------

import { timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";

/**
 * Comparação em tempo constante. Um `===` normal sai no primeiro caractere
 * diferente, o que deixa o tempo de resposta revelar quanto do palpite estava
 * certo e permite descobrir a senha caractere por caractere.
 */
function comparaSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // O tamanho vaza de qualquer jeito pelo header; o que precisa ser constante é
  // a comparação do conteúdo.
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function pedirCredenciais(res: Response, realm: string): void {
  res
    .status(401)
    .set("WWW-Authenticate", `Basic realm="${realm}", charset="UTF-8"`)
    .set("Cache-Control", "no-store")
    .type("text/plain")
    .send("Acesso restrito.");
}

export function basicAuth(realm: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const usuarioEsperado = process.env.PANEL_USER || "manos";
    const senhaEsperada = process.env.PANEL_PASSWORD || "";

    if (!senhaEsperada) {
      console.warn(
        `[auth] ${req.path} bloqueado: defina PANEL_PASSWORD no .env do servidor para liberar o painel.`,
      );
      res
        .status(503)
        .set("Cache-Control", "no-store")
        .type("text/plain")
        .send(
          "Painel indisponível: PANEL_PASSWORD não configurada no servidor.\n" +
            "Defina PANEL_USER e PANEL_PASSWORD no .env e reinicie (pm2 reload manos --update-env).",
        );
      return;
    }

    const header = req.headers.authorization || "";
    if (!header.toLowerCase().startsWith("basic ")) {
      pedirCredenciais(res, realm);
      return;
    }

    let usuario = "";
    let senha = "";
    try {
      const decodificado = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
      const corte = decodificado.indexOf(":"); // a senha pode conter ":"
      if (corte === -1) {
        pedirCredenciais(res, realm);
        return;
      }
      usuario = decodificado.slice(0, corte);
      senha = decodificado.slice(corte + 1);
    } catch {
      pedirCredenciais(res, realm);
      return;
    }

    // Avalia os dois lados sempre, para o tempo de resposta não denunciar se o
    // que estava errado era o usuário ou a senha.
    const usuarioOk = comparaSeguro(usuario, usuarioEsperado);
    const senhaOk = comparaSeguro(senha, senhaEsperada);

    if (usuarioOk && senhaOk) {
      next();
      return;
    }
    pedirCredenciais(res, realm);
  };
}
