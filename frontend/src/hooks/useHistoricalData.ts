// src/hooks/useHistoricalData.ts
import { type UseQueryOptions, useQuery } from "@tanstack/react-query"
import {
  type ApiError,
  type HistoricalDataGroupedResponse,
  HistoricalDataService,
} from "@/client" // Adjust path if needed

// Define the type for the parameters needed by the hook/API
interface FetchHistoricalDetailsParams {
  data_ids: number[]
  start?: string | null
  end?: string | null
  tenantId: string | null // <-- Correct: Use tenantId (UUID string)
}

// Define the type for extra useQuery options
type UseHistoricalDataQueryOptions = Omit<
  UseQueryOptions<HistoricalDataGroupedResponse, ApiError>,
  "queryKey" | "queryFn" // Only omit keys set internally
>

/**
 * Hook to fetch detailed historical data, grouped by series, for charting.
 */
const useHistoricalData = (
  params: FetchHistoricalDetailsParams,
  options: UseHistoricalDataQueryOptions = {},
) => {
  // Determine if the query should be enabled
  const enabled =
    options.enabled !== false && // Allow explicit disabling
    !!params.tenantId && // <-- FIX 2: Ensure tenantId exists
    params.data_ids &&
    params.data_ids.length > 0 // Must have data_ids

  return useQuery<HistoricalDataGroupedResponse, ApiError>({
    // Spread any additional options (like 'enabled' from the caller)
    ...options,

    queryKey: ["historicalDataDetails", params], // Cache based on params

    queryFn: () =>
      HistoricalDataService.readHistoricalDetails({
        dataIds: params.data_ids,
        start: params.start || undefined,
        end: params.end || undefined,
        tenantId: params.tenantId!, // <-- FIX 1: Use params.tenantId
      }),

    enabled: enabled, // Control when the query runs
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export default useHistoricalData
