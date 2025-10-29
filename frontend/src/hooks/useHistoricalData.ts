// src/hooks/useHistoricalData.ts
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { 
    HistoricalDataService, 
    type ApiError, 
    type HistoricalDataGroupedResponse 
} from '@/client'; // Adjust path if needed

// Define the type for the parameters needed by the hook/API
interface FetchHistoricalDetailsParams {
    plant_id: number | null;  // Allow null
    data_ids: number[];
    start?: string | null;
    end?: string | null;
    tenant_id_override?: string | null;
}

// Define the type for extra useQuery options
type UseHistoricalDataQueryOptions = Omit<UseQueryOptions<HistoricalDataGroupedResponse, ApiError>,
    'queryKey' | 'queryFn' // Only omit keys set internally
>;

/**
 * Hook to fetch detailed historical data, grouped by series, for charting.
 */
const useHistoricalData = (
    params: FetchHistoricalDetailsParams,
    options: UseHistoricalDataQueryOptions = {}
) => {
    
    // Determine if the query should be enabled
    const enabled = (
        options.enabled !== false && // Allow explicit disabling
        !!params.plant_id && // Must have a plant_id
        params.data_ids && params.data_ids.length > 0 // Must have data_ids
    );

    return useQuery<HistoricalDataGroupedResponse, ApiError>({
        // Spread any additional options (like 'enabled' from the caller)
        ...options,
        
        queryKey: ['historicalDataDetails', params], // Cache based on params
        
        queryFn: () => HistoricalDataService.readHistoricalDetails({
            plantId: params.plant_id!, // '!' is safe here because 'enabled' checks it
            dataIds: params.data_ids,
            start: params.start || undefined,
            end: params.end || undefined,
            tenantIdOverride: params.tenant_id_override || undefined,
        }),
        
        enabled: enabled, // Control when the query runs
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
};

export default useHistoricalData;