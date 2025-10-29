// src/hooks/useScheduleQueries.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ScheduleService,
    type ScheduleRow, // Assuming this is the type from your client
    type ApiError 
} from '../client'; // Adjust path if needed

interface ScheduleParams {
    plantId: number | null;
    tenantDb: string | null;
    date: string | null;
}

// --- HOOK 1: To GET the list of schedule rows ---
export const useGetSchedule = (params: ScheduleParams) => {
    const { plantId, tenantDb, date } = params;

    return useQuery<ScheduleRow[], ApiError>({
        queryKey: ['schedule', { plantId, tenantDb, date }],
        queryFn: () => ScheduleService.readSchedule({ 
            plantId: plantId!, 
            tenantDb: tenantDb!,
            date: date! // <-- ADD date
        }),
        enabled: !!plantId && !!tenantDb,
        // We set staleTime to 0 so it refetches on window focus,
        // ensuring data is always in sync with the server.
        staleTime: 0,
    });
};

// --- HOOK 2: Hook for Bulk Update ---
export const useBulkUpdateSchedule = (params: ScheduleParams) => {
    const queryClient = useQueryClient();
    const { plantId, tenantDb, date } = params;

    return useMutation<ScheduleRow[], ApiError, ScheduleRow[]>({ // Expects array, returns array
        mutationFn: (scheduleRows: ScheduleRow[]) =>
            ScheduleService.bulkUpdateSchedule({ // Use the new service method
                plantId: plantId!,
                tenantDb: tenantDb!,
                date: date!,
                requestBody: scheduleRows // Send the whole array
            }),

        onSuccess: (savedData) => { // 'savedData' is the List[ScheduleRow] from backend
            // Invalidate the query to refetch after save
            queryClient.invalidateQueries({
                queryKey: ['schedule', { plantId, tenantDb, date }]
            });
            // Optional: Update the query cache directly with the response
            // queryClient.setQueryData(['schedule', { plantId, tenantDb, date }], savedData);
        },
        onError: (error) => {
            console.error("Failed to bulk update schedule", error);
            // Consider using toaster here
        }
    });
};