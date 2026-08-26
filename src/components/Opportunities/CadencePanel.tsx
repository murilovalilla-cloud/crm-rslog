import { useState } from "react";
import { Button } from "@/components/common/Button";
import { Select } from "@/components/common/Select";
import { EmptyState } from "@/components/common/EmptyState";
import { useCadenceTemplates, useOpportunityCadences, useApplyCadence, useCancelCadence } from "@/hooks/useCadences";
import { formatDate } from "@/lib/utils";
import type { LeadCadence } from "@/lib/types";

const STATUS_LABELS: Record<LeadCadence["status"], string> = {
  ativa: "Ativa",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const STATUS_CLASSES: Record<LeadCadence["status"], string> = {
  ativa: "bg-blue-50 text-alert-upcoming border border-blue-200",
  concluida: "bg-green-50 text-alert-done border border-green-200",
  cancelada: "bg-slate-100 text-slate-500 border border-slate-200",
};

/** Painel de cadência dentro do detalhe da oportunidade: aplicar um modelo, ver o histórico de cadências e cancelar a ativa. */
export function CadencePanel({ opportunityId }: { opportunityId: string }) {
  const { data: templates } = useCadenceTemplates();
  const { data: cadences, isLoading } = useOpportunityCadences(opportunityId);
  const applyCadence = useApplyCadence(opportunityId);
  const cancelCadence = useCancelCadence(opportunityId);
  const [selectedTemplate, setSelectedTemplate] = useState("");

  const hasActive = (cadences ?? []).some((c) => c.status === "ativa");

  return (
    <div className="space-y-3">
      {!hasActive && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <Select
              label="Aplicar cadência"
              placeholder={templates && templates.length === 0 ? "Nenhum modelo cadastrado" : "Selecione um modelo"}
              options={(templates ?? []).map((t) => ({ value: t.id, label: t.name }))}
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            disabled={!selectedTemplate}
            loading={applyCadence.isPending}
            onClick={() => applyCadence.mutate(selectedTemplate, { onSuccess: () => setSelectedTemplate("") })}
          >
            Aplicar
          </Button>
        </div>
      )}

      {!isLoading && (cadences ?? []).length === 0 && (
        <EmptyState
          title="Nenhuma cadência aplicada"
          description="Aplique um modelo para gerar automaticamente as próximas atividades de contato."
        />
      )}

      {(cadences ?? []).length > 0 && (
        <ul className="space-y-2">
          {(cadences ?? []).map((lc) => (
            <li key={lc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
              <div>
                <p className="font-medium text-slate-700">
                  {lc.template_name ?? "Cadência"}{" "}
                  <span className={`ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[lc.status]}`}>
                    {STATUS_LABELS[lc.status]}
                  </span>
                </p>
                <p className="text-xs text-slate-400">
                  Iniciada em {formatDate(lc.started_at)} · passo atual: {lc.current_step}
                </p>
              </div>
              {lc.status === "ativa" && (
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => cancelCadence.mutate(lc.id)}
                >
                  Cancelar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
