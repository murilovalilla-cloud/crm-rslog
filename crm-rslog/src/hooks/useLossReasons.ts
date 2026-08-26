import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface LossReason {
  id: string;
  name: string;
}

export function useLossReasons() {
  return useQuery({
    queryKey: ["loss-reasons"],
    queryFn: () => api.get<{ data: LossReason[] }>("/loss-reasons").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}
