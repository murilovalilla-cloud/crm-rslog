import { useState } from "react";
import { Button } from "@/components/common/Button";
import { Select } from "@/components/common/Select";
import { Modal } from "@/components/common/Modal";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { LossReasonModal } from "@/components/Opportunities/LossReasonModal";
import { QuoteForm } from "./QuoteForm";
import { QuoteStatusBadge, QUOTE_STATUS_OPTIONS } from "./QuoteStatusBadge";
import { QuoteItemsEditor } from "./QuoteItemsEditor";
import { useCreateQuote, useUpdateQuote, useChangeQuoteStatus, useDeleteQuote } from "@/hooks/useQuotes";
import { formatCurrencyBRL, formatDate } from "@/lib/utils";
import type { Contact, Quote, QuoteStatus } from "@/lib/types";
import type { QuoteFormValues } from "@/lib/formSchemas";

interface QuotesPanelProps {
  opportunityId: string;
  quotes: Quote[];
  contacts: Contact[];
}

/** Formulário de edição isolado em seu próprio componente para poder chamar useUpdateQuote(quoteId) apenas quando uma cotação está sendo editada. */
function EditQuoteForm({
  opportunityId,
  quote,
  contacts,
  onDone,
}: {
  opportunityId: string;
  quote: Quote;
  contacts: Contact[];
  onDone: () => void;
}) {
  const updateQuote = useUpdateQuote(opportunityId, quote.id);
  return (
    <QuoteForm
      contacts={contacts}
      initial={quote}
      submitting={updateQuote.isPending}
      onCancel={onDone}
      onSubmit={(values: QuoteFormValues) => updateQuote.mutate(values, { onSuccess: onDone })}
    />
  );
}

export function QuotesPanel({ opportunityId, quotes, contacts }: QuotesPanelProps) {
  const createQuote = useCreateQuote(opportunityId);
  const changeStatus = useChangeQuoteStatus(opportunityId);
  const deleteQuote = useDeleteQuote(opportunityId);

  const [showCreate, setShowCreate] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lossReasonQuoteId, setLossReasonQuoteId] = useState<string | null>(null);

  const handleStatusChange = (quote: Quote, status: QuoteStatus) => {
    if (status === "recusada") {
      setLossReasonQuoteId(quote.id);
      return;
    }
    changeStatus.mutate({ id: quote.id, status });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          {quotes.length === 0 ? "Nenhuma cotação registrada." : `${quotes.length} cotação(ões) registrada(s)`}
        </p>
        <Button variant="secondary" className="!px-2 !py-1 text-xs" onClick={() => setShowCreate(true)}>
          + Nova cotação
        </Button>
      </div>

      {quotes.length === 0 ? (
        <EmptyState
          title="Nenhuma cotação para esta oportunidade"
          description="Cadastre a primeira cotação para começar a acompanhar valores e itens."
        />
      ) : (
        <ul className="space-y-2">
          {quotes.map((quote) => {
            const expanded = expandedId === quote.id;
            return (
              <li key={quote.id} className="rounded-md border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <button
                    type="button"
                    className="flex flex-1 flex-wrap items-center gap-2 text-left"
                    onClick={() => setExpandedId(expanded ? null : quote.id)}
                  >
                    <span className="text-sm font-semibold text-slate-700">{quote.number}</span>
                    <QuoteStatusBadge status={quote.status} />
                    <span className="text-xs text-slate-400">{formatDate(quote.quote_date)}</span>
                    {(quote.origin || quote.destination) && (
                      <span className="text-xs text-slate-500">
                        {quote.origin ?? "?"} → {quote.destination ?? "?"}
                      </span>
                    )}
                    <span className="ml-auto text-sm font-medium text-slate-800">{formatCurrencyBRL(quote.value)}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <Select
                      options={QUOTE_STATUS_OPTIONS}
                      value={quote.status}
                      className="!py-1 text-xs"
                      onChange={(e) => handleStatusChange(quote, e.target.value as QuoteStatus)}
                    />
                    <button
                      type="button"
                      className="text-xs text-navy-600 hover:underline"
                      onClick={() => setEditingQuote(quote)}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => setConfirmDeleteId(quote.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-slate-200 px-3 py-3">
                    {(quote.cargo_type || quote.vehicle_type || quote.estimated_cost !== null || quote.observations) && (
                      <dl className="mb-3 grid grid-cols-2 gap-2 text-xs text-slate-500 sm:grid-cols-4">
                        {quote.cargo_type && (
                          <div>
                            <dt className="uppercase text-slate-400">Tipo de carga</dt>
                            <dd className="text-slate-700">{quote.cargo_type}</dd>
                          </div>
                        )}
                        {quote.vehicle_type && (
                          <div>
                            <dt className="uppercase text-slate-400">Tipo de veículo</dt>
                            <dd className="text-slate-700">{quote.vehicle_type}</dd>
                          </div>
                        )}
                        <div>
                          <dt className="uppercase text-slate-400">Custo estimado</dt>
                          <dd className="text-slate-700">{formatCurrencyBRL(quote.estimated_cost)}</dd>
                        </div>
                        <div>
                          <dt className="uppercase text-slate-400">Margem estimada</dt>
                          <dd className="text-slate-700">{formatCurrencyBRL(quote.estimated_margin)}</dd>
                        </div>
                        {quote.validity_date && (
                          <div>
                            <dt className="uppercase text-slate-400">Validade</dt>
                            <dd className="text-slate-700">{formatDate(quote.validity_date)}</dd>
                          </div>
                        )}
                        {quote.observations && (
                          <div className="col-span-2 sm:col-span-4">
                            <dt className="uppercase text-slate-400">Observações</dt>
                            <dd className="text-slate-700">{quote.observations}</dd>
                          </div>
                        )}
                      </dl>
                    )}
                    <QuoteItemsEditor quoteId={quote.id} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nova cotação" widthClass="max-w-xl">
        <QuoteForm
          contacts={contacts}
          submitting={createQuote.isPending}
          onCancel={() => setShowCreate(false)}
          onSubmit={(values) => createQuote.mutate(values, { onSuccess: () => setShowCreate(false) })}
        />
      </Modal>

      <Modal open={!!editingQuote} onClose={() => setEditingQuote(null)} title="Editar cotação" widthClass="max-w-xl">
        {editingQuote && (
          <EditQuoteForm
            opportunityId={opportunityId}
            quote={editingQuote}
            contacts={contacts}
            onDone={() => setEditingQuote(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Excluir cotação"
        message="Esta ação exclui a cotação e todos os seus itens. Não pode ser desfeita."
        loading={deleteQuote.isPending}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (!confirmDeleteId) return;
          deleteQuote.mutate(confirmDeleteId, { onSuccess: () => setConfirmDeleteId(null) });
        }}
      />

      <LossReasonModal
        open={!!lossReasonQuoteId}
        onCancel={() => setLossReasonQuoteId(null)}
        submitting={changeStatus.isPending}
        onConfirm={(reasonId) => {
          if (!lossReasonQuoteId) return;
          changeStatus.mutate(
            { id: lossReasonQuoteId, status: "recusada", lossReasonId: reasonId },
            { onSuccess: () => setLossReasonQuoteId(null) }
          );
        }}
      />
    </div>
  );
}
