// src/hooks/useScheduleQueries.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ScheduleService,
  type ScheduleRow, // Assuming this is the type from your client
  type ApiError,
} from "../client"; // Adjust path if needed

interface ScheduleParams {
  // plantId: number | null; // REMOVE
  // tenantDb: string | null; // REMOVE
  tenantId: string | null; // <-- USE tenantId (UUID string)
  date: string | null;
}

// --- HOOK 1: To GET the list of schedule rows ---
export const useGetSchedule = (params: ScheduleParams) => {
  const { tenantId, date } = params;

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
  });
};

// --- HOOK 2: Hook for Bulk Update ---
export const useBulkUpdateSchedule = (params: ScheduleParams) => {
  const queryClient = useQueryClient();
  const { tenantId, date } = params;

  return useMutation<ScheduleRow[], ApiError, ScheduleRow[]>({
    // Expects array, returns array
    mutationFn: (scheduleRows: ScheduleRow[]) =>
      ScheduleService.bulkUpdateSchedule({
        // Use the new service method
        tenantId: tenantId!, // <-- Pass tenantId
        date: date!,
        requestBody: scheduleRows,
      }),

    onSuccess: (savedData) => {
      // 'savedData' is the List[ScheduleRow] from backend
      // Invalidate the query to refetch after save
      queryClient.invalidateQueries({
        queryKey: ["schedule", { tenantId, date }],
      });
      // Optional: Update the query cache directly with the response
      // queryClient.setQueryData(['schedule', { plantId, tenantDb, date }], savedData);
    },
    onError: (error) => {
      console.error("Failed to bulk update schedule", error);
      //toaster.create({ title: "Save Failed", description: error.message || "Could not save schedule.", type: "error" });
    },
  });
};
