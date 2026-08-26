import { useMemo, useState } from "react";
import { useActivities, useCompleteActivity, useDeleteActivity } from "@/hooks/useActivities";
import { useUsers } from "@/hooks/useCurrentUser";
import { Button } from "@/components/common/Button";
import { Select } from "@/components/common/Select";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { NewActivityModal } from "@/components/Activities/NewActivityModal";
import { ActivityBadge } from "@/components/Activities/ActivityBadge";
import { ACTIVITY_TYPE_LABELS, ALERT_DOT_CLASSES, cn, formatDateTime } from "@/lib/utils";
import type { Activity } from "@/lib/types";

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // segunda-feira = 0
  const start = new Date(year, month, 1 - startWeekday);
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function CalendarPage() {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(dateKey(today));
  const [ownerId, setOwnerId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const { data: users } = useUsers();

  const days = useMemo(() => buildMonthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const from = days[0].toISOString();
  const to = new Date(days[41].getFullYear(), days[41].getMonth(), days[41].getDate(), 23, 59, 59).toISOString();

  const { data: activities, isLoading, error } = useActivities({ from, to, owner_id: ownerId || undefined });
  const completeActivity = useCompleteActivity();
  const deleteActivity = useDeleteActivity();

  const activitiesByDay = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const activity of activities ?? []) {
      const key = dateKey(new Date(activity.due_at));
      const list = map.get(key) ?? [];
      list.push(activity);
      map.set(key, list);
    }
    return map;
  }, [activities]);

  const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(cursor);
  const selectedActivities = (activitiesByDay.get(selectedDay) ?? []).sort((a, b) => a.due_at.localeCompare(b.due_at));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            ←
          </Button>
          <h2 className="w-40 text-center text-sm font-semibold capitalize text-slate-700">{monthLabel}</h2>
          <Button variant="secondary" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            →
          </Button>
          <Button variant="ghost" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>
            Hoje
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-48">
            <Select
              placeholder="Todos os responsáveis"
              options={(users ?? []).map((u) => ({ value: u.id, label: u.name }))}
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            />
          </div>
          <Button onClick={() => setModalOpen(true)}>+ Nova atividade</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <LegendDot color="bg-alert-overdue" label="Atrasada" />
        <LegendDot color="bg-alert-today" label="Vence hoje" />
        <LegendDot color="bg-alert-upcoming" label="Futura" />
        <LegendDot color="bg-alert-done" label="Concluída" />
      </div>

      {isLoading && <LoadingSpinner label="Carregando calendário..." />}
      {error && <EmptyState tone="error" title="Não foi possível carregar as atividades" />}

      {activities && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
              {WEEKDAY_LABELS.map((d) => (
                <div key={d} className="px-2 py-2 text-center">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const key = dateKey(day);
                const dayActivities = activitiesByDay.get(key) ?? [];
                const isCurrentMonth = day.getMonth() === cursor.getMonth();
                const isToday = key === dateKey(today);
                const isSelected = key === selectedDay;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedDay(key)}
                    className={cn(
                      "min-h-[84px] border-b border-r border-slate-100 p-1.5 text-left align-top",
                      !isCurrentMonth && "bg-slate-50 text-slate-300",
                      isSelected && "ring-2 ring-inset ring-navy-500"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                        isToday && "bg-navy-600 font-semibold text-white"
                      )}
                    >
                      {day.getDate()}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayActivities.slice(0, 3).map((activity) => (
                        <div key={activity.id} className="flex items-center gap-1 truncate text-[11px] text-slate-600">
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", ALERT_DOT_CLASSES[activity.alert_level ?? "futura"])} />
                          <span className="truncate">{activity.company_name}</span>
                        </div>
                      ))}
                      {dayActivities.length > 3 && (
                        <p className="text-[11px] text-slate-400">+{dayActivities.length - 3} mais</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", weekday: "long" }).format(
                new Date(`${selectedDay}T00:00:00`)
              )}
            </h3>
            {selectedActivities.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma atividade neste dia.</p>
            ) : (
              <ul className="space-y-3">
                {selectedActivities.map((activity) => (
                  <li key={activity.id} className="rounded-md border border-slate-200 p-2.5 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-700">{activity.company_name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {ACTIVITY_TYPE_LABELS[activity.type]} · {activity.title}
                        </p>
                        <p className="text-xs text-slate-400">{formatDateTime(activity.due_at)}</p>
                      </div>
                      <ActivityBadge level={activity.alert_level ?? null} overdueDays={activity.overdue_days} />
                    </div>
                    {activity.status === "pendente" && (
                      <div className="mt-2 flex gap-2">
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
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <NewActivityModal open={modalOpen} onClose={() => setModalOpen(false)} defaultDate={`${selectedDay}T09:00`} />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", color)} />
      {label}
    </span>
  );
}
