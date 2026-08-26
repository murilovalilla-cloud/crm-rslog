// Hooks da tela de trilha de auditoria (admin) — Etapa 3.
//
// A rota /api/audit-log é somente leitura e restrita a administradores (ver
// worker/routes/auditLog.ts); aqui só montamos a query string a partir dos
// filtros escolhidos na tela.

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AuditLogEntry } from "@/lib/types";

export interface AuditLogFilters {
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  action?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
}

interface AuditLogResponse {
  data: AuditLogEntry[];
  page: number;
  limit: number;
  total: number;
}

function buildQuery(filters: AuditLogFilters): string {
  const params = new URLSearchParams();
  if (filters.entity_type) params.set("entity_type", filters.entity_type);
  if (filters.entity_id) params.set("entity_id", filters.entity_id);
  if (filters.user_id) params.set("user_id", filters.user_id);
  if (filters.action) params.set("action", filters.action);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function useAuditLog(filters: AuditLogFilters) {
  return useQuery({
    queryKey: ["audit-log", filters],
    queryFn: () => api.get<AuditLogResponse>(`/audit-log${buildQuery(filters)}`),
    placeholderData: (prev) => prev,
  });
}

export function useAuditEntityTypes() {
  return useQuery({
    queryKey: ["audit-log", "entity-types"],
    queryFn: () => api.get<{ data: string[] }>("/audit-log/entity-types").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}
