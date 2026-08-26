import { useState, type FormEvent } from "react";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/common/Button";
import { contactFormSchema, type ContactFormValues } from "@/lib/formSchemas";
import type { Contact } from "@/lib/types";

interface ContactFormProps {
  companyId: string;
  initial?: Contact | null;
  onSubmit: (values: ContactFormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function ContactForm({ companyId, initial, onSubmit, onCancel, submitting }: ContactFormProps) {
  const [values, setValues] = useState<ContactFormValues>({
    company_id: companyId,
    name: initial?.name ?? "",
    role: initial?.role ?? "",
    is_decision_maker: initial ? initial.is_decision_maker === 1 : false,
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    whatsapp: initial?.whatsapp ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = contactFormSchema.safeParse(values);
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
      <Input
        label="Nome do contato"
        value={values.name}
        error={errors.name}
        onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
      />
      <Input
        label="Cargo"
        value={values.role}
        onChange={(e) => setValues((v) => ({ ...v, role: e.target.value }))}
      />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-navy-600 focus:ring-navy-500"
          checked={!!values.is_decision_maker}
          onChange={(e) => setValues((v) => ({ ...v, is_decision_maker: e.target.checked }))}
        />
        É o decisor da compra
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="E-mail"
          value={values.email}
          error={errors.email}
          onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
        />
        <Input
          label="Telefone"
          value={values.phone}
          onChange={(e) => setValues((v) => ({ ...v, phone: e.target.value }))}
        />
      </div>
      <Input
        label="WhatsApp"
        value={values.whatsapp}
        onChange={(e) => setValues((v) => ({ ...v, whatsapp: e.target.value }))}
      />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={submitting}>
          Salvar contato
        </Button>
      </div>
    </form>
  );
}
