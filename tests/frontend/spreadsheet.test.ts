import { describe, expect, it } from "vitest";
import { applyColumnMapping, guessMapping } from "../../src/lib/spreadsheet";

describe("guessMapping", () => {
  const fields = [
    { key: "name", label: "Nome da empresa" },
    { key: "cnpj", label: "CNPJ" },
    { key: "city", label: "Cidade" },
  ];

  it("casa cabeçalhos que correspondem exatamente à chave do campo", () => {
    const mapping = guessMapping(["name", "cnpj", "city"], fields);
    expect(mapping).toEqual({ name: "name", cnpj: "cnpj", city: "city" });
  });

  it("casa cabeçalhos que correspondem ao rótulo em português, ignorando maiúsculas/acentos", () => {
    const mapping = guessMapping(["Nome Da Empresa", "CNPJ", "cidade"], fields);
    expect(mapping).toEqual({ name: "Nome Da Empresa", cnpj: "CNPJ", city: "cidade" });
  });

  it("não mapeia campos sem nenhum cabeçalho correspondente", () => {
    const mapping = guessMapping(["Telefone", "Website"], fields);
    expect(mapping).toEqual({});
  });

  it("ignora espaços extras e pontuação na comparação", () => {
    const mapping = guessMapping(["  CNPJ  "], fields);
    expect(mapping).toEqual({ cnpj: "  CNPJ  " });
  });
});

describe("applyColumnMapping", () => {
  const rows = [
    { "Nome da Empresa": "Transportadora Exemplo", "Cidade/UF": "Porto Alegre" },
    { "Nome da Empresa": "Outra Empresa", "Cidade/UF": "Caxias do Sul" },
  ];

  it("renomeia as colunas da planilha para os campos-alvo mapeados", () => {
    const result = applyColumnMapping(rows, { name: "Nome da Empresa", city: "Cidade/UF" });
    expect(result).toEqual([
      { name: "Transportadora Exemplo", city: "Porto Alegre" },
      { name: "Outra Empresa", city: "Caxias do Sul" },
    ]);
  });

  it("ignora campos-alvo sem coluna de origem selecionada", () => {
    const result = applyColumnMapping(rows, { name: "Nome da Empresa", city: "" });
    expect(result).toEqual([{ name: "Transportadora Exemplo" }, { name: "Outra Empresa" }]);
  });

  it("retorna null quando a célula de origem está vazia", () => {
    const result = applyColumnMapping([{ "Nome da Empresa": null, "Cidade/UF": "Bento Gonçalves" }], {
      name: "Nome da Empresa",
      city: "Cidade/UF",
    });
    expect(result).toEqual([{ name: null, city: "Bento Gonçalves" }]);
  });
});
