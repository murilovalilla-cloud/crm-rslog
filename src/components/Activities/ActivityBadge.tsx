import type { AlertLevel } from "@/lib/types";
import { ALERT_CLASSES, daysUntilDue } from "@/lib/utils";
import { Badge } from "@/components/common/Badge";

/**
 * Badge de status de uma atividade. Em vez de um texto estático como
 * "Agendada", mostra a contagem de dias: quantos dias faltam (azul),
 * "Vence hoje" (amarelo) no dia do vencimento, ou há quantos dias está
 * atrasada (vermelho) — conforme pedido pelo usuário.
 */
export function ActivityBadge({
  level,
  overdueDays,
  dueAt,
}: {
  level: AlertLevel;
  overdueDays?: number;
  dueAt?: string | null;
}) {
  if (!level) return null;

  let label: string;
  if (level === "atrasada") {
    label = overdueDays ? `Atrasada há ${overdueDays}d` : "Atrasada";
  } else if (level === "hoje") {
    label = "Vence hoje";
  } else if (level === "futura") {
    const days = daysUntilDue(dueAt);
    label = days && days > 0 ? `Em ${days}d` : "Agendada";
  } else {
    label = "Concluída";
  }

  return <Badge className={ALERT_CLASSES[level]}>{label}</Badge>;
}
