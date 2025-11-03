// src/hooks/useHistoricalDataExport.ts
import { useQuery, UseQueryOptions } from "@tanstack/react-query";
import { ApiError, HistoricalDataService } from "@/client"; // Adjust import path
// Define the type for export parameters
interface FetchHistoricalDataExportParams {
  tenantId: string;
  data_ids: number[];
  start: string; // ISO string
  end: string;   // ISO string
  // export_granularity?: string; // If your backend endpoint needs it
}

// Define the expected response type (based on your backend endpoint)
// Assuming backend returns List[dict] like [{timestamp: "...", "101": 123.4, "102": 567.8}, ...]
export type ExportDataPoint = { [key: string]: string | number | null }; // Adjust based on backend response
export type ExportDataResponse = ExportDataPoint[];

// Define options type for the query
type UseHistoricalDataExportQueryOptions = Omit<
  UseQueryOptions<ExportDataResponse, ApiError>,
  "queryKey" | "queryFn"
>;

/**
 * Hook to fetch raw historical data for export.
 */
const useHistoricalDataExport = (
  params: FetchHistoricalDataExportParams,
  options: UseHistoricalDataExportQueryOptions = {}
) => {
  const enabled =
    options.enabled !== false &&
    !!params.tenantId &&
    params.data_ids.length > 0;

  return useQuery<ExportDataResponse, ApiError>({
    ...options,
    queryKey: ["historicalDataExport", params], // Unique key for export data
    queryFn: async () => {
      // --- CALL THE NEW EXPORT ENDPOINT ---
      // You need to generate the client code for the new endpoint.
      // Assuming you have generated a service method like `readHistoricalDataExport`
      // based on your backend's OpenAPI spec.
      // If not, you can use `apiClient.axiosInstance.get(...)` or similar.
      // Example using a hypothetical generated service method:
      /*
      const response = await HistoricalDataService.readHistoricalDataExport({
         tenantId: params.tenantId,
         dataIds: params.data_ids,
         start: params.start,
         end: params.end,
         // exportGranularity: params.export_granularity
      });
      return response.data; // Assuming response.data contains the list
      */

      // --- OR: Manual Axios/Fetch call if service method not generated ---
      // Example using Axios (adjust URL and headers as needed)
      /*
      const response = await apiClient.axiosInstance.get(`/api/v1/historical-data/export/`, {
        params: {
          tenant_id: params.tenantId,
          data_ids: params.data_ids.join(','), // Join array for query param
          start: params.start,
          end: params.end,
          // export_granularity: params.export_granularity
        },
         headers: {
          // Add Authorization header if needed
          // Authorization: `Bearer ${getAuthToken()}`,
        },
      });
      return response.data; // Axios returns data in response.data
      */
      // --- END Manual Call ---

      // Placeholder - replace with actual call to your new endpoint
      throw new Error("Export endpoint call not implemented in hook yet.");
    },
    enabled: enabled,
    // Consider cache settings for export data (might want shorter staleTime or not cache at all)
    staleTime: 1000 * 60 * 2, // 2 minutes, adjust or set to 0
    //cacheTime: 1000 * 60 * 5, // 5 minutes, adjust or set to 0
  });
};

export default useHistoricalDataExport;