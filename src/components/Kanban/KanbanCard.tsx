import { useDraggable } from "@dnd-kit/core";
import { CalendarClock, User } from "lucide-react";
import type { Opportunity } from "@/lib/types";
import { ACTIVITY_TYPE_LABELS, cn, formatCurrencyBRL } from "@/lib/utils";
import { ActivityBadge } from "@/components/Activities/ActivityBadge";

export function KanbanCard({ opportunity, onOpen }: { opportunity: Opportunity; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: opportunity.id,
    data: { stageId: opportunity.stage_id },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const decisionMaker = opportunity.contact_name ?? opportunity.decision_maker_name;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
      className={cn(
        "card group cursor-grab select-none p-3 text-sm transition-all active:cursor-grabbing",
        "hover:-translate-y-px hover:shadow-card focus-visible:-translate-y-px",
        isDragging && "z-10 rotate-1 opacity-90 shadow-raised"
      )}
    >
      <p className="truncate font-semibold leading-tight text-slate-800">{opportunity.company_name}</p>
      <p className="mt-0.5 truncate text-xs text-slate-500">{opportunity.title}</p>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 truncate text-xs text-slate-500">
          <User className="h-3 w-3 shrink-0 text-slate-300" strokeWidth={2} aria-hidden="true" />
          <span className="truncate">{decisionMaker ?? "Sem decisor definido"}</span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-slate-700">{formatCurrencyBRL(opportunity.value)}</span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
        {opportunity.next_activity ? (
          <span className="flex min-w-0 items-center gap-1 truncate text-xs text-slate-400">
            <CalendarClock className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden="true" />
            <span className="truncate">{ACTIVITY_TYPE_LABELS[opportunity.next_activity.type]}</span>
          </span>
        ) : (
          <span className="text-xs text-slate-300">Sem atividade agendada</span>
        )}
        <ActivityBadge
          level={opportunity.alert_level ?? null}
          overdueDays={opportunity.overdue_days}
          dueAt={opportunity.next_activity?.due_at}
        />
      </div>

      <p className="mt-1.5 truncate text-[11px] text-slate-400">{opportunity.owner_name ?? "Sem responsável"}</p>
    </div>
  );
}
