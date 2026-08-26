import { useState } from "react";
import { useNutritionLeads, useUpdateNutritionLead, useResumeNutritionLead } from "@/hooks/useNutrition";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Textarea } from "@/components/common/Textarea";
import { Select } from "@/components/common/Select";
import { Modal } from "@/components/common/Modal";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { cn, formatCurrencyBRL, formatDate } from "@/lib/utils";
import type { NutritionLead } from "@/lib/types";

function ResumeForm({
  stages,
  submitting,
  onCancel,
  onConfirm,
}: {
  stages: Array<{ id: string; name: string }>;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: (stageId: string, note?: string) => void;
}) {
  const [stageId, setStageId] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="space-y-4">
      <Select
        label="Etapa do funil para retomar"
        placeholder="Selecione"
        options={stages.map((s) => ({ value: s.id, label: s.name }))}
        value={stageId}
        onChange={(e) => setStageId(e.target.value)}
      />
      <Textarea label="Observação (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <p className="text-xs text-slate-400">Todo o histórico e as anotações já registrados nesta oportunidade são mantidos.</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button disabled={!stageId} loading={submitting} onClick={() => onConfirm(stageId, note.trim() || undefined)}>
          Confirmar retomada
        </Button>
      </div>
    </div>
  );
}

export function NutritionPage() {
  const [tab, setTab] = useState<"em_nutricao" | "retomado">("em_nutricao");
  const { data: leads, isLoading, error } = useNutritionLeads(tab);
  const { data: stages } = usePipelineStages();
  const updateLead = useUpdateNutritionLead();
  const resumeLead = useResumeNutritionLead();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ reason: string; resume_at: string }>({ reason: "", resume_at: "" });
  const [resumingLead, setResumingLead] = useState<NutritionLead | null>(null);

  const startEdit = (lead: NutritionLead) => {
    if (editingId === lead.id) {
      setEditingId(null);
      return;
    }
    setEditingId(lead.id);
    setEditValues({ reason: lead.reason ?? "", resume_at: lead.resume_at?.slice(0, 10) ?? "" });
  };

  const resumableStages = (stages ?? []).filter((s) => !s.is_nutrition);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">Nutrição de leads</h1>
        <p className="text-sm text-slate-500">
          Leads sem resposta ou sem oportunidade concreta no momento. Nada do histórico é apagado ao entrar ou sair da nutrição.
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        <button
          type="button"
          className={cn(
            "px-3 py-2 text-sm font-medium",
            tab === "em_nutricao" ? "border-b-2 border-navy-600 text-navy-700" : "text-slate-500 hover:text-slate-700"
          )}
          onClick={() => setTab("em_nutricao")}
        >
          Em nutrição
        </button>
        <button
          type="button"
          className={cn(
            "px-3 py-2 text-sm font-medium",
            tab === "retomado" ? "border-b-2 border-navy-600 text-navy-700" : "text-slate-500 hover:text-slate-700"
          )}
          onClick={() => setTab("retomado")}
        >
          Retomados
        </button>
      </div>

      {isLoading && <LoadingSpinner label="Carregando leads em nutrição..." />}
      {error && <EmptyState tone="error" title="Não foi possível carregar" description="Tente novamente em instantes." />}

      {leads && leads.length === 0 && (
        <EmptyState
          title={tab === "em_nutricao" ? "Nenhum lead em nutrição" : "Nenhum lead retomado ainda"}
          description={
            tab === "em_nutricao"
              ? "Leads movidos para a etapa de Nutrição no funil de vendas aparecem aqui automaticamente."
              : undefined
          }
        />
      )}

      {leads && leads.length > 0 && (
        <ul className="space-y-2">
          {leads.map((lead) => (
            <li key={lead.id} className="rounded-md border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{lead.opportunity_title}</p>
                  <p className="text-xs text-slate-500">
                    {lead.company_name} · {lead.owner_name ?? "Sem responsável"}
                  </p>
                  <p className="text-xs text-slate-500">{formatCurrencyBRL(lead.opportunity_value)}</p>
                </div>
                {tab === "em_nutricao" && (
                  <div className="flex gap-2">
                    <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => startEdit(lead)}>
                      {editingId === lead.id ? "Fechar" : "Editar"}
                    </Button>
                    <Button className="!px-2 !py-1 text-xs" onClick={() => setResumingLead(lead)}>
                      Retomar
                    </Button>
                  </div>
                )}
              </div>

              {tab === "retomado" && (
                <p className="mt-1 text-xs text-slate-400">Retomado em {formatDate(lead.returned_at)}</p>
              )}

              {(lead.reason || lead.resume_at) && editingId !== lead.id && (
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                  {lead.reason && <span>Motivo: {lead.reason}</span>}
                  {lead.resume_at && <span>Retomar em: {formatDate(lead.resume_at)}</span>}
                </div>
              )}

              {editingId === lead.id && (
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                  <div className="min-w-[200px] flex-1">
                    <Textarea
                      label="Motivo"
                      value={editValues.reason}
                      onChange={(e) => setEditValues((v) => ({ ...v, reason: e.target.value }))}
                    />
                  </div>
                  <div className="w-44">
                    <Input
                      label="Data para retomar"
                      type="date"
                      value={editValues.resume_at}
                      onChange={(e) => setEditValues((v) => ({ ...v, resume_at: e.target.value }))}
                    />
                  </div>
                  <Button
                    className="!px-3 !py-1.5 text-xs"
                    loading={updateLead.isPending}
                    onClick={() => updateLead.mutate({ id: lead.id, values: editValues }, { onSuccess: () => setEditingId(null) })}
                  >
                    Salvar
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal open={!!resumingLead} onClose={() => setResumingLead(null)} title="Retomar lead" widthClass="max-w-sm">
        {resumingLead && (
          <ResumeForm
            stages={resumableStages}
            submitting={resumeLead.isPending}
            onCancel={() => setResumingLead(null)}
            onConfirm={(stageId, note) =>
              resumeLead.mutate({ id: resumingLead.id, stageId, note }, { onSuccess: () => setResumingLead(null) })
            }
          />
        )}
      </Modal>
    </div>
  );
}
