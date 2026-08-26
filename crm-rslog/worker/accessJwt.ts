// Verificação criptográfica do token do Cloudflare Access (defesa em
// profundidade), usada como reforço a mais em cima do cabeçalho
// `Cf-Access-Authenticated-User-Email` (que já é confiável, pois o Access
// protege o domínio inteiro no edge — nenhuma requisição chega ao Worker sem
// passar pela política de Access primeiro).
//
// O Access também injeta `Cf-Access-Jwt-Assertion`: um JWT assinado (RS256)
// que comprova a autenticação. Aqui validamos a assinatura desse token
// contra o JWKS público do Access (https://<team-domain>/cdn-cgi/access/certs),
// além do emissor, da audiência (AUD da aplicação) e da expiração — usando a
// lib "jose", compatível com o runtime de Workers (Web Crypto, sem APIs de
// Node). Isso garante que, mesmo que alguém encontrasse uma forma de forjar
// o cabeçalho de e-mail diretamente no Worker (o que o roteamento do Access
// já deveria impedir), a ausência de um JWT válido correspondente derrubaria
// a requisição.

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { Env } from "./types";

// `createRemoteJWKSet` já cacheia internamente a resposta do JWKS (com base
// nos cabeçalhos de cache da resposta). Mantemos aqui só um cache por team
// domain para reutilizar a mesma instância entre requisições atendidas pelo
// mesmo isolate do Worker, evitando recriar o objeto a cada chamada.
const jwksCache = new Map<string, JWTVerifyGetKey>();

function getJwks(teamDomain: string): JWTVerifyGetKey {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`https://${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

type AccessEnv = Pick<Env, "CF_ACCESS_TEAM_DOMAIN" | "CF_ACCESS_AUD">;

/**
 * Verdadeiro quando `CF_ACCESS_TEAM_DOMAIN`/`CF_ACCESS_AUD` foram de fato
 * preenchidos (não são mais os valores de exemplo do `wrangler.jsonc`).
 * Enquanto isso não for configurado, a verificação de assinatura do JWT fica
 * desligada — o CRM continua funcionando normalmente só com o cabeçalho de
 * e-mail, que já é a defesa principal (Access barra tudo no edge).
 */
export function isAccessJwtConfigured(env: AccessEnv): boolean {
  const domain = env.CF_ACCESS_TEAM_DOMAIN?.trim();
  const aud = env.CF_ACCESS_AUD?.trim();
  if (!domain || !aud) return false;
  if (domain.includes("SUBSTITUA") || aud.includes("SUBSTITUA")) return false;
  return true;
}

export type AccessJwtResult = { ok: true; email: string } | { ok: false; reason: string };

/**
 * Valida assinatura, emissor, audiência e expiração do JWT do Cloudflare
 * Access, retornando o e-mail do claim `email`. Nunca lança — o chamador
 * decide o que fazer com o resultado tipado.
 */
export async function verifyAccessJwt(token: string, env: AccessEnv): Promise<AccessJwtResult> {
  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN?.trim();
  const aud = env.CF_ACCESS_AUD?.trim();
  if (!teamDomain || !aud) return { ok: false, reason: "Verificação de Access não configurada." };

  try {
    const { payload } = await jwtVerify(token, getJwks(teamDomain), {
      issuer: `https://${teamDomain}`,
      audience: aud,
    });
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!email) return { ok: false, reason: "Token do Access não contém um e-mail válido." };
    return { ok: true, email };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Falha ao validar o token do Access." };
  }
}
