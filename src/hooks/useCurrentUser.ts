import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<{ data: User }>("/me").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<{ data: User[] }>("/users").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}
