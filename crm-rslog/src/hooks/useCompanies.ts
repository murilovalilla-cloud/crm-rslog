import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Company, CompanyDetail, Paginated } from "@/lib/types";
import type { CompanyFormValues } from "@/lib/formSchemas";

export function useCompanies(params: { search?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  query.set("limit", "20");

  return useQuery({
    queryKey: ["companies", params],
    queryFn: () => api.get<Paginated<Company>>(`/companies?${query.toString()}`),
    placeholderData: (prev) => prev,
  });
}

/** Lista enxuta usada para preencher seletores (formulário de oportunidade, filtros). */
export function useCompanyOptions() {
  return useQuery({
    queryKey: ["companies", "options"],
    queryFn: () => api.get<Paginated<Company>>("/companies?limit=100"),
    staleTime: 60 * 1000,
  });
}

export function useCompany(id: string | null) {
  return useQuery({
    queryKey: ["company", id],
    queryFn: () => api.get<{ data: CompanyDetail }>(`/companies/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

function toPayload(values: CompanyFormValues) {
  return {
    ...values,
    owner_id: values.owner_id || null,
  };
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: CompanyFormValues) => api.post<{ data: Company }>("/companies", toPayload(values)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }),
  });
}

export function useUpdateCompany(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: CompanyFormValues) => api.put<{ data: Company }>(`/companies/${id}`, toPayload(values)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["company", id] });
    },
  });
}

export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ data: { id: string } }>(`/companies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }),
  });
}
