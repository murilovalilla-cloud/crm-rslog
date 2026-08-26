// Cabeçalhos de segurança HTTP aplicados a toda resposta do Worker — tanto
// a API (/api/*) quanto o frontend estático servido pelo binding ASSETS
// (ver worker/index.ts > app.notFound). É defesa em profundidade adicional
// à proteção de perímetro do Cloudflare Access (ver worker/auth.ts):
// reduz o impacto de um eventual XSS, clique-sequestro (clickjacking) ou
// vazamento de referrer, mesmo que o Access já bloqueie o acesso não
// autenticado.
//
// A CSP é intencionalmente restritiva: o frontend é um SPA autocontido
// (React/Vite), sem scripts de terceiros nem CDNs externos, então
// `script-src 'self'` não quebra nada. `style-src` precisa de
// 'unsafe-inline' porque alguns componentes usam `style={{ width: ... }}`
// para barras de progresso no dashboard.

import type { Context, Next } from "hono";
import type { AppEnv } from "./types";

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export async function securityHeaders(c: Context<AppEnv>, next: Next) {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("Content-Security-Policy", CSP);
}
