// src/hooks/useDeviceDataQueries.ts
import { useQuery } from "@tanstack/react-query";
import { RealtimeDataService, type ApiError, type RealtimeDataResponse } from "../client";

interface DeviceDataParams {
  tenantId: string | null;
  deviceIds: number[];
  dataIds?: number[];
}

// Energy flow data IDs mapping
export const ENERGY_FLOW_DATA_IDS = {
  gridPower: 1,
  batteryPower: 3,
  pvPower: 2,
  loadPower: 4,
  soc: 10,
} as const;

// Array of energy flow data IDs
export const energyFlowDataIds = Object.values(ENERGY_FLOW_DATA_IDS);

// Hook to get device data
export const useGetDeviceData = (params: DeviceDataParams) => {
 const { tenantId, deviceIds, dataIds } = params;

  return useQuery<RealtimeDataResponse, ApiError>({
    queryKey: ["deviceData", { tenantId, deviceIds: deviceIds.sort(), dataIds: dataIds?.sort() }],
    queryFn: () =>
      RealtimeDataService.readRealtimeLatest({
        tenantId: tenantId!,
        deviceIds: deviceIds,
        dataIds: dataIds || [],
      }),
    enabled: !!tenantId && deviceIds.length > 0,
    staleTime: 30000, // 30 seconds stale time to match the current refresh interval
    refetchInterval: 30000, // 30 seconds refetch interval
  });
};

// Hook specifically for energy flow data
export const useGetEnergyFlowData = (tenantId: string | null) => {
  // Using common device IDs for energy flow data along with specific data IDs
  const commonDeviceIds = [2];
  return useGetDeviceData({
    tenantId,
    deviceIds: commonDeviceIds,
    dataIds: energyFlowDataIds,
  });
};
