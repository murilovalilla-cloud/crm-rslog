import { useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { useKanban, useMoveOpportunityStage, useCreateOpportunity } from "@/hooks/useOpportunities";
import { usePipelineStages } from "@/hooks/usePipelineStages";
import { useUsers } from "@/hooks/useCurrentUser";
import { KanbanColumn } from "./KanbanColumn";
import { OpportunityDrawer } from "@/components/Opportunities/OpportunityDrawer";
import { OpportunityForm } from "@/components/Opportunities/OpportunityForm";
import { LossReasonModal } from "@/components/Opportunities/LossReasonModal";
import { Modal } from "@/components/common/Modal";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Select";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import type { OpportunityFormValues } from "@/lib/formSchemas";

export function KanbanBoard() {
  const [search, setSearch] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const { data, isLoading, error } = useKanban({ search: search || undefined, owner_id: ownerId || undefined });
  const { data: stages } = usePipelineStages();
  const { data: users } = useUsers();
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

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Input placeholder="Buscar empresa ou título..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="w-48">
          <Select
            placeholder="Todos os responsáveis"
            options={(users ?? []).map((u) => ({ value: u.id, label: u.name }))}
            value={ownerId}
            onChange={(e) => setOwnerId(e.target.value)}
          />
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 gap-3 overflow-x-auto pb-2">
          {data.stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              opportunities={opportunitiesByStage.get(stage.id) ?? []}
              onOpenOpportunity={setOpenOpportunityId}
              onAddOpportunity={setNewOppStageId}
            />
          ))}
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
