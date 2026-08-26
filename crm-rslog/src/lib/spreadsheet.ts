// Leitura de planilhas (.xlsx/.xls/.csv) no navegador para a tela de
// importação. Usa a mesma biblioteca do backend (worker/export.ts) — ver o
// comentário lá sobre a escolha do pacote "@e965/xlsx" por questão de CVEs.
import * as XLSX from "@e965/xlsx";

export interface ParsedSheet {
  headers: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
}

const MAX_ROWS = 2000; // mesmo limite aplicado pelo backend (worker/validation/schemas.ts)

export async function parseSpreadsheetFile(file: File): Promise<ParsedSheet> {
  const isCsv = file.name.toLowerCase().endsWith(".csv");
  const workbook = isCsv ? XLSX.read(await file.text(), { type: "string" }) : XLSX.read(await file.arrayBuffer(), { type: "array" });

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };
  const sheet = workbook.Sheets[sheetName];

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: null });
  if (matrix.length === 0) return { headers: [], rows: [] };

  const headerRow = matrix[0] as unknown[];
  const headers = headerRow.map((h, i) => {
    const s = h === null || h === undefined ? "" : String(h).trim();
    return s === "" ? `Coluna ${i + 1}` : s;
  });

  const dataRows = matrix.slice(1, 1 + MAX_ROWS) as unknown[][];
  const rows = dataRows
    .filter((line) => line.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== ""))
    .map((line) => {
      const record: Record<string, string | number | boolean | null> = {};
      headers.forEach((h, i) => {
        const raw = line[i];
        record[h] = raw === undefined ? null : (raw as string | number | boolean | null);
      });
      return record;
    });

  return { headers, rows };
}

/** Aplica o mapeamento coluna-da-planilha → campo-do-CRM, produzindo as linhas no formato esperado pela API de importação. */
export function applyColumnMapping(
  rows: ParsedSheet["rows"],
  mapping: Record<string, string>
): Array<Record<string, string | number | boolean | null>> {
  const entries = Object.entries(mapping).filter(([, sourceHeader]) => sourceHeader);
  return rows.map((row) => {
    const mapped: Record<string, string | number | boolean | null> = {};
    for (const [targetKey, sourceHeader] of entries) {
      mapped[targetKey] = row[sourceHeader] ?? null;
    }
    return mapped;
  });
}

/** Tenta pré-preencher o mapeamento comparando o nome/label do campo-alvo com os cabeçalhos da planilha. */
export function guessMapping(headers: string[], fields: Array<{ key: string; label: string }>): Record<string, string> {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  const normalizedHeaders = headers.map((h) => ({ original: h, normalized: normalize(h) }));
  const mapping: Record<string, string> = {};

  for (const field of fields) {
    const candidates = [field.key, field.label];
    const match = normalizedHeaders.find((h) => candidates.some((c) => normalize(c) === h.normalized));
    if (match) mapping[field.key] = match.original;
  }

  return mapping;
}
