import { useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useAllUsers, useCreateUser, useUpdateUser } from "@/hooks/useUserAdmin";
import { UserForm } from "@/components/Users/UserForm";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/common/Button";
import { Badge } from "@/components/common/Badge";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { ApiError } from "@/lib/api";
import type { UserAdmin } from "@/lib/types";
import type { UserFormValues } from "@/lib/formSchemas";

function RoleBadge({ role }: { role: UserAdmin["role"] }) {
  return (
    <Badge className={role === "admin" ? "bg-navy-50 text-navy-700 border border-navy-200" : "bg-slate-100 text-slate-600 border border-slate-200"}>
      {role === "admin" ? "Administrador" : "Vendedor"}
    </Badge>
  );
}

function StatusBadge({ active }: { active: 0 | 1 }) {
  return (
    <Badge className={active === 1 ? "bg-green-50 text-alert-done border border-green-200" : "bg-slate-100 text-slate-500 border border-slate-200"}>
      {active === 1 ? "Ativo" : "Inativo"}
    </Badge>
  );
}

export function UsersPage() {
  const { data: me } = useCurrentUser();
  const { data: allUsers, isLoading, error } = useAllUsers();
  const createUser = useCreateUser();

  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAdmin | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  if (me && me.role !== "admin") {
    return (
      <EmptyState
        tone="error"
        title="Acesso restrito"
        description="Apenas administradores podem gerenciar os usuários da equipe."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Usuários da equipe</h1>
          <p className="text-sm text-slate-500">
            Cadastre vendedores e administradores, e controle quem tem acesso ao CRM RS LOG. O login em si é feito
            pelo Cloudflare Access — aqui você autoriza o e-mail e define o papel de cada pessoa.
          </p>
        </div>
        <Button
          onClick={() => {
            setCreateError(null);
            setShowCreate(true);
          }}
        >
          + Novo usuário
        </Button>
      </div>

      {isLoading && <LoadingSpinner label="Carregando usuários..." />}
      {error && (
        <EmptyState tone="error" title="Não foi possível carregar os usuários" description={(error as ApiError).message} />
      )}

      {allUsers && allUsers.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Nome</th>
                <th className="px-4 py-2">E-mail</th>
                <th className="px-4 py-2">Papel</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allUsers.map((u) => (
                <tr key={u.id}>
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-slate-800">
                    {u.name}
                    {u.id === me?.id && <span className="ml-1 text-xs font-normal text-slate-400">(você)</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-slate-600">{u.email}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <StatusBadge active={u.active} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right">
                    <button type="button" className="text-xs text-navy-600 hover:underline" onClick={() => setEditingUser(u)}>
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Novo usuário">
        <UserForm
          submitting={createUser.isPending}
          onCancel={() => setShowCreate(false)}
          onSubmit={(values: UserFormValues) => {
            setCreateError(null);
            createUser.mutate(values, {
              onSuccess: () => setShowCreate(false),
              onError: (err) => setCreateError(err instanceof ApiError ? err.message : "Erro ao criar usuário."),
            });
          }}
        />
        {createError && <p className="field-error mt-2">{createError}</p>}
      </Modal>

      <Modal open={!!editingUser} onClose={() => setEditingUser(null)} title="Editar usuário">
        {editingUser && (
          <EditUserForm user={editingUser} isSelf={editingUser.id === me?.id} onDone={() => setEditingUser(null)} />
        )}
      </Modal>
    </div>
  );
}

function EditUserForm({ user, isSelf, onDone }: { user: UserAdmin; isSelf: boolean; onDone: () => void }) {
  const updateUser = useUpdateUser(user.id);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <UserForm
        initial={user}
        isSelf={isSelf}
        submitting={updateUser.isPending}
        onCancel={onDone}
        onSubmit={(values: UserFormValues) => {
          setError(null);
          updateUser.mutate(values, {
            onSuccess: onDone,
            onError: (err) => setError(err instanceof ApiError ? err.message : "Erro ao salvar usuário."),
          });
        }}
      />
      {error && <p className="field-error mt-2">{error}</p>}
    </div>
  );
}
