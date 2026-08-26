import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { NutritionLead } from "@/lib/types";
import type { NutritionUpdateFormValues } from "@/lib/formSchemas";

export function useNutritionLeads(status: "em_nutricao" | "retomado" = "em_nutricao") {
  return useQuery({
    queryKey: ["nutrition-leads", status],
    queryFn: () => api.get<{ data: NutritionLead[] }>(`/nutrition-leads?status=${status}`).then((r) => r.data),
  });
}

export function useUpdateNutritionLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, values }: { id: string; values: NutritionUpdateFormValues }) =>
      api.put<{ data: NutritionLead }>(`/nutrition-leads/${id}`, {
        reason: values.reason || null,
        resume_at: values.resume_at || null,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nutrition-leads"] }),
  });
}

export function useResumeNutritionLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stageId, note }: { id: string; stageId: string; note?: string }) =>
      api.post<{ data: NutritionLead }>(`/nutrition-leads/${id}/resume`, { stage_id: stageId, note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nutrition-leads"] });
      qc.invalidateQueries({ queryKey: ["kanban"] });
    },
  });
}
