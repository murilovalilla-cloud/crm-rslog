import type { AlertLevel } from "@/lib/types";
import { ALERT_CLASSES, ALERT_LABELS } from "@/lib/utils";
import { Badge } from "@/components/common/Badge";

export function ActivityBadge({ level, overdueDays }: { level: AlertLevel; overdueDays?: number }) {
  if (!level) return null;
  const label = ALERT_LABELS[level];
  const suffix = level === "atrasada" && overdueDays ? ` (${overdueDays}d)` : "";
  return <Badge className={ALERT_CLASSES[level]}>{label}{suffix}</Badge>;
}
