import { useState, type FormEvent } from "react";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Select";
import { Textarea } from "@/components/common/Textarea";
import { Button } from "@/components/common/Button";
import { companyFormSchema, type CompanyFormValues } from "@/lib/formSchemas";
import { useUsers } from "@/hooks/useCurrentUser";
import type { Company } from "@/lib/types";

interface CompanyFormProps {
  initial?: Company | null;
  onSubmit: (values: CompanyFormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
  serverError?: string | null;
}

const BR_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI",
  "RJ","RN","RS","RO","RR","SC","SP","SE","TO",
].map((uf) => ({ value: uf, label: uf }));

const LEAD_SOURCE_OPTIONS = [
  { value: "Prospecção ativa", label: "Prospecção ativa" },
  { value: "Indicação de cliente", label: "Indicação de cliente" },
  { value: "Instagram", label: "Instagram" },
  { value: "Google", label: "Google" },
  { value: "Facebook", label: "Facebook" },
];

export function CompanyForm({ initial, onSubmit, onCancel, submitting, serverError }: CompanyFormProps) {
  const { data: users } = useUsers();
  const [values, setValues] = useState<CompanyFormValues>({
    name: initial?.name ?? "",
    cnpj: initial?.cnpj ?? "",
    segment: initial?.segment ?? "",
    website: initial?.website ?? "",
    phone: initial?.phone ?? "",
    city: initial?.city ?? "",
    state: initial?.state ?? "",
    source: initial?.source ?? "",
    notes: initial?.notes ?? "",
    owner_id: initial?.owner_id ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = companyFormSchema.safeParse(values);
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
      {serverError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>}

      <Input
        label="Nome da empresa"
        value={values.name}
        error={errors.name}
        onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="CNPJ"
          value={values.cnpj}
          onChange={(e) => setValues((v) => ({ ...v, cnpj: e.target.value }))}
        />
        <Input
          label="Segmento"
          value={values.segment}
          onChange={(e) => setValues((v) => ({ ...v, segment: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Telefone"
          value={values.phone}
          onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
        />
        <Input
          label="Site"
          value={values.website}
          onChange={(e) => setValues((v) => ({ ...v, website: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Input
            label="Cidade"
            value={values.city}
            onChange={(e) => setValues((v) => ({ ...v, city: e.target.value }))}
          />
        </div>
        <Select
          label="UF"
          placeholder="—"
          options={BR_STATES}
          error={errors.state}
          value={values.state}
          onChange={(e) => setValues((v) => ({ ...v, state: e.target.value }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Origem do lead"
          placeholder="Selecione"
          options={LEAD_SOURCE_OPTIONS}
          value={values.source}
          onChange={(e) => setValues((v) => ({ ...v, source: e.target.value }))}
        />
        <Select
          label="Responsável comercial"
          placeholder="Selecione"
          options={(users ?? []).map((u) => ({ value: u.id, label: u.name }))}
          value={values.owner_id}
          onChange={(e) => setValues((v) => ({ ...v, owner_id: e.target.value }))}
        />
      </div>

      <Textarea
        label="Observações"
        value={values.notes}
        onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
      />

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={submitting}>
          Salvar empresa
        </Button>
      </div>
    </form>
  );
}
