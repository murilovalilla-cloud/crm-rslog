import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { HistoryEntry, Note, Opportunity, OpportunityDetail, PipelineStage } from "@/lib/types";
import type { HistoryFormValues, NoteFormValues, OpportunityFormValues } from "@/lib/formSchemas";
import { parseBRLNumber } from "@/lib/utils";

interface KanbanResponse {
  stages: PipelineStage[];
  opportunities: Opportunity[];
}

export function useKanban(params: { search?: string; owner_id?: string }) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.owner_id) query.set("owner_id", params.owner_id);

  return useQuery({
    queryKey: ["kanban", params],
    queryFn: () => api.get<{ data: KanbanResponse }>(`/opportunities/kanban?${query.toString()}`).then((r) => r.data),
    refetchInterval: 60_000,
  });
}

/** Lista enxuta de oportunidades abertas, usada para agendar atividades a partir do calendário. */
export function useOpportunityOptions() {
  return useQuery({
    queryKey: ["opportunities", "options"],
    queryFn: () =>
      api
        .get<{ data: Opportunity[]; page: number; limit: number; total: number }>(
          "/opportunities?status=aberta&limit=100"
        )
        .then((r) => r.data),
    staleTime: 30 * 1000,
  });
}

export function useOpportunity(id: string | null) {
  return useQuery({
    queryKey: ["opportunity", id],
    queryFn: () => api.get<{ data: OpportunityDetail }>(`/opportunities/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

function toPayload(values: OpportunityFormValues) {
  return {
    company_id: values.company_id,
    contact_id: values.contact_id || null,
    title: values.title,
    owner_id: values.owner_id || null,
    value: values.value ? parseBRLNumber(values.value) : null,
    expected_close_date: values.expected_close_date || null,
  };
}

export function useCreateOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: OpportunityFormValues & { stage_id?: string }) =>
      api.post<{ data: Opportunity }>("/opportunities", { ...toPayload(values), stage_id: values.stage_id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kanban"] }),
  });
}

export function useUpdateOpportunity(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: OpportunityFormValues) => api.put<{ data: Opportunity }>(`/opportunities/${id}`, toPayload(values)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kanban"] });
      qc.invalidateQueries({ queryKey: ["opportunity", id] });
    },
  });
}

export function useDeleteOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ data: { id: string } }>(`/opportunities/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kanban"] }),
  });
}

export function useMoveOpportunityStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stageId, lossReasonId }: { id: string; stageId: string; lossReasonId?: string }) =>
      api.patch<{ data: Opportunity }>(`/opportunities/${id}/stage`, {
        stage_id: stageId,
        loss_reason_id: lossReasonId,
      }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["kanban"] });
      qc.invalidateQueries({ queryKey: ["opportunity", variables.id] });
    },
  });
}

export function useAddHistoryEntry(opportunityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: HistoryFormValues) =>
      api.post<{ data: HistoryEntry }>(`/opportunities/${opportunityId}/history`, values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunity", opportunityId] }),
  });
}

export function useAddNote(opportunityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: NoteFormValues) => api.post<{ data: Note }>(`/opportunities/${opportunityId}/notes`, values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunity", opportunityId] }),
  });
}

export function useDeleteNote(opportunityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => api.delete<{ data: { id: string } }>(`/opportunities/${opportunityId}/notes/${noteId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunity", opportunityId] }),
  });
}
