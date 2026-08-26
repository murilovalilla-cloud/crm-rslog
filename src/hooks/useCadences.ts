import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { CadenceTemplate, CadenceTemplateDetail, LeadCadence } from "@/lib/types";
import type { CadenceTemplateFormValues } from "@/lib/formSchemas";

export function useCadenceTemplates() {
  return useQuery({
    queryKey: ["cadence-templates"],
    queryFn: () => api.get<{ data: CadenceTemplate[] }>("/cadence-templates").then((r) => r.data),
  });
}

export function useCadenceTemplate(id: string | null) {
  return useQuery({
    queryKey: ["cadence-template", id],
    queryFn: () => api.get<{ data: CadenceTemplateDetail }>(`/cadence-templates/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

function toPayload(values: CadenceTemplateFormValues) {
  return {
    name: values.name,
    description: values.description || null,
    steps: values.steps.map((s) => ({
      id: s.id,
      step_order: s.step_order,
      type: s.type,
      day_offset: s.day_offset,
      title: s.title,
      description: s.description || null,
    })),
  };
}

export function useCreateCadenceTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: CadenceTemplateFormValues) => api.post<{ data: CadenceTemplateDetail }>("/cadence-templates", toPayload(values)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cadence-templates"] }),
  });
}

export function useUpdateCadenceTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: CadenceTemplateFormValues) => api.put<{ data: CadenceTemplateDetail }>(`/cadence-templates/${id}`, toPayload(values)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cadence-templates"] });
      qc.invalidateQueries({ queryKey: ["cadence-template", id] });
    },
  });
}

export function useDeleteCadenceTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ data: { id: string } }>(`/cadence-templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cadence-templates"] }),
  });
}

export function useOpportunityCadences(opportunityId: string | null) {
  return useQuery({
    queryKey: ["opportunity-cadences", opportunityId],
    queryFn: () => api.get<{ data: LeadCadence[] }>(`/opportunities/${opportunityId}/cadence`).then((r) => r.data),
    enabled: !!opportunityId,
  });
}

export function useApplyCadence(opportunityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cadenceTemplateId: string) =>
      api.post<{ data: LeadCadence }>(`/opportunities/${opportunityId}/cadence`, { cadence_template_id: cadenceTemplateId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["opportunity-cadences", opportunityId] });
      qc.invalidateQueries({ queryKey: ["opportunity", opportunityId] });
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["kanban"] });
    },
  });
}

export function useCancelCadence(opportunityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leadCadenceId: string) =>
      api.patch<{ data: { id: string } }>(`/opportunities/${opportunityId}/cadence/${leadCadenceId}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["opportunity-cadences", opportunityId] }),
  });
}
