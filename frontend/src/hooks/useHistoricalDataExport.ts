// src/hooks/useHistoricalDataExport.ts
import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { ApiError, type HistoricalDataGroupedResponse, HistoricalDataService } from "@/client"; // Adjust import path

// Define the type for export parameters
interface FetchHistoricalDataExportParams {
  data_ids: number[];
  start?: string | null;
  end?: string | null;
  tenantId: string | null;
  export_granularity?: string; // If your backend endpoint needs it
}

// Define the expected response type (based on your backend endpoint)
// Assuming backend returns List[dict] like [{timestamp: "...", "101": 123.4, "102": 567.8}, ...]
//export type ExportDataPoint = { [key: string]: string | number | null }; // Adjust based on backend response
//export type ExportDataResponse = ExportDataPoint[];

// Define options type for the query
type UseHistoricalDataExportQueryOptions = Omit<UseQueryOptions<HistoricalDataGroupedResponse, ApiError>, "queryKey" | "queryFn">;

/**
 * Hook to fetch raw historical data for export.
 */
const useHistoricalDataExport = (params: FetchHistoricalDataExportParams, options: UseHistoricalDataExportQueryOptions = {}) => {
  const enabled = options.enabled !== false && !!params.tenantId && params.data_ids.length > 0;
//const url = `/api/v1/historical-data/export/?tenant_id=${params.tenantId}&data_ids=${params.data_ids.join(",")}&start=${params.start}&end=${params.end}&export_granularity=${params.export_granularity || "hourly"}`;

  return useQuery<HistoricalDataGroupedResponse, ApiError>({
      ...options,
      queryKey: [
        "historicalDataExport",
        {
          ...params,
          export_granularity: params.export_granularity || "hourly",
        },
      ],
      queryFn: () => {
        const queryParams: any = {
          dataIds: params.data_ids,
          start: params.start || undefined,
          end: params.end || undefined,
          tenantId: params.tenantId!,
          exportGranularity: params.export_granularity || "hourly",
        };
  
        if (params.export_granularity !== undefined && params.export_granularity !== null) {
          queryParams.export_granularity = params.export_granularity;
        }
  
        return HistoricalDataService.exportHistoricalData(queryParams);
      },
      enabled: enabled,
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    });
  };
  

export default useHistoricalDataExport;
