// src/hooks/useScheduleQueries.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  type ApiError,
  type ScheduleRow, // Assuming this is the type from your client
  ScheduleService,
} from "../client" // Adjust path if needed

interface ScheduleParams {
  // plantId: number | null; // REMOVE
  // tenantDb: string | null; // REMOVE
  tenantId: string | null // <-- USE tenantId (UUID string)
  date: string | null
}

// --- HOOK 1: To GET the list of schedule rows ---
export const useGetSchedule = (params: ScheduleParams) => {
  const { tenantId, date } = params

  return useQuery<ScheduleRow[], ApiError>({
    // --- CHANGE: Use tenantId in queryKey ---
    queryKey: ["schedule", { tenantId, date }],
    queryFn: () =>
      ScheduleService.readSchedule({
        tenantId: tenantId!, // <-- Pass tenantId
        date: date!,
      }),
    // --- CHANGE: Use tenantId in enabled check ---
    enabled: !!tenantId && !!date,
    staleTime: 0,
    refetchOnWindowFocus: false, // Prevents data from resetting on tab change
  })
}

// --- HOOK 2: Hook for Bulk Update ---
export const useBulkUpdateSchedule = (params: ScheduleParams) => {
  const queryClient = useQueryClient()
  const { tenantId, date } = params

  return useMutation({
    // Expects array, returns CommandResponse with message_id
    mutationFn: (scheduleRows: ScheduleRow[]) =>
      ScheduleService.bulkUpdateSchedule({
        // Use the new service method
        tenantId: tenantId!, // <-- Pass tenantId
        date: date!,
        requestBody: scheduleRows,
      }),

    onSuccess: (_response) => {
      // 'response' is the CommandResponse from backend with message_id
      // Note: Query invalidation is now handled by WebSocket confirmation in the component
      // Optional: Update the query cache directly with the response
      // queryClient.setQueryData(['schedule', { plantId, tenantDb, date }], savedData);
    },
    onError: (error) => {
      console.error("Failed to bulk update schedule", error)
      //toaster.create({ title: "Save Failed", description: error.message || "Could not save schedule.", type: "error" });
    },
  })
}
