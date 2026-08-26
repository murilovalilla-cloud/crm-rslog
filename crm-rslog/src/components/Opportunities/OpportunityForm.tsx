import { useState, type FormEvent } from "react";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Select";
import { Button } from "@/components/common/Button";
import { opportunityFormSchema, type OpportunityFormValues } from "@/lib/formSchemas";
import { useCompanyOptions } from "@/hooks/useCompanies";
import { useContacts } from "@/hooks/useContacts";
import { useUsers } from "@/hooks/useCurrentUser";
import type { Opportunity } from "@/lib/types";

interface OpportunityFormProps {
  initial?: Opportunity | null;
  fixedCompanyId?: string;
  onSubmit: (values: OpportunityFormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function OpportunityForm({ initial, fixedCompanyId, onSubmit, onCancel, submitting }: OpportunityFormProps) {
  const { data: companiesPage } = useCompanyOptions();
  const { data: users } = useUsers();
  const [values, setValues] = useState<OpportunityFormValues>({
    company_id: initial?.company_id ?? fixedCompanyId ?? "",
    contact_id: initial?.contact_id ?? "",
    title: initial?.title ?? "",
    owner_id: initial?.owner_id ?? "",
    value: initial?.value !== undefined && initial?.value !== null ? String(initial.value) : "",
    expected_close_date: initial?.expected_close_date?.slice(0, 10) ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { data: contacts } = useContacts(values.company_id || null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = opportunityFormSchema.safeParse(values);
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
      <Select
        label="Empresa"
        placeholder="Selecione a empresa"
        disabled={!!fixedCompanyId}
        options={(companiesPage?.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
        error={errors.company_id}
        value={values.company_id}
        onChange={(e) => setValues((v) => ({ ...v, company_id: e.target.value, contact_id: "" }))}
      />
      <Input
        label="Título da oportunidade"
        placeholder="Ex.: Frete fracionado — safra de soja"
        value={values.title}
        error={errors.title}
        onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Contato / decisor"
          placeholder="Selecione"
          options={(contacts ?? []).map((c) => ({ value: c.id, label: c.name }))}
          value={values.contact_id}
          onChange={(e) => setValues((v) => ({ ...v, contact_id: e.target.value }))}
        />
        <Select
          label="Responsável comercial"
          placeholder="Eu mesmo"
          options={(users ?? []).map((u) => ({ value: u.id, label: u.name }))}
          value={values.owner_id}
          onChange={(e) => setValues((v) => ({ ...v, owner_id: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Valor estimado (R$)"
          inputMode="decimal"
          placeholder="0,00"
          value={values.value}
          error={errors.value}
          onChange={(e) => setValues((v) => ({ ...v, value: e.target.value }))}
        />
        <Input
          label="Previsão de fechamento"
          type="date"
          value={values.expected_close_date}
          onChange={(e) => setValues((v) => ({ ...v, expected_close_date: e.target.value }))}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={submitting}>
          Salvar oportunidade
        </Button>
      </div>
    </form>
  );
}
