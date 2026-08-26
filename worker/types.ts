// Tipos compartilhados do backend (Cloudflare Worker).

export interface Env {
  // Binding do banco Cloudflare D1 (definido em wrangler.jsonc).
  DB: D1Database;
  // Binding dos Static Assets (frontend compilado).
  ASSETS: Fetcher;

  // Variáveis de ambiente (não secretas).
  ENVIRONMENT: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;

  // Somente definida via .dev.vars em desenvolvimento local.
  DEV_USER_EMAIL?: string;
}

export type UserRole = "admin" | "vendedor";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    user: AuthUser;
  };
};

export type AlertLevel = "atrasada" | "hoje" | "futura" | "concluida" | null;
