import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PipelineStage } from "@/lib/types";

export function usePipelineStages() {
  return useQuery({
    queryKey: ["pipeline-stages"],
    queryFn: () => api.get<{ data: PipelineStage[] }>("/pipeline-stages").then((r) => r.data),
    staleTime: 60 * 1000,
  });
}
