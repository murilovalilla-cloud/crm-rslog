import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { ImportCommitResponse, ImportEntity, ImportHistoryRecord, ImportPreviewResponse, ImportRowResult } from "@/lib/types";

export type ExportFormat = "csv" | "xlsx" | "json";
export type ExportEntity = "companies" | "contacts" | "opportunities" | "activities" | "quotes" | "nutrition-leads" | "backup";

/**
 * Dispara o download de uma exportação. A API devolve o arquivo diretamente
 * (Content-Disposition: attachment), então buscamos como blob e acionamos o
 * download no navegador — sem passar pelo cliente JSON (`lib/api.ts`).
 */
export async function triggerExport(entity: ExportEntity, format: ExportFormat, params: Record<string, string | undefined> = {}) {
  const query = new URLSearchParams();
  if (entity !== "backup") query.set("format", format);
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }

  const res = await fetch(`/api/export/${entity}?${query.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError((body as { error?: string } | null)?.error ?? "Falha ao exportar.", res.status);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `${entity}.${entity === "backup" ? "json" : format}`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function useImportPreview() {
  return useMutation({
    mutationFn: (payload: { entity_type: ImportEntity; file_name: string; rows: Array<Record<string, unknown>> }) =>
      api.post<{ data: ImportPreviewResponse }>("/import/preview", payload).then((r) => r.data),
  });
}

export function useImportCommit() {
  return useMutation({
    mutationFn: (payload: { entity_type: ImportEntity; file_name: string; rows: Array<Record<string, unknown>> }) =>
      api.post<{ data: ImportCommitResponse }>("/import/commit", payload).then((r) => r.data),
  });
}

export function useImportHistory() {
  return useQuery({
    queryKey: ["import-history"],
    queryFn: () => api.get<{ data: ImportHistoryRecord[] }>("/import/history").then((r) => r.data),
  });
}

export type { ImportRowResult };
