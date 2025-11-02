// src/hooks/useHistoricalData.ts
import { type UseQueryOptions, useQuery } from "@tanstack/react-query"
import {
  type ApiError,
  type HistoricalDataGroupedResponse,
  HistoricalDataService,
} from "@/client"

interface FetchHistoricalDetailsParams {
  data_ids: number[]
  start?: string | null
  end?: string | null
  tenantId: string | null
  aggregate_by?: "hour" | "day" | "month" | "year" | null
}

type UseHistoricalDataQueryOptions = Omit<
  UseQueryOptions<HistoricalDataGroupedResponse, ApiError>,
  "queryKey" | "queryFn"
>

/**
 * Hook to fetch historical data with DELTA logic (backend calculates differences).
 * 
 * The backend returns delta values (difference between consecutive readings)
 * to calculate kWh consumption per period.
 * 
 * @param params.aggregate_by - Aggregation level:
 *   - null/"hour": Hourly deltas (Day view)
 *   - "day": Daily deltas (Week/Month view)
 *   - "month": Monthly deltas (Year view)
 *   - "year": Yearly deltas (Lifetime view)
 *
 * Time Range to Aggregation Mapping:
 * - Day view: hour (raw data points)
 * - Week/Month view: day (daily deltas)
 * - Year view: month (monthly deltas)
 * - Lifetime view: year (yearly deltas)
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
    staleTime: 5 * 60 * 1000,
  })
}

export default useHistoricalData
