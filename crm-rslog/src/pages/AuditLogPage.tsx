import { useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAllUsers } from "@/hooks/useUserAdmin";
import { useAuditLog, useAuditEntityTypes, type AuditLogFilters } from "@/hooks/useAuditLog";
import { Select } from "@/components/common/Select";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/common/Button";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { formatDateTime } from "@/lib/utils";
import { ApiError } from "@/lib/api";

const ENTITY_TYPE_LABELS: Record<string, string> = {
  company: "Empresa",
  contact: "Contato",
  opportunity: "Oportunidade",
  activity: "Atividade",
  pipeline_stage: "Etapa do funil",
  quote: "Cotação",
  quote_item: "Item de cotação",
  cadence_template: "Modelo de cadência",
  nutrition_lead: "Lead em nutrição",
  user: "Usuário",
  import: "Importação",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Criação",
  update: "Edição",
  delete: "Exclusão",
  complete: "Conclusão",
  stage_change: "Mudança de etapa",
  status_change: "Mudança de status",
  apply_cadence: "Aplicação de cadência",
  resume_from_nutrition: "Retomada da nutrição",
  reorder: "Reordenação",
  import_create: "Importação (criado)",
  import_update: "Importação (atualizado)",
  error: "Erro",
};

function entityLabel(entityType: string): string {
  return ENTITY_TYPE_LABELS[entityType] ?? entityType;
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

const EMPTY_FILTERS: AuditLogFilters = {};

export function AuditLogPage() {
  const { data: me } = useCurrentUser();
  const [filters, setFilters] = useState<AuditLogFilters>(EMPTY_FILTERS);

  const { data: entityTypes } = useAuditEntityTypes();
  const { data: users } = useAllUsers();
  const { data, isLoading, error, isFetching } = useAuditLog(filters);

  if (me && me.role !== "admin") {
    return (
      <EmptyState
        tone="error"
        title="Acesso restrito"
        description="Apenas administradores podem consultar a trilha de auditoria."
      />
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  const updateFilter = (patch: Partial<AuditLogFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch, page: 1 }));
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Trilha de auditoria</h1>
        <p className="text-sm text-slate-500">
          Histórico de criações, edições e exclusões registradas em todo o CRM, com data/hora, usuário responsável e
          o que mudou em cada campo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 rounded-md border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Select
          label="Tipo de registro"
          placeholder="Todos"
          options={(entityTypes ?? []).map((t) => ({ value: t, label: entityLabel(t) }))}
          value={filters.entity_type ?? ""}
          onChange={(e) => updateFilter({ entity_type: e.target.value || undefined })}
        />
        <Select
          label="Usuário"
          placeholder="Todos"
          options={(users ?? []).map((u) => ({ value: u.id, label: u.name }))}
          value={filters.user_id ?? ""}
          onChange={(e) => updateFilter({ user_id: e.target.value || undefined })}
        />
        <Input
          label="De"
          type="date"
          value={filters.date_from ?? ""}
          onChange={(e) => updateFilter({ date_from: e.target.value || undefined })}
        />
        <Input
          label="Até"
          type="date"
          value={filters.date_to ?? ""}
          onChange={(e) => updateFilter({ date_to: e.target.value || undefined })}
        />
        <div className="flex items-end">
          <Button variant="secondary" type="button" onClick={() => setFilters(EMPTY_FILTERS)}>
            Limpar filtros
          </Button>
        </div>
      </div>

      {isLoading && <LoadingSpinner label="Carregando trilha de auditoria..." />}
      {error && (
        <EmptyState tone="error" title="Não foi possível carregar a auditoria" description={(error as ApiError).message} />
      )}

      {data && data.data.length === 0 && (
        <EmptyState title="Nenhum registro encontrado" description="Ajuste os filtros para ver outros períodos ou tipos de registro." />
      )}

      {data && data.data.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Quando</th>
                <th className="px-4 py-2">Quem</th>
                <th className="px-4 py-2">Registro</th>
                <th className="px-4 py-2">Ação</th>
                <th className="px-4 py-2">O que mudou</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.data.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-500">{formatDateTime(entry.occurred_at)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                    {entry.user_name ?? entry.user_email ?? "Sistema"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                    {entityLabel(entry.entity_type)}
                    <span className="ml-1 text-xs text-slate-400">{entry.entity_id.slice(0, 12)}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-700">{actionLabel(entry.action)}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {entry.field_name ? (
                      <span>
                        <span className="font-medium">{entry.field_name}</span>: {entry.old_value ?? "—"} → {entry.new_value ?? "—"}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > data.limit && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Página {data.page} de {totalPages} · {data.total} registro(s)
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={data.page <= 1 || isFetching}
              onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))}
            >
              Anterior
            </Button>
            <Button
              variant="secondary"
              disabled={data.page >= totalPages || isFetching}
              onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
