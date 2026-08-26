import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DashboardData } from "@/lib/types";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.get<{ data: DashboardData }>("/dashboard").then((r) => r.data),
    refetchInterval: 5 * 60 * 1000,
  });
}
