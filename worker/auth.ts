// Middleware de autenticação/identificação de usuário.
//
// Em produção, o Cloudflare Access protege o domínio inteiro do CRM: nenhuma
// requisição chega ao Worker sem antes passar pela política de Access (ver
// README > "Configurar o Cloudflare Access"). Após validar o login, o Access
// injeta o cabeçalho `Cf-Access-Authenticated-User-Email` com o e-mail do
// usuário autenticado — é isso que o backend usa para identificar quem está
// fazendo a requisição.
//
// IMPORTANTE (Etapa 3): para uma defesa em profundidade, o ideal é também
// validar a assinatura do JWT enviado em `Cf-Access-Jwt-Assertion` contra o
// JWKS do team domain (CF_ACCESS_TEAM_DOMAIN/CF_ACCESS_AUD), em vez de
// confiar cegamente no cabeçalho. Isso será endurecido na Etapa 3
// (Autenticação/Auditoria). Por ora, a rota inteira já fica bloqueada pelo
// Access no edge, e o backend também recusa qualquer e-mail que não exista
// como usuário ativo cadastrado — ou seja, mesmo que alguém burle o cabeçalho,
// só entra quem já está provisionado na tabela `users`.

import type { Context, Next } from "hono";
import type { AppEnv } from "./types";

export async function authMiddleware(c: Context<AppEnv>, next: Next) {
  const accessEmail = c.req.header("Cf-Access-Authenticated-User-Email");

  // Fora de produção (dev local, testes), não há Cloudflare Access na frente
  // do `wrangler dev`. Permitimos identificar o usuário via cabeçalho de
  // desenvolvimento ou variável DEV_USER_EMAIL definida em .dev.vars.
  const isDev = c.env.ENVIRONMENT !== "production";
  const devEmail = isDev ? c.req.header("X-Dev-User-Email") ?? c.env.DEV_USER_EMAIL : undefined;

  const email = (accessEmail ?? devEmail ?? "").trim().toLowerCase();

  if (!email) {
    return c.json(
      { error: "Não autenticado. O acesso ao CRM RS LOG deve ser feito através do Cloudflare Access." },
      401
    );
  }

  const user = await c.env.DB.prepare(
    "SELECT id, email, name, role, active FROM users WHERE email = ?"
  )
    .bind(email)
    .first<{ id: string; email: string; name: string; role: "admin" | "vendedor"; active: number }>();

  if (!user || user.active !== 1) {
    return c.json(
      {
        error:
          "Usuário não autorizado a acessar o CRM RS LOG. Peça a um administrador para cadastrá-lo na equipe.",
      },
      403
    );
  }

  c.set("user", { id: user.id, email: user.email, name: user.name, role: user.role });
  await next();
}

/** Middleware auxiliar para restringir uma rota a administradores. */
export async function requireAdmin(c: Context<AppEnv>, next: Next) {
  const user = c.get("user");
  if (user.role !== "admin") {
    return c.json({ error: "Apenas administradores podem realizar esta ação." }, 403);
  }
  await next();
}
