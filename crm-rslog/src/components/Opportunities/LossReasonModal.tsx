import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Select } from "@/components/common/Select";
import { Button } from "@/components/common/Button";
import { useLossReasons } from "@/hooks/useLossReasons";

interface LossReasonModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (reasonId: string) => void;
  submitting?: boolean;
}

/** Modal usado sempre que uma oportunidade é movida para uma etapa de perda — no Kanban (drag) ou no painel de detalhe. */
export function LossReasonModal({ open, onCancel, onConfirm, submitting }: LossReasonModalProps) {
  const [reason, setReason] = useState("");
  const { data: reasons, isLoading } = useLossReasons();

  return (
    <Modal open={open} onClose={onCancel} title="Motivo da perda" widthClass="max-w-sm">
      <div className="space-y-4">
        <Select
          label="Por que esta oportunidade foi perdida?"
          placeholder={isLoading ? "Carregando..." : "Selecione um motivo"}
          options={(reasons ?? []).map((r) => ({ value: r.id, label: r.name }))}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="danger" disabled={!reason} loading={submitting} onClick={() => onConfirm(reason)}>
            Confirmar perda
          </Button>
        </div>
      </div>
    </Modal>
  );
}
