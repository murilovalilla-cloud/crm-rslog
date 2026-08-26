// Hooks da tela de gestão de equipe (admin) — Etapa 3.
//
// Diferente de useUsers() (useCurrentUser.ts), que só retorna usuários
// ativos e é usado para preencher seletores de "responsável comercial" em
// toda a aplicação, os hooks aqui trazem também os usuários inativos e os
// campos extras (active, datas) usados pela tela /usuarios — só acessível
// a administradores (o backend também impõe essa restrição em /:id, POST e
// PUT; ver worker/routes/users.ts).

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { UserAdmin } from "@/lib/types";
import type { UserFormValues } from "@/lib/formSchemas";

export function useAllUsers() {
  return useQuery({
    queryKey: ["users", "all"],
    queryFn: () => api.get<{ data: UserAdmin[] }>("/users?include_inactive=1").then((r) => r.data),
  });
}

function invalidateUserLists(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["users"] });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: UserFormValues) => api.post<{ data: UserAdmin }>("/users", values),
    onSuccess: () => invalidateUserLists(qc),
  });
}

export function useUpdateUser(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: UserFormValues) => api.put<{ data: UserAdmin }>(`/users/${id}`, values),
    onSuccess: () => invalidateUserLists(qc),
  });
}
