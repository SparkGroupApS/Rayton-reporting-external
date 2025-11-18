// src/hooks/usePlcDataSettingsQueries.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ApiError,
  type PlcDataSettingsExtendedRow,
  ControlService
} from "../client"; // Adjust path if needed

interface PlcDataControlarams {
  tenantId: string | null;
}

// --- HOOK 1: To GET the list of PLC data settings ---
export const useGetPlcDataControl = (params: PlcDataControlarams) => {
  const { tenantId } = params;

  return useQuery<PlcDataSettingsExtendedRow[], ApiError>({
    queryKey: ["plcDataControl", { tenantId }],
    queryFn: () =>
      ControlService.getPlcControl({
        tenantId: tenantId!, // <-- Pass tenantId
      }),
    enabled: !!tenantId,
    staleTime: 0,
    refetchOnWindowFocus: false, // Prevents data from resetting on tab change
 });
};

// --- HOOK 2: Hook for Bulk Update ---
export const useBulkUpdatePlcDataControl = (params: PlcDataControlarams) => {
  const queryClient = useQueryClient();
  const { tenantId } = params;

  return useMutation({
    // Expects array, returns CommandResponse with message_id
    mutationFn: (controlRows: PlcDataSettingsExtendedRow[]) => {
      // Transform the data to send only the required fields [plant_id, data_id, data]
      const transformedData = controlRows.map(row => ({
        id: row.id, // Use the database ID as id for the update request
        data: row.data,
        updated_by: row.updated_by
      }));
      return ControlService.updatePlcControl({
        // Use the new service method
        tenantId: tenantId!, // <-- Pass tenantId
        requestBody: transformedData,
      });
    },

    onSuccess: (_response) => {
      // 'response' is the CommandResponse from backend with message_id
      // Note: Query invalidation is now handled by WebSocket confirmation in the component
      // Optional: Update the query cache directly with the response
      // queryClient.setQueryData(['plcDataSettings', { tenantId }], savedData);
    },
    onError: (error) => {
      console.error("Failed to bulk update PLC data commands", error);
      //toaster.create({ title: "Save Failed", description: error.message || "Could not save settings.", type: "error" });
    },
  });
};
