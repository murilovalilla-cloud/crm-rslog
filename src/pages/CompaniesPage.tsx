import { useState } from "react";
import { useCompanies, useCreateCompany, useDeleteCompany, useUpdateCompany } from "@/hooks/useCompanies";
import { CompaniesList } from "@/components/Companies/CompaniesList";
import { CompanyForm } from "@/components/Companies/CompanyForm";
import { Modal } from "@/components/common/Modal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { ApiError } from "@/lib/api";
import type { Company } from "@/lib/types";
import type { CompanyFormValues } from "@/lib/formSchemas";

export function CompaniesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useCompanies({ search: search || undefined, page });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState<Company | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const createCompany = useCreateCompany();
  const updateCompany = useUpdateCompany(editing?.id ?? "");
  const deleteCompany = useDeleteCompany();

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (company: Company) => {
    setEditing(company);
    setFormOpen(true);
  };

  const handleSubmit = (values: CompanyFormValues) => {
    const mutation = editing ? updateCompany : createCompany;
    mutation.mutate(values, { onSuccess: () => setFormOpen(false) });
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-72">
          <Input
            placeholder="Buscar por nome, CNPJ ou cidade..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button onClick={openCreate}>+ Nova empresa</Button>
      </div>

      {isLoading && <LoadingSpinner label="Carregando empresas..." />}
      {error && <EmptyState tone="error" title="Não foi possível carregar as empresas" description={(error as ApiError).message} />}

      {data && data.data.length === 0 && (
        <EmptyState
          title="Nenhuma empresa cadastrada"
          description="Comece cadastrando a primeira empresa prospectada."
          action={<Button onClick={openCreate}>+ Nova empresa</Button>}
        />
      )}

      {data && data.data.length > 0 && (
        <>
          <CompaniesList companies={data.data} onEdit={openEdit} onDelete={setDeleting} />
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>
              {data.total} empresa{data.total === 1 ? "" : "s"} · página {data.page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Editar empresa" : "Nova empresa"}>
        <CompanyForm
          initial={editing}
          submitting={createCompany.isPending || updateCompany.isPending}
          onCancel={() => setFormOpen(false)}
          onSubmit={handleSubmit}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Excluir empresa"
        message={`Tem certeza que deseja excluir "${deleting?.name}"? Esta ação não pode ser desfeita.`}
        loading={deleteCompany.isPending}
        onCancel={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
        onConfirm={() => {
          if (!deleting) return;
          deleteCompany.mutate(deleting.id, {
            onSuccess: () => {
              setDeleting(null);
              setDeleteError(null);
            },
            onError: (err) => setDeleteError(err instanceof ApiError ? err.message : "Erro ao excluir empresa."),
          });
        }}
      />
      {deleteError && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md bg-red-600 px-4 py-2 text-sm text-white shadow-lg">
          {deleteError}
        </div>
      )}
    </div>
  );
}
