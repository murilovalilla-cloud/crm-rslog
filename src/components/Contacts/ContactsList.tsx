import { useState } from "react";
import type { Contact } from "@/lib/types";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ContactForm } from "./ContactForm";
import { useCreateContact, useDeleteContact, useUpdateContact } from "@/hooks/useContacts";
import type { ContactFormValues } from "@/lib/formSchemas";

export function ContactsList({ companyId, contacts }: { companyId: string; contacts: Contact[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState<Contact | null>(null);

  const createContact = useCreateContact(companyId);
  const updateContact = useUpdateContact(companyId, editing?.id ?? "");
  const deleteContact = useDeleteContact(companyId);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (contact: Contact) => {
    setEditing(contact);
    setFormOpen(true);
  };

  const handleSubmit = (values: ContactFormValues) => {
    const mutation = editing ? updateContact : createContact;
    mutation.mutate(values, { onSuccess: () => setFormOpen(false) });
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Contatos</h3>
        <Button variant="secondary" onClick={openCreate} className="!px-2 !py-1 text-xs">
          + Contato
        </Button>
      </div>

      {contacts.length === 0 ? (
        <p className="text-sm text-slate-400">Nenhum contato cadastrado.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {contacts.map((contact) => (
            <li key={contact.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-700">
                  {contact.name}
                  {contact.is_decision_maker === 1 && (
                    <span className="ml-1.5 rounded bg-navy-50 px-1.5 py-0.5 text-[10px] font-semibold text-navy-600">
                      DECISOR
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-slate-400">
                  {[contact.role, contact.email, contact.whatsapp].filter(Boolean).join(" · ") || "Sem detalhes"}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button className="text-xs text-navy-600 hover:underline" onClick={() => openEdit(contact)}>
                  Editar
                </button>
                <button className="text-xs text-red-600 hover:underline" onClick={() => setDeleting(contact)}>
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Editar contato" : "Novo contato"}>
        <ContactForm
          companyId={companyId}
          initial={editing}
          submitting={createContact.isPending || updateContact.isPending}
          onCancel={() => setFormOpen(false)}
          onSubmit={handleSubmit}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Excluir contato"
        message={`Tem certeza que deseja excluir "${deleting?.name}"? Esta ação não pode ser desfeita.`}
        loading={deleteContact.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          deleteContact.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </div>
  );
}
