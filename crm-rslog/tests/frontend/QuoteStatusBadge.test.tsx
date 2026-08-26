import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuoteStatusBadge, QUOTE_STATUS_OPTIONS } from "../../src/components/Quotes/QuoteStatusBadge";

describe("<QuoteStatusBadge />", () => {
  it("mostra o rótulo em português para cada situação", () => {
    render(<QuoteStatusBadge status="rascunho" />);
    expect(screen.getByText("Rascunho")).toBeInTheDocument();
  });

  it("mostra 'Recusada' para cotações recusadas", () => {
    render(<QuoteStatusBadge status="recusada" />);
    expect(screen.getByText("Recusada")).toBeInTheDocument();
  });

  it("mostra 'Aprovada' para cotações aprovadas", () => {
    render(<QuoteStatusBadge status="aprovada" />);
    expect(screen.getByText("Aprovada")).toBeInTheDocument();
  });
});

describe("QUOTE_STATUS_OPTIONS", () => {
  it("expõe todas as 5 situações possíveis de uma cotação", () => {
    expect(QUOTE_STATUS_OPTIONS).toHaveLength(5);
    expect(QUOTE_STATUS_OPTIONS.map((o) => o.value)).toEqual(["rascunho", "enviada", "aprovada", "recusada", "expirada"]);
  });
});
