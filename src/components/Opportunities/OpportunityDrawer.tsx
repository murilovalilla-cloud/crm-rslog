import { useState, type FormEvent } from "react";
import { useOpportunity, useAddHistoryEntry, useAddNote, useDeleteNote, useMoveOpportunityStage, useUpdateOpportunity, useDeleteOpportunity } from "@/hooks/useOpportunities";
import { useCreateActivity, useCompleteActivity, useDeleteActivity } from "@/hooks/useActivities";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { Select } from "@/components/common/Select";
import { Textarea } from "@/components/common/Textarea";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { HistoryTimeline } from "./HistoryTimeline";
import { OpportunityForm } from "./OpportunityForm";
import { ActivityForm } from "@/components/Activities/ActivityForm";
import { ActivityBadge } from "@/components/Activities/ActivityBadge";
import { LossReasonModal } from "./LossReasonModal";
import { QuotesPanel } from "@/components/Quotes/QuotesPanel";
import { ACTIVITY_TYPE_LABELS, formatCurrencyBRL, formatDateTime } from "@/lib/utils";
import { historyFormSchema, noteFormSchema, type ActivityFormValues, type HistoryFormValues, type NoteFormValues, type OpportunityFormValues } from "@/lib/formSchemas";

const HISTORY_TYPE_OPTIONS = [
  { value: "ligacao", label: "Ligação" },
  { value: "email", label: "E-mail" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "reuniao", label: "Reunião" },
  { value: "visita", label: "Visita" },
  { value: "cotacao", label: "Cotação" },
  { value: "observacao", label: "Observação" },
];

