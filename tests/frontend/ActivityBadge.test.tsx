import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityBadge } from "../../src/components/Activities/ActivityBadge";

describe("<ActivityBadge />", () => {
  it("não renderiza nada quando o nível é null", () => {
    const { container } = render(<ActivityBadge level={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra a quantidade de dias em atraso", () => {
    render(<ActivityBadge level="atrasada" overdueDays={4} />);
    expect(screen.getByText("Atrasada há 4d")).toBeInTheDocument();
  });

  it("mostra 'Vence hoje' sem sufixo de dias", () => {
    render(<ActivityBadge level="hoje" overdueDays={0} />);
    expect(screen.getByText("Vence hoje")).toBeInTheDocument();
  });

  it("mostra a contagem de dias restantes para uma atividade futura", () => {
    const dueAt = new Date();
    dueAt.setUTCDate(dueAt.getUTCDate() + 3);
    render(<ActivityBadge level="futura" dueAt={dueAt.toISOString()} />);
    expect(screen.getByText("Em 3d")).toBeInTheDocument();
  });

  it("mostra 'Concluída' para atividades já concluídas", () => {
    render(<ActivityBadge level="concluida" />);
    expect(screen.getByText("Concluída")).toBeInTheDocument();
  });
});
