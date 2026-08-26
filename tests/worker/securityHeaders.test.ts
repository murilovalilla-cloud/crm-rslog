import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import type { AppEnv } from "../../worker/types";
import { securityHeaders } from "../../worker/securityHeaders";

describe("securityHeaders", () => {
  it("aplica os cabeçalhos de segurança padrão em toda resposta", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", securityHeaders);
    app.get("/", (c) => c.text("ok"));

    const res = await app.request("/");

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Permissions-Policy")).toContain("camera=()");
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(res.headers.get("Content-Security-Policy")).toContain("script-src 'self'");
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  });

  it("também aplica os cabeçalhos em respostas de erro (ex.: 404)", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", securityHeaders);
    app.get("/", (c) => c.text("ok"));

    const res = await app.request("/rota-inexistente");

    expect(res.status).toBe(404);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
