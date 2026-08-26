import { useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Select } from "@/components/common/Select";
import { ActivityForm } from "./ActivityForm";
import { useOpportunityOptions } from "@/hooks/useOpportunities";
import { useCreateActivityForAnyOpportunity } from "@/hooks/useActivities";
import type { ActivityFormValues } from "@/lib/formSchemas";

export function NewActivityModal({ open, onClose, defaultDate }: { open: boolean; onClose: () => void; defaultDate?: string }) {
  const { data: opportunities } = useOpportunityOptions();
  const [opportunityId, setOpportunityId] = useState("");
  const createActivity = useCreateActivityForAnyOpportunity();

  const handleClose = () => {
    setOpportunityId("");
    onClose();
  };

  const handleSubmit = (values: ActivityFormValues) => {
    if (!opportunityId) return;
    createActivity.mutate({ ...values, opportunity_id: opportunityId }, { onSuccess: handleClose });
  };

  return (
    <Modal open={open} onClose={handleClose} title="Nova atividade">
      <div className="space-y-4">
        <Select
          label="Oportunidade"
          placeholder="Selecione a oportunidade"
          options={(opportunities ?? []).map((o) => ({ value: o.id, label: `${o.company_name} — ${o.title}` }))}
          value={opportunityId}
          onChange={(e) => setOpportunityId(e.target.value)}
        />
        {opportunityId && (
          <ActivityForm
            defaultValues={{ due_at: defaultDate }}
            submitting={createActivity.isPending}
            onCancel={handleClose}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </Modal>
  );
}
