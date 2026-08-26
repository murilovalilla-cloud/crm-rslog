import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Quote, QuoteDetail, QuoteItem, QuoteStatus } from "@/lib/types";
import type { QuoteFormValues, QuoteItemFormValues } from "@/lib/formSchemas";
import { parseBRLNumber } from "@/lib/utils";

function toPayload(values: QuoteFormValues) {
  return {
    contact_id: values.contact_id || null,
    quote_date: values.quote_date || undefined,
    origin: values.origin || null,
    destination: values.destination || null,
    cargo_type: values.cargo_type || null,
    vehicle_type: values.vehicle_type || null,
    value: values.value ? parseBRLNumber(values.value) : null,
    estimated_cost: values.estimated_cost ? parseBRLNumber(values.estimated_cost) : null,
    validity_date: values.validity_date || null,
    observations: values.observations || null,
  };
}

export function useQuote(quoteId: string | null) {
  return useQuery({
    queryKey: ["quote", quoteId],
    queryFn: () => api.get<{ data: QuoteDetail }>(`/quotes/${quoteId}`).then((r) => r.data),
    enabled: !!quoteId,
  });
}

export function useCreateQuote(opportunityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: QuoteFormValues) => api.post<{ data: Quote }>(`/opportunities/${opportunityId}/quotes`, toPayload(values)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
      qc.invalidateQueries({ queryKey: ["quotes", opportunityId] });
    },
  });
}

export function useUpdateQuote(opportunityId: string, quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: QuoteFormValues) => api.put<{ data: Quote }>(`/quotes/${quoteId}`, toPayload(values)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
      qc.invalidateQueries({ queryKey: ["quote", quoteId] });
    },
  });
}

export function useChangeQuoteStatus(opportunityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, lossReasonId }: { id: string; status: QuoteStatus; lossReasonId?: string }) =>
      api.patch<{ data: Quote }>(`/quotes/${id}/status`, { status, loss_reason_id: lossReasonId }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
      qc.invalidateQueries({ queryKey: ["quote", variables.id] });
    },
  });
}

export function useDeleteQuote(opportunityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ data: { id: string } }>(`/quotes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunity", opportunityId] }),
  });
}

export function useAddQuoteItem(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: QuoteItemFormValues) =>
      api.post<{ data: QuoteItem }>(`/quotes/${quoteId}/items`, {
        description: values.description,
        quantity: parseBRLNumber(values.quantity),
        unit_value: parseBRLNumber(values.unit_value),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quote", quoteId] }),
  });
}

export function useDeleteQuoteItem(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => api.delete<{ data: { id: string } }>(`/quotes/${quoteId}/items/${itemId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quote", quoteId] }),
  });
}
