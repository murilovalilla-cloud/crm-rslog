// Ponto de entrada do Cloudflare Worker (backend do CRM RS LOG).
//
// Este Worker serve tanto a API (/api/*) quanto o frontend compilado
// (Static Assets, ver wrangler.jsonc). A configuração `run_worker_first`
// garante que toda requisição a /api/* passe por aqui; as demais são
// resolvidas diretamente pela plataforma a partir de ./dist.

import { Hono } from "hono";
import type { AppEnv } from "./types";
import { authMiddleware } from "./auth";
import { securityHeaders } from "./securityHeaders";
import users from "./routes/users";
import companies from "./routes/companies";
import contacts from "./routes/contacts";
import pipelineStages from "./routes/pipelineStages";
import opportunities from "./routes/opportunities";
import activities from "./routes/activities";
import lossReasons from "./routes/lossReasons";
import quotes from "./routes/quotes";
import cadences from "./routes/cadences";
import nutrition from "./routes/nutrition";
import dashboard from "./routes/dashboard";
import importExport from "./routes/importExport";
import auditLog from "./routes/auditLog";

const app = new Hono<AppEnv>();

// Aplica os cabeçalhos de segurança a toda resposta (API e frontend estático).
app.use("*", securityHeaders);

// Healthcheck público (sem autenticação) — útil para checar se o deploy subiu.
app.get("/api/health", (c) => c.json({ ok: true, environment: c.env.ENVIRONMENT }));

// A partir daqui, todas as rotas exigem um usuário identificado (ver worker/auth.ts).
app.use("/api/*", authMiddleware);

app.get("/api/me", (c) => c.json({ data: c.get("user") }));

app.route("/api/users", users);
app.route("/api/companies", companies);
app.route("/api/contacts", contacts);
app.route("/api/pipeline-stages", pipelineStages);
app.route("/api/opportunities", opportunities);
app.route("/api/activities", activities);
app.route("/api/loss-reasons", lossReasons);
app.route("/api/quotes", quotes);
app.route("/api/cadence-templates", cadences);
app.route("/api/nutrition-leads", nutrition);
app.route("/api/dashboard", dashboard);
app.route("/api/audit-log", auditLog);
app.route("/api", importExport);

// Com `run_worker_first: true` (ver wrangler.jsonc), toda requisição passa
// pelo Worker antes dos Static Assets. Rotas de API não encontradas retornam
// 404 em JSON; qualquer outra coisa (o frontend compilado) é repassada para
// o binding de Static Assets, que já cuida do fallback de SPA.
app.notFound((c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: "Rota não encontrada." }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

app.onError((err, c) => {
  console.error("Erro não tratado:", err);
  return c.json({ error: "Erro interno no servidor. Tente novamente em instantes." }, 500);
});

export default app;
