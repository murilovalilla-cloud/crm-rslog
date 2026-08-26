import { useState } from "react";
import {
  useCadenceTemplates,
  useCadenceTemplate,
  useCreateCadenceTemplate,
  useUpdateCadenceTemplate,
  useDeleteCadenceTemplate,
} from "@/hooks/useCadences";
import { CadenceTemplateForm } from "@/components/Cadences/CadenceTemplateForm";
import { Modal } from "@/components/common/Modal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/common/Button";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { ApiError } from "@/lib/api";
import type { CadenceTemplateFormValues } from "@/lib/formSchemas";

function EditCadenceTemplateForm({ id, onDone }: { id: string; onDone: () => void }) {
  const { data, isLoading, error } = useCadenceTemplate(id);
  const updateTemplate = useUpdateCadenceTemplate(id);

  if (isLoading) return <LoadingSpinner label="Carregando cadência..." />;
  if (error || !data) return <p className="text-sm text-red-600">Não foi possível carregar esta cadência.</p>;

  return (
    <CadenceTemplateForm
      initial={data}
      submitting={updateTemplate.isPending}
      onCancel={onDone}
      onSubmit={(values: CadenceTemplateFormValues) => updateTemplate.mutate(values, { onSuccess: onDone })}
    />
  );
}

export function CadencesPage() {
  const { data: templates, isLoading, error } = useCadenceTemplates();
  const createTemplate = useCreateCadenceTemplate();
  const deleteTemplate = useDeleteCadenceTemplate();

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Cadências de prospecção</h1>
          <p className="text-sm text-slate-500">
            Modelos reutilizáveis de sequência de contatos (ligações, e-mails, WhatsApp, reuniões e follow-ups) para aplicar às oportunidades.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>+ Nova cadência</Button>
      </div>

      {isLoading && <LoadingSpinner label="Carregando cadências..." />}
      {error && (
        <EmptyState tone="error" title="Não foi possível carregar as cadências" description={(error as ApiError).message} />
      )}

      {templates && templates.length === 0 && (
        <EmptyState
          title="Nenhuma cadência cadastrada"
          description="Crie modelos de cadência para aplicar às oportunidades do funil."
          action={<Button onClick={() => setShowCreate(true)}>+ Nova cadência</Button>}
        />
      )}

      {templates && templates.length > 0 && (
        <ul className="space-y-2">
          {templates.map((tpl) => (
            <li
              key={tpl.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">{tpl.name}</p>
                {tpl.description && <p className="text-xs text-slate-500">{tpl.description}</p>}
                <p className="mt-0.5 text-xs text-slate-400">{tpl.steps_count ?? 0} passo(s)</p>
              </div>
              <div className="flex gap-3">
                <button type="button" className="text-xs text-navy-600 hover:underline" onClick={() => setEditingId(tpl.id)}>
                  Editar
                </button>
                <button type="button" className="text-xs text-red-600 hover:underline" onClick={() => setDeletingId(tpl.id)}>
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nova cadência" widthClass="max-w-3xl">
        <CadenceTemplateForm
          submitting={createTemplate.isPending}
          onCancel={() => setShowCreate(false)}
          onSubmit={(values) => createTemplate.mutate(values, { onSuccess: () => setShowCreate(false) })}
        />
      </Modal>

      <Modal open={!!editingId} onClose={() => setEditingId(null)} title="Editar cadência" widthClass="max-w-3xl">
        {editingId && <EditCadenceTemplateForm id={editingId} onDone={() => setEditingId(null)} />}
      </Modal>

      <ConfirmDialog
        open={!!deletingId}
        title="Excluir cadência"
        message="A cadência será desativada e não poderá mais ser aplicada a novas oportunidades. Aplicações já em andamento não são interrompidas."
        loading={deleteTemplate.isPending}
        onCancel={() => {
          setDeletingId(null);
          setDeleteError(null);
        }}
        onConfirm={() => {
          if (!deletingId) return;
          deleteTemplate.mutate(deletingId, {
            onSuccess: () => {
              setDeletingId(null);
              setDeleteError(null);
            },
            onError: (err) => setDeleteError(err instanceof ApiError ? err.message : "Erro ao excluir cadência."),
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