export function OpportunityDrawer({ opportunityId, onClose }: { opportunityId: string; onClose: () => void }) {
  const { data, isLoading, error } = useOpportunity(opportunityId);
  const { data: stages } = usePipelineStages();

  const moveStage = useMoveOpportunityStage();
  const updateOpportunity = useUpdateOpportunity(opportunityId);
  const deleteOpportunity = useDeleteOpportunity();
  const addHistory = useAddHistoryEntry(opportunityId);
  const addNote = useAddNote(opportunityId);
  const deleteNote = useDeleteNote(opportunityId);
  const createActivity = useCreateActivity(opportunityId);
  const completeActivity = useCompleteActivity(opportunityId);
  const deleteActivity = useDeleteActivity(opportunityId);

  const [editingOpp, setEditingOpp] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [historyValues, setHistoryValues] = useState<HistoryFormValues>({ type: "observacao", description: "" });
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [lossReasonPrompt, setLossReasonPrompt] = useState<string | null>(null);

  const handleStageChange = (stageId: string) => {
    const targetStage = stages?.find((s) => s.id === stageId);
    if (targetStage?.is_lost) {
      setLossReasonPrompt(stageId);
      return;
    }
    moveStage.mutate({ id: opportunityId, stageId });
  };

  const submitHistory = (e: FormEvent) => {
    e.preventDefault();
    const parsed = historyFormSchema.safeParse(historyValues);
    if (!parsed.success) {
      setHistoryError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    setHistoryError(null);
    addHistory.mutate(parsed.data, {
      onSuccess: () => setHistoryValues({ type: "observacao", description: "" }),
    });
  };

  const submitNote = (e: FormEvent) => {
    e.preventDefault();
    const parsed = noteFormSchema.safeParse({ content: noteValue } satisfies NoteFormValues);
    if (!parsed.success) {
      setNoteError(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    setNoteError(null);
    addNote.mutate(parsed.data, { onSuccess: () => setNoteValue("") });
  };

  return (
    <Modal open onClose={onClose} title={data ? data.title : "Oportunidade"} widthClass="max-w-3xl">
      {isLoading && <LoadingSpinner label="Carregando oportunidade..." />}
      {error && <EmptyState tone="error" title="Não foi possível carregar" description="Tente fechar e abrir novamente." />}

      {data && (
        <div className="space-y-6">
          {editingOpp ? (
            <OpportunityForm
              initial={data}
              fixedCompanyId={data.company_id}
              submitting={updateOpportunity.isPending}
              onCancel={() => setEditingOpp(false)}
              onSubmit={(values: OpportunityFormValues) =>
                updateOpportunity.mutate(values, { onSuccess: () => setEditingOpp(false) })
              }
            />
          ) : (
            <>
              {/* Resumo */}
              <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">Empresa</p>
                  <p className="text-sm font-semibold text-slate-800">{data.company_name}</p>
                  {data.company_phone && <p className="text-xs text-slate-500">{data.company_phone}</p>}
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">Valor da oportunidade</p>
                  <p className="text-sm font-semibold text-slate-800">{formatCurrencyBRL(data.value)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">Responsável</p>
                  <p className="text-sm text-slate-700">{data.owner_name ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">Decisor</p>
                  <p className="text-sm text-slate-700">
                    {data.contacts.find((c) => c.id === data.contact_id)?.name ?? data.decision_maker_name ?? "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-slate-400">Próxima atividade</p>
                  {data.next_activity ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-700">
                        {ACTIVITY_TYPE_LABELS[data.next_activity.type]} · {formatDateTime(data.next_activity.due_at)}
                      </span>
                      <ActivityBadge level={data.alert_level ?? null} overdueDays={data.overdue_days} dueAt={data.next_activity.due_at} />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Nenhuma atividade agendada</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  label="Etapa do funil"
                  options={(stages ?? []).map((s) => ({ value: s.id, label: s.name }))}
                  value={data.stage_id}
                  onChange={(e) => handleStageChange(e.target.value)}
                  className="min-w-[220px]"
                />
                <div className="ml-auto flex gap-2 self-end">
                  <Button variant="secondary" onClick={() => setEditingOpp(true)}>
                    Editar
                  </Button>
                  <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                    Excluir
                  </Button>
                </div>
              </div>

              {/* Contatos */}
              <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Contatos da empresa</h3>
                {data.contacts.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhum contato cadastrado para esta empresa.</p>
                ) : (
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {data.contacts.map((contact) => (
                      <li key={contact.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                        <p className="font-medium text-slate-700">
                          {contact.name}
                          {contact.is_decision_maker === 1 && (
                            <span className="ml-1.5 rounded bg-navy-50 px-1.5 py-0.5 text-[10px] font-semibold text-navy-600">
                              DECISOR
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
                          {[contact.email, contact.whatsapp].filter(Boolean).join(" · ") || "Sem contato direto"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Cotações */}
              <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Cotações</h3>
                <QuotesPanel opportunityId={opportunityId} quotes={data.quotes} contacts={data.contacts} />
              </section>

              {/* Atividades agendadas */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">Atividades</h3>
                  <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => setShowActivityForm((s) => !s)}>
                    {showActivityForm ? "Cancelar" : "+ Agendar atividade"}
                  </Button>
                </div>

                {showActivityForm && (
                  <div className="mb-3 rounded-md border border-slate-200 p-3">
                    <ActivityForm
                      submitting={createActivity.isPending}
                      onCancel={() => setShowActivityForm(false)}
                      onSubmit={(values: ActivityFormValues) =>
                        createActivity.mutate(values, { onSuccess: () => setShowActivityForm(false) })
                      }
                    />
                  </div>
                )}

                {data.activities.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhuma atividade cadastrada.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.activities.map((activity) => (
                      <li
                        key={activity.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium text-slate-700">
                            {ACTIVITY_TYPE_LABELS[activity.type]} · {activity.title}
                          </p>
                          <p className="text-xs text-slate-400">{formatDateTime(activity.due_at)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {activity.status === "pendente" ? (
                            <>
                              <ActivityBadge level={activity.alert_level ?? null} overdueDays={activity.overdue_days} dueAt={activity.due_at} />
                              <Button
                                variant="secondary"
                                className="!px-2 !py-1 text-xs"
                                loading={completeActivity.isPending}
                                onClick={() => completeActivity.mutate({ id: activity.id })}
                              >
                                Concluir
                              </Button>
                              <button
                                className="text-xs text-red-600 hover:underline"
                                onClick={() => deleteActivity.mutate(activity.id)}
                              >
                                Excluir
                              </button>
                            </>
                          ) : (
                            <ActivityBadge level="concluida" />
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Registrar interação manual */}
              <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Registrar interação</h3>
                <form onSubmit={submitHistory} className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 p-3">
                  <div className="w-40">
                    <Select
                      label="Tipo"
                      options={HISTORY_TYPE_OPTIONS}
                      value={historyValues.type}
                      onChange={(e) =>
                        setHistoryValues((v) => ({ ...v, type: e.target.value as HistoryFormValues["type"] }))
                      }
                    />
                  </div>
                  <div className="min-w-[220px] flex-1">
                    <Textarea
                      label="O que aconteceu"
                      value={historyValues.description}
                      error={historyError ?? undefined}
                      onChange={(e) => setHistoryValues((v) => ({ ...v, description: e.target.value }))}
                    />
                  </div>
                  <Button type="submit" loading={addHistory.isPending}>
                    Registrar
                  </Button>
                </form>
              </section>

              {/* Histórico cronológico */}
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Histórico</h3>
                <HistoryTimeline entries={data.history} />
              </section>

              {/* Notas */}
              <section>
                <h3 className="mb-2 text-sm font-semibold text-slate-700">Anotações</h3>
                <form onSubmit={submitNote} className="mb-3 flex items-end gap-2">
                  <div className="flex-1">
                    <Textarea
                      placeholder="Escreva uma anotação..."
                      value={noteValue}
                      error={noteError ?? undefined}
                      onChange={(e) => setNoteValue(e.target.value)}
                    />
                  </div>
                  <Button type="submit" loading={addNote.isPending}>
                    Adicionar
                  </Button>
                </form>
                {data.notes.length === 0 ? (
                  <p className="text-sm text-slate-400">Nenhuma anotação ainda.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.notes.map((note) => (
                      <li key={note.id} className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        <div className="flex items-start justify-between gap-2">
                          <p>{note.content}</p>
                          <button
                            className="shrink-0 text-xs text-amber-700 hover:underline"
                            onClick={() => deleteNote.mutate(note.id)}
                          >
                            Excluir
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-amber-600">
                          {note.created_by_name} · {formatDateTime(note.created_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir oportunidade"
        message="Esta ação exclui a oportunidade, suas atividades, histórico e notas. Não pode ser desfeita."
        loading={deleteOpportunity.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => deleteOpportunity.mutate(opportunityId, { onSuccess: onClose })}
      />

      <LossReasonModal
        open={!!lossReasonPrompt}
        onCancel={() => setLossReasonPrompt(null)}
        onConfirm={(reasonId) => {
          if (!lossReasonPrompt) return;
          moveStage.mutate(
            { id: opportunityId, stageId: lossReasonPrompt, lossReasonId: reasonId },
            { onSuccess: () => setLossReasonPrompt(null) }
          );
        }}
        submitting={moveStage.isPending}
      />
    </Modal>
  );
}
