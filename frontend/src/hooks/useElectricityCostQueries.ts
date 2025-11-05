// src/hooks/useElectricityCostQueries.ts
import { useQuery } from "@tanstack/react-query";
import { type ApiError, type ElectricityCostRow, ElectricityCostService } from "../client"; // Adjust path if needed

interface ElectricityCostParams {
  tenantId: string | null;
  date: string | null;
}

// --- HOOK: To GET the list of electricity cost rows ---
export const useGetElectricityCost = (params: ElectricityCostParams) => {
  const { tenantId, date } = params;

  return useQuery<ElectricityCostRow[], ApiError>({
    queryKey: ["electricity-cost", { tenantId, date }],
    queryFn: () =>
      ElectricityCostService.readElectricityCost({
        tenantId: tenantId!, // <-- Pass tenantId
        date: date!,
      }),
    // --- CHANGE: Use tenantId in enabled check ---
    enabled: !!tenantId && !!date,
    staleTime: 0,
  });
};
