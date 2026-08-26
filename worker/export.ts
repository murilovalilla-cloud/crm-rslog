// Utilitários de exportação: geração de CSV e XLSX a partir de linhas já
// buscadas do D1. Mantido separado de worker/utils.ts porque depende da
// biblioteca SheetJS, usada só nas rotas de exportação/importação.
//
// Pacote: usamos "@e965/xlsx" (e não o pacote "xlsx" do próprio registro
// npm) porque, desde a v0.19, a SheetJS passou a publicar suas correções de
// segurança apenas via CDN própria (cdn.sheetjs.com), sem atualizar o pacote
// "xlsx" no npm — que por isso ficou parado na v0.18.5 com CVEs conhecidas
// (prototype pollution e ReDoS, sem correção disponível ali). O pacote
// "@e965/xlsx" republica exatamente o mesmo código oficial já corrigido
// (v0.20.3+) no registro npm. Se preferir a fonte 100% oficial, é possível
// trocar por `npm install https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz`
// diretamente (ver https://docs.sheetjs.com/docs/getting-started/installation/nodejs).

import * as XLSX from "@e965/xlsx";

export interface ExportColumn {
  key: string;
  label: string;
}

function cellToDisplay(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return String(value);
  return String(value);
}

/** Gera um CSV (separado por vírgula, com aspas quando necessário) a partir de linhas de objeto. */
export function toCSV(rows: Array<Record<string, unknown>>, columns: ExportColumn[]): string {
  const escape = (value: string) => {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const header = columns.map((col) => escape(col.label)).join(",");
  const lines = rows.map((row) => columns.map((col) => escape(cellToDisplay(row[col.key]))).join(","));
  return [header, ...lines].join("\r\n");
}

/** Gera um workbook .xlsx (retornado como ArrayBuffer) a partir de linhas de objeto. */
export function toXLSX(rows: Array<Record<string, unknown>>, columns: ExportColumn[], sheetName = "Dados"): ArrayBuffer {
  const data = rows.map((row) => {
    const record: Record<string, unknown> = {};
    for (const col of columns) record[col.label] = row[col.key] ?? "";
    return record;
  });
  const worksheet = XLSX.utils.json_to_sheet(data, { header: columns.map((c) => c.label) });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const out = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return out;
}

export type ExportFormat = "csv" | "xlsx" | "json";

export function buildExportResponse(
  rows: Array<Record<string, unknown>>,
  columns: ExportColumn[],
  format: ExportFormat,
  fileBaseName: string
): Response {
  if (format === "json") {
    return new Response(JSON.stringify(rows, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileBaseName}.json"`,
      },
    });
  }

  if (format === "xlsx") {
    const buffer = toXLSX(rows, columns, fileBaseName.slice(0, 31));
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileBaseName}.xlsx"`,
      },
    });
  }

  const csv = toCSV(rows, columns);
  // BOM para o Excel reconhecer UTF-8 corretamente (acentuação em português).
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileBaseName}.csv"`,
    },
  });
}
