// src/hooks/useDeviceDataQueries.ts
import { useQuery } from "@tanstack/react-query";
import { RealtimeDataService, type ApiError, type RealtimeDataResponse } from "../client";

interface DeviceDataParams {
  tenantId: string | null;
  deviceIds: number[];
}

// Hook to get device data
export const useGetDeviceData = (params: DeviceDataParams) => {
  const { tenantId, deviceIds } = params;

  return useQuery<RealtimeDataResponse, ApiError>({
    queryKey: ["deviceData", { tenantId, deviceIds: deviceIds.sort() }],
    queryFn: () =>
      RealtimeDataService.readRealtimeLatest({
        tenantId: tenantId!,
        deviceIds: deviceIds,
      }),
    enabled: !!tenantId && deviceIds.length > 0,
    staleTime: 30000, // 30 seconds stale time to match the current refresh interval
    refetchInterval: 30000, // 30 seconds refetch interval
  });
};
