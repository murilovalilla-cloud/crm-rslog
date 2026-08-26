import { useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Search, X } from "lucide-react";
import { useKanban, useMoveOpportunityStage, useCreateOpportunity } from "@/hooks/useOpportunities";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useCurrentUser, useUsers } from "@/hooks/useCurrentUser";
import { KanbanColumn } from "./KanbanColumn";
import { OpportunityDrawer } from "@/components/Opportunities/OpportunityDrawer";
import { OpportunityForm } from "@/components/Opportunities/OpportunityForm";
import { LossReasonModal } from "@/components/Opportunities/LossReasonModal";
import { Modal } from "@/components/common/Modal";
import { Select } from "@/components/common/Select";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import type { OpportunityFormValues } from "@/lib/formSchemas";

export function KanbanBoard() {
  const [search, setSearch] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const { data, isLoading, error } = useKanban({ search: search || undefined, owner_id: ownerId || undefined });
  const { data: stages } = usePipelineStages();
  const { data: users } = useUsers();
  const { data: me } = useCurrentUser();
  const isAdmin = me?.role === "admin";
  const moveStage = useMoveOpportunityStage();
  const createOpportunity = useCreateOpportunity();

  const [openOpportunityId, setOpenOpportunityId] = useState<string | null>(null);
  const [newOppStageId, setNewOppStageId] = useState<string | null>(null);
  const [pendingLossMove, setPendingLossMove] = useState<{ opportunityId: string; stageId: string } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const opportunityId = String(active.id);
    const targetStageId = String(over.id);
    const currentStageId = active.data.current?.stageId as string | undefined;
    if (!targetStageId || targetStageId === currentStageId) return;

    const targetStage = stages?.find((s) => s.id === targetStageId);
    if (targetStage?.is_lost) {
      setPendingLossMove({ opportunityId, stageId: targetStageId });
      return;
    }
    moveStage.mutate({ id: opportunityId, stageId: targetStageId });
  };

  if (isLoading) return <LoadingSpinner label="Carregando funil..." />;
  if (error || !data) {
    return <EmptyState tone="error" title="Não foi possível carregar o funil" description="Recarregue a página para tentar novamente." />;
  }

  const opportunitiesByStage = new Map<string, typeof data.opportunities>();
  for (const opp of data.opportunities) {
    const list = opportunitiesByStage.get(opp.stage_id) ?? [];
    list.push(opp);
    opportunitiesByStage.set(opp.stage_id, list);
  }

  const totalValue = data.opportunities.reduce((sum, o) => sum + (o.value ?? 0), 0);
  const ownerName = users?.find((u) => u.id === ownerId)?.name;
  const hasActiveFilters = Boolean(search || ownerId);
  const clearFilters = () => {
    setSearch("");
    setOwnerId("");
  };

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Barra de busca e filtros: reúne os controles em uma única faixa
          compacta, com indicação clara de filtros ativos e uma ação para
          limpá-los de uma vez. */}
      <div className="card flex flex-wrap items-center gap-2 p-2.5">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} aria-hidden="true" />
          <input
            className="field-input pl-8"
            placeholder="Buscar empresa ou título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* Vendedor só vê as próprias oportunidades — o backend já restringe
            isso, então o filtro por responsável só faz sentido pro admin. */}
        {isAdmin && (
          <div className="w-full sm:w-52">
            <Select
              placeholder="Todos os responsáveis"
              options={(users ?? []).map((u) => ({ value: u.id, label: u.name }))}
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            />
          </div>
        )}

        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5">
            {search && (
              <span className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2.5 py-1 text-xs font-medium text-navy-700">
                “{search}”
              </span>
            )}
            {isAdmin && ownerName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-navy-50 px-2.5 py-1 text-xs font-medium text-navy-700">
                {ownerName}
              </span>
            )}
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
              Limpar filtros
            </button>
          </div>
        )}

        <span className="ml-auto hidden shrink-0 text-xs text-slate-400 sm:inline">
          {data.opportunities.length} {data.opportunities.length === 1 ? "oportunidade" : "oportunidades"} · {formatCurrencyBRL(totalValue)}
        </span>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className={cn("flex flex-1 gap-3 overflow-x-auto pb-2", data.stages.length === 0 && "items-center justify-center")}>
          {data.stages.length === 0 ? (
            <EmptyState title="Nenhuma etapa de funil configurada" description="Configure as etapas do pipeline para começar a usar o Kanban." />
          ) : (
            data.stages.map((stage) => (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                opportunities={opportunitiesByStage.get(stage.id) ?? []}
                onOpenOpportunity={setOpenOpportunityId}
                onAddOpportunity={setNewOppStageId}
              />
            ))
          )}
        </div>
      </DndContext>

      {openOpportunityId && (
        <OpportunityDrawer opportunityId={openOpportunityId} onClose={() => setOpenOpportunityId(null)} />
      )}

      <Modal open={!!newOppStageId} onClose={() => setNewOppStageId(null)} title="Nova oportunidade">
        <OpportunityForm
          submitting={createOpportunity.isPending}
          onCancel={() => setNewOppStageId(null)}
          onSubmit={(values: OpportunityFormValues) =>
            createOpportunity.mutate(
              { ...values, stage_id: newOppStageId ?? undefined },
              { onSuccess: () => setNewOppStageId(null) }
            )
          }
        />
      </Modal>

      <LossReasonModal
        open={!!pendingLossMove}
        onCancel={() => setPendingLossMove(null)}
        submitting={moveStage.isPending}
        onConfirm={(reasonId) => {
          if (!pendingLossMove) return;
          moveStage.mutate(
            { id: pendingLossMove.opportunityId, stageId: pendingLossMove.stageId, lossReasonId: reasonId },
            { onSuccess: () => setPendingLossMove(null) }
          );
        }}
      />
    </div>
  );
}
