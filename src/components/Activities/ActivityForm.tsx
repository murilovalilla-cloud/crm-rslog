import { useState, type FormEvent } from "react";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Select";
import { Textarea } from "@/components/common/Textarea";
import { Button } from "@/components/common/Button";
import { activityFormSchema, type ActivityFormValues } from "@/lib/formSchemas";
import { useUsers } from "@/hooks/useCurrentUser";

const TYPE_OPTIONS = [
  { value: "ligacao", label: "Ligação" },
  { value: "email", label: "E-mail" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "reuniao", label: "Reunião" },
  { value: "visita", label: "Visita" },
  { value: "followup", label: "Follow-up" },
  { value: "outro", label: "Outro" },
];

interface ActivityFormProps {
  defaultValues?: Partial<ActivityFormValues>;
  onSubmit: (values: ActivityFormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function ActivityForm({ defaultValues, onSubmit, onCancel, submitting }: ActivityFormProps) {
  const { data: users } = useUsers();
  const [values, setValues] = useState<ActivityFormValues>({
    type: defaultValues?.type ?? "ligacao",
    title: defaultValues?.title ?? "",
    description: defaultValues?.description ?? "",
    due_at: defaultValues?.due_at ?? "",
    owner_id: defaultValues?.owner_id ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = activityFormSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Tipo"
          options={TYPE_OPTIONS}
          value={values.type}
          onChange={(e) => setValues((v) => ({ ...v, type: e.target.value as ActivityFormValues["type"] }))}
        />
        <Input
          label="Data e hora"
          type="datetime-local"
          value={values.due_at}
          error={errors.due_at}
          onChange={(e) => setValues((v) => ({ ...v, due_at: e.target.value }))}
        />
      </div>
      <Input
        label="Título"
        placeholder="Ex.: Ligar para confirmar cotação"
        value={values.title}
        error={errors.title}
        onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
      />
      <Textarea
        label="Descrição (opcional)"
        value={values.description}
        onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
      />
      <Select
        label="Responsável"
        placeholder="Eu mesmo"
        options={(users ?? []).map((u) => ({ value: u.id, label: u.name }))}
        value={values.owner_id}
        onChange={(e) => setValues((v) => ({ ...v, owner_id: e.target.value }))}
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={submitting}>
          Salvar atividade
        </Button>
      </div>
    </form>
  );
}
