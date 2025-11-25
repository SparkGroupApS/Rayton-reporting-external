// src/hooks/useHistoricalData.ts
import { type UseQueryOptions, useQuery } from "@tanstack/react-query"
import {
  type ApiError,
  type HistoricalDataGroupedResponse,
  HistoricalDataService,
} from "@/client"

// Define the type for the parameters needed by the hook/API
interface FetchHistoricalDetailsParams {
  data_ids: number[]
  start?: string | null
  end?: string | null
  tenantId: string | null
  aggregate_by?: "hour" | "day" | "month" | "year" | null
}

// Define the type for extra useQuery options
type UseHistoricalDataQueryOptions = Omit<
  UseQueryOptions<HistoricalDataGroupedResponse, ApiError>,
  "queryKey" | "queryFn"
>

/**
 * Hook to fetch detailed historical data, with optional aggregation.
 *
 * param params.aggregate_by - Aggregation level:
 * - null/"hour": Raw/averaged power data (kW) for Day view
 * - "day": Daily delta energy (kWh) for Week/Month view
 * - "month": Monthly delta energy (kWh) for Year view
 * - "year": Yearly delta energy (kWh) for Lifetime view
 */

const useHistoricalData = (
  params: FetchHistoricalDetailsParams,
  options: UseHistoricalDataQueryOptions = {},
) => {
  const enabled =
    options.enabled !== false &&
    !!params.tenantId &&
    params.data_ids &&
    params.data_ids.length > 0

  return useQuery<HistoricalDataGroupedResponse, ApiError>({
    ...options,
    queryKey: [
      "historicalDataDetails",
      {
        ...params,
        aggregate_by: params.aggregate_by || "hour",
      },
    ],
    queryFn: () => {
      const queryParams: any = {
        dataIds: params.data_ids,
        start: params.start || undefined,
        end: params.end || undefined,
        tenantId: params.tenantId!,
      }

      if (params.aggregate_by !== undefined && params.aggregate_by !== null) {
        queryParams.aggregateBy = params.aggregate_by
      }

      return HistoricalDataService.readHistoricalDetails(queryParams)
    },
    enabled: enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  })
}

export default useHistoricalData
