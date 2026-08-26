import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Contact } from "@/lib/types";
import type { ContactFormValues } from "@/lib/formSchemas";

export function useContacts(companyId: string | null) {
  return useQuery({
    queryKey: ["contacts", companyId],
    queryFn: () => api.get<{ data: Contact[] }>(`/contacts?company_id=${companyId}`).then((r) => r.data),
    enabled: !!companyId,
  });
}

function toPayload(values: ContactFormValues) {
  return { ...values, is_decision_maker: !!values.is_decision_maker };
}

export function useCreateContact(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ContactFormValues) => api.post<{ data: Contact }>("/contacts", toPayload(values)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", companyId] });
      qc.invalidateQueries({ queryKey: ["company", companyId] });
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}

export function useUpdateContact(companyId: string, contactId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ContactFormValues) => api.put<{ data: Contact }>(`/contacts/${contactId}`, toPayload(values)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", companyId] });
      qc.invalidateQueries({ queryKey: ["company", companyId] });
    },
  });
}

export function useDeleteContact(companyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => api.delete<{ data: { id: string } }>(`/contacts/${contactId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", companyId] });
      qc.invalidateQueries({ queryKey: ["company", companyId] });
      qc.invalidateQueries({ queryKey: ["companies"] });
    },
  });
}
