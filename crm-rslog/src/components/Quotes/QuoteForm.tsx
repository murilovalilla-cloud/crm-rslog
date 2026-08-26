import { useState, type FormEvent } from "react";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Select";
import { Textarea } from "@/components/common/Textarea";
import { Button } from "@/components/common/Button";
import { quoteFormSchema, type QuoteFormValues } from "@/lib/formSchemas";
import type { Contact, Quote } from "@/lib/types";

interface QuoteFormProps {
  contacts: Contact[];
  initial?: Quote | null;
  onSubmit: (values: QuoteFormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function QuoteForm({ contacts, initial, onSubmit, onCancel, submitting }: QuoteFormProps) {
  const [values, setValues] = useState<QuoteFormValues>({
    contact_id: initial?.contact_id ?? "",
    quote_date: initial?.quote_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    origin: initial?.origin ?? "",
    destination: initial?.destination ?? "",
    cargo_type: initial?.cargo_type ?? "",
    vehicle_type: initial?.vehicle_type ?? "",
    value: initial?.value !== undefined && initial?.value !== null ? String(initial.value) : "",
    estimated_cost: initial?.estimated_cost !== undefined && initial?.estimated_cost !== null ? String(initial.estimated_cost) : "",
    validity_date: initial?.validity_date?.slice(0, 10) ?? "",
    observations: initial?.observations ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = quoteFormSchema.safeParse(values);
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
          label="Contato"
          placeholder="Selecione"
          options={contacts.map((c) => ({ value: c.id, label: c.name }))}
          value={values.contact_id}
          onChange={(e) => setValues((v) => ({ ...v, contact_id: e.target.value }))}
        />
        <Input
          label="Data da cotação"
          type="date"
          value={values.quote_date}
          onChange={(e) => setValues((v) => ({ ...v, quote_date: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Origem"
          value={values.origin}
          onChange={(e) => setValues((v) => ({ ...v, origin: e.target.value }))}
        />
        <Input
          label="Destino"
          value={values.destination}
          onChange={(e) => setValues((v) => ({ ...v, destination: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Tipo de carga"
          value={values.cargo_type}
          onChange={(e) => setValues((v) => ({ ...v, cargo_type: e.target.value }))}
        />
        <Input
          label="Tipo de veículo"
          value={values.vehicle_type}
          onChange={(e) => setValues((v) => ({ ...v, vehicle_type: e.target.value }))}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Valor (R$)"
          inputMode="decimal"
          placeholder="0,00"
          value={values.value}
          error={errors.value}
          onChange={(e) => setValues((v) => ({ ...v, value: e.target.value }))}
        />
        <Input
          label="Custo estimado (R$)"
          inputMode="decimal"
          placeholder="0,00"
          value={values.estimated_cost}
          error={errors.estimated_cost}
          onChange={(e) => setValues((v) => ({ ...v, estimated_cost: e.target.value }))}
        />
      </div>
      <Input
        label="Validade"
        type="date"
        value={values.validity_date}
        onChange={(e) => setValues((v) => ({ ...v, validity_date: e.target.value }))}
      />
      <Textarea
        label="Observações"
        value={values.observations}
        onChange={(e) => setValues((v) => ({ ...v, observations: e.target.value }))}
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={submitting}>
          Salvar cotação
        </Button>
      </div>
    </form>
  );
}
