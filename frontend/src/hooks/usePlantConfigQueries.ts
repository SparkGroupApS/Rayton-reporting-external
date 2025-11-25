// src/hooks/usePlantConfigQueries.ts
import { useQuery } from "@tanstack/react-query";
import { DefaultService, type ApiError, type PlantConfigResponse } from "../client";

interface PlantConfigParams {
  tenantId: string | null;
}

// Hook to get plant config data
export const useGetPlantConfig = (params: PlantConfigParams) => {
  const { tenantId } = params;

  return useQuery<PlantConfigResponse, ApiError>({
    queryKey: ["plantConfig", { tenantId }],
    queryFn: () =>
      DefaultService.getPlantConfig({
        tenantId: tenantId!,
      }),
    enabled: !!tenantId,
    staleTime: 60000, // 60 seconds stale time to match the current refresh interval
    refetchInterval: 60000, // 60 seconds refetch interval
  });
};
