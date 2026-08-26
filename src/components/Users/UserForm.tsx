import { useState, type FormEvent } from "react";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Select";
import { Button } from "@/components/common/Button";
import { userFormSchema, type UserFormValues } from "@/lib/formSchemas";
import type { UserAdmin } from "@/lib/types";

const ROLE_OPTIONS = [
  { value: "vendedor", label: "Vendedor" },
  { value: "admin", label: "Administrador" },
];

interface UserFormProps {
  initial?: UserAdmin | null;
  /** true quando o usuário editado é o próprio requisitante — trava papel/status para evitar autoexclusão do acesso de admin. */
  isSelf?: boolean;
  submitting?: boolean;
  onSubmit: (values: UserFormValues) => void;
  onCancel: () => void;
}

/** Formulário de usuário da equipe: nome, e-mail, papel (admin/vendedor) e status (ativo/inativo). */
export function UserForm({ initial, isSelf, submitting, onSubmit, onCancel }: UserFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [role, setRole] = useState<UserFormValues["role"]>(initial?.role ?? "vendedor");
  const [active, setActive] = useState(initial ? initial.active === 1 : true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = userFormSchema.safeParse({ name, email, role, active });
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[issue.path.join(".")] = issue.message;
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Nome" value={name} error={errors.name} onChange={(e) => setName(e.target.value)} />
      <Input
        label="E-mail"
        type="email"
        value={email}
        error={errors.email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Select
        label="Papel"
        options={ROLE_OPTIONS}
        value={role}
        disabled={isSelf}
        onChange={(e) => setRole(e.target.value as UserFormValues["role"])}
      />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={active}
          disabled={isSelf}
          onChange={(e) => setActive(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-navy-600 focus:ring-navy-500"
        />
        Usuário ativo
      </label>
      {isSelf && (
        <p className="text-xs text-slate-400">
          Você não pode alterar seu próprio papel nem se desativar — peça a outro administrador, se necessário.
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={submitting}>
          Salvar usuário
        </Button>
      </div>
    </form>
  );
}
