import { useDroppable } from "@dnd-kit/core";
import type { Opportunity, PipelineStage } from "@/lib/types";
import { cn, formatCurrencyBRL } from "@/lib/utils";
import { KanbanCard } from "./KanbanCard";

interface KanbanColumnProps {
  stage: PipelineStage;
  opportunities: Opportunity[];
  onOpenOpportunity: (id: string) => void;
  onAddOpportunity: (stageId: string) => void;
}

export function KanbanColumn({ stage, opportunities, onOpenOpportunity, onAddOpportunity }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = opportunities.reduce((sum, o) => sum + (o.value ?? 0), 0);

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg bg-slate-200/60">
      <div className="rounded-t-lg bg-navy-600 px-3 py-2 text-white">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-semibold">{stage.name}</h3>
          <button
            onClick={() => onAddOpportunity(stage.id)}
            className="rounded bg-white/10 px-1.5 text-sm hover:bg-white/20"
            title="Nova oportunidade nesta etapa"
          >
            +
          </button>
        </div>
        <p className="text-xs text-navy-100">
          {opportunities.length} {opportunities.length === 1 ? "card" : "cards"} · {formatCurrencyBRL(total)}
        </p>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 overflow-y-auto p-2",
          "min-h-[120px] max-h-[calc(100vh-220px)]",
          isOver && "bg-navy-50"
        )}
      >
        {opportunities.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-slate-400">Nenhuma oportunidade nesta etapa</p>
        )}
        {opportunities.map((opp) => (
          <KanbanCard key={opp.id} opportunity={opp} onOpen={() => onOpenOpportunity(opp.id)} />
        ))}
      </div>
    </div>
  );
}
