import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
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
    <div className="flex w-72 shrink-0 flex-col rounded-card border border-slate-200 bg-slate-100/70">
      {/* Cabeçalho discreto: um ponto colorido identifica a etapa em vez de
          preencher o bloco inteiro de cor sólida — mantém a paleta neutra
          predominando e o navy como único destaque de marca. */}
      <div className="sticky top-0 z-10 rounded-t-card border-b border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: stage.color }} aria-hidden="true" />
            <h3 className="truncate text-sm font-semibold text-slate-700">{stage.name}</h3>
          </div>
          <button
            onClick={() => onAddOpportunity(stage.id)}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-navy-600"
            title="Nova oportunidade nesta etapa"
            aria-label="Nova oportunidade nesta etapa"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
        <p className="mt-0.5 text-xs text-slate-400">
          {opportunities.length} {opportunities.length === 1 ? "card" : "cards"} · {formatCurrencyBRL(total)}
        </p>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 space-y-2 overflow-y-auto p-2",
          "min-h-[120px] max-h-[calc(100vh-220px)]",
          isOver && "bg-navy-50/70"
        )}
      >
        {opportunities.length === 0 && (
          <div className="flex flex-col items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-8 text-center">
            <p className="text-xs text-slate-400">Nenhuma oportunidade nesta etapa</p>
          </div>
        )}
        {opportunities.map((opp) => (
          <KanbanCard key={opp.id} opportunity={opp} onOpen={() => onOpenOpportunity(opp.id)} />
        ))}
      </div>
    </div>
  );
}
