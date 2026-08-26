// Middleware de autenticação/identificação de usuário.
//
// Em produção, o Cloudflare Access protege o domínio inteiro do CRM: nenhuma
// requisição chega ao Worker sem antes passar pela política de Access (ver
// README > "Configurar o Cloudflare Access"). Após validar o login, o Access
// injeta o cabeçalho `Cf-Access-Authenticated-User-Email` com o e-mail do
// usuário autenticado — é isso que o backend usa para identificar quem está
// fazendo a requisição.
//
// Etapa 3 (defesa em profundidade): quando `CF_ACCESS_TEAM_DOMAIN`/
// `CF_ACCESS_AUD` estão configurados (ver worker/accessJwt.ts), também
// validamos a assinatura do JWT enviado em `Cf-Access-Jwt-Assertion` contra
// o JWKS do team domain, e conferimos que o e-mail do token bate com o do
// cabeçalho — ou seja, mesmo que alguém conseguisse injetar o cabeçalho de
// e-mail diretamente no Worker (o que o roteamento do Access já deveria
// impedir), a ausência de um JWT válido correspondente derruba a
// requisição. Enquanto o Access não estiver configurado (valor de exemplo em
// `wrangler.jsonc`), essa checagem extra fica desligada e a rota segue
// protegida só pelo cabeçalho de e-mail + validação contra a tabela `users`.

import type { Context, Next } from "hono";
import type { AppEnv } from "./types";
import { isAccessJwtConfigured, verifyAccessJwt } from "./accessJwt";

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

  // Só se aplica em produção (com Access de fato configurado) e quando o
  // e-mail veio do cabeçalho do Access — não faz sentido exigir o JWT do
  // Access para o fallback de desenvolvimento local.
  if (!isDev && accessEmail && isAccessJwtConfigured(c.env)) {
    const assertion = c.req.header("Cf-Access-Jwt-Assertion");
    if (!assertion) {
      return c.json({ error: "Token do Cloudflare Access ausente na requisição." }, 401);
    }
    const verified = await verifyAccessJwt(assertion, c.env);
    if (!verified.ok) {
      console.error("Falha ao validar o JWT do Cloudflare Access:", verified.reason);
      return c.json({ error: "Não foi possível validar sua sessão do Cloudflare Access. Faça login novamente." }, 401);
    }
    if (verified.email !== email) {
      console.error("E-mail do JWT do Access não corresponde ao cabeçalho de e-mail autenticado.");
      return c.json({ error: "Sessão inconsistente com o Cloudflare Access. Faça login novamente." }, 401);
    }
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
