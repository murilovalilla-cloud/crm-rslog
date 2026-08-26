import { describe, expect, it } from "vitest";
import { isAccessJwtConfigured, verifyAccessJwt } from "../../worker/accessJwt";

describe("isAccessJwtConfigured", () => {
  it("retorna falso quando as variáveis estão vazias", () => {
    expect(isAccessJwtConfigured({ CF_ACCESS_TEAM_DOMAIN: "", CF_ACCESS_AUD: "" })).toBe(false);
  });

  it("retorna falso quando as variáveis não foram preenchidas (undefined)", () => {
    expect(isAccessJwtConfigured({})).toBe(false);
  });

  it("retorna falso enquanto os valores forem os placeholders do wrangler.jsonc", () => {
    expect(
      isAccessJwtConfigured({
        CF_ACCESS_TEAM_DOMAIN: "SUBSTITUA_PELO_SEU_TEAM_DOMAIN",
        CF_ACCESS_AUD: "SUBSTITUA_PELO_AUD_DA_APLICACAO_ACCESS",
      })
    ).toBe(false);
  });

  it("retorna verdadeiro quando ambos os valores estão preenchidos de verdade", () => {
    expect(
      isAccessJwtConfigured({
        CF_ACCESS_TEAM_DOMAIN: "rslog.cloudflareaccess.com",
        CF_ACCESS_AUD: "abc123def456",
      })
    ).toBe(true);
  });

  it("retorna falso se só um dos dois estiver preenchido", () => {
    expect(isAccessJwtConfigured({ CF_ACCESS_TEAM_DOMAIN: "rslog.cloudflareaccess.com", CF_ACCESS_AUD: "" })).toBe(false);
    expect(isAccessJwtConfigured({ CF_ACCESS_TEAM_DOMAIN: "", CF_ACCESS_AUD: "abc123" })).toBe(false);
  });
});

describe("verifyAccessJwt", () => {
  it("recusa imediatamente (sem tentar rede) quando o Access não está configurado", async () => {
    const result = await verifyAccessJwt("qualquer-token", { CF_ACCESS_TEAM_DOMAIN: "", CF_ACCESS_AUD: "" });
    expect(result).toEqual({ ok: false, reason: "Verificação de Access não configurada." });
  });

  it("recusa um token malformado sem lançar exceção", async () => {
    const result = await verifyAccessJwt("token-invalido-nao-e-um-jwt", {
      CF_ACCESS_TEAM_DOMAIN: "rslog.cloudflareaccess.com",
      CF_ACCESS_AUD: "abc123",
    });
    expect(result.ok).toBe(false);
  });
});
