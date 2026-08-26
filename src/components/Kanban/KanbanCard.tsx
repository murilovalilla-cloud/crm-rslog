import { useDraggable } from "@dnd-kit/core";
import type { Opportunity } from "@/lib/types";
import { ACTIVITY_TYPE_LABELS, cn, formatCurrencyBRL, formatDate } from "@/lib/utils";
import { ActivityBadge } from "@/components/Activities/ActivityBadge";

export function KanbanCard({ opportunity, onOpen }: { opportunity: Opportunity; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: opportunity.id,
    data: { stageId: opportunity.stage_id },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      className={cn(
        "card cursor-grab select-none space-y-2 p-3 text-sm active:cursor-grabbing",
        isDragging && "z-10 opacity-70 shadow-lg"
      )}
    >
      <p className="truncate font-semibold text-slate-800">{opportunity.company_name}</p>
      <p className="truncate text-xs text-slate-500">{opportunity.title}</p>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="truncate">{opportunity.contact_name ?? "Sem decisor definido"}</span>
        <span className="shrink-0 font-medium text-slate-700">{formatCurrencyBRL(opportunity.value)}</span>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="truncate">{opportunity.owner_name ?? "Sem responsável"}</span>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
        {opportunity.next_activity ? (
          <span className="truncate text-xs text-slate-500">
            {ACTIVITY_TYPE_LABELS[opportunity.next_activity.type]} · {formatDate(opportunity.next_activity.due_at)}
          </span>
        ) : (
          <span className="text-xs text-slate-300">Sem atividade agendada</span>
        )}
        <ActivityBadge level={opportunity.alert_level ?? null} overdueDays={opportunity.overdue_days} />
      </div>
    </div>
  );
}
