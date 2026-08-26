import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Activity } from "@/lib/types";
import type { ActivityFormValues } from "@/lib/formSchemas";

export function useActivities(params: {
  from?: string;
  to?: string;
  owner_id?: string;
  opportunity_id?: string;
  status?: string;
}) {
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.owner_id) query.set("owner_id", params.owner_id);
  if (params.opportunity_id) query.set("opportunity_id", params.opportunity_id);
  if (params.status) query.set("status", params.status);

  return useQuery({
    queryKey: ["activities", params],
    queryFn: () => api.get<{ data: Activity[] }>(`/activities?${query.toString()}`).then((r) => r.data),
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>, opportunityId?: string) {
  qc.invalidateQueries({ queryKey: ["activities"] });
  qc.invalidateQueries({ queryKey: ["kanban"] });
  if (opportunityId) qc.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
}

export function useCreateActivity(opportunityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ActivityFormValues) =>
      api.post<{ data: Activity }>("/activities", {
        ...values,
        opportunity_id: opportunityId,
        owner_id: values.owner_id || null,
        due_at: new Date(values.due_at).toISOString(),
      }),
    onSuccess: () => invalidateAll(qc, opportunityId),
  });
}

/** Cria atividade escolhendo a oportunidade dinamicamente (usado na tela de Calendário). */
export function useCreateActivityForAnyOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ActivityFormValues & { opportunity_id: string }) =>
      api.post<{ data: Activity }>("/activities", {
        ...values,
        owner_id: values.owner_id || null,
        due_at: new Date(values.due_at).toISOString(),
      }),
    onSuccess: (_, variables) => invalidateAll(qc, variables.opportunity_id),
  });
}

export function useCompleteActivity(opportunityId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, outcome_note }: { id: string; outcome_note?: string }) =>
      api.patch<{ data: Activity }>(`/activities/${id}/complete`, { outcome_note }),
    onSuccess: () => invalidateAll(qc, opportunityId),
  });
}

export function useRescheduleActivity(opportunityId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, due_at }: { id: string; due_at: string }) =>
      api.put<{ data: Activity }>(`/activities/${id}`, { due_at: new Date(due_at).toISOString() }),
    onSuccess: () => invalidateAll(qc, opportunityId),
  });
}

export function useDeleteActivity(opportunityId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ data: { id: string } }>(`/activities/${id}`),
    onSuccess: () => invalidateAll(qc, opportunityId),
  });
}
