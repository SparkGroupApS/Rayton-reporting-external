// src/components/Dashboard/ChartExportMenu.tsx
import { Button, Menu, Portal, Icon } from "@chakra-ui/react";
import { type ReactNode } from "react";
//import { FaDownload } from "react-icons/fa";

// --- CHANGED: Import the new export hook ---
import { useQueryClient } from "@tanstack/react-query"; // Keep useQueryClient for potential cache interactions
// --- END CHANGED ---
import { toPng } from "html-to-image";
import { type RefObject, useState } from "react";
import { LuDownload } from "react-icons/lu";
import * as XLSX from "xlsx";
// --- REMOVED: Direct import of HistoricalDataService for the API call ---
// import { HistoricalDataService, type HistoricalDataGroupedResponse } from "@/client";
// --- ADDED: Import the new hook and its types ---
import useHistoricalDataExport, { type ExportDataResponse } from "@/hooks/useHistoricalDataExport"; // Adjust path if needed
// --- END ADDED ---
import { toaster } from "@/components/ui/toaster";

interface ChartExportMenuProps {
  chartRef: RefObject<HTMLDivElement>;
  tenantId: string | null;
  dataIds: number[];
  startDate: Date;
  endDate: Date;
  plantName: string;
  timeRange: string; // e.g., "Day", "Week", "Month"
}

// Helper to generate a clean filename
const getFilename = (plantName: string, timeRange: string, ext: string) => {
  const date = new Date().toISOString().split("T")[0];
  const cleanPlantName = plantName.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  return `${cleanPlantName}_${timeRange}_${date}.${ext}`;
};

export const ChartExportMenu = ({ chartRef, tenantId, dataIds, startDate, endDate, plantName, timeRange }: ChartExportMenuProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  // --- PNG EXPORT (No change needed) ---
  const onExportPNG = async () => {
    if (!chartRef.current) {
      toaster.create({ title: "Error exporting PNG", type: "error" });
      return;
    }
    setIsLoading(true);
    try {
      const dataUrl = await toPng(chartRef.current, { cacheBust: true });
      const link = document.createElement("a");
      link.download = getFilename(plantName, timeRange, "png");
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error(err);
      toaster.create({ title: "Error exporting PNG", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // --- CSV / XLSX EXPORT (MODIFIED to use the new hook) ---
  const onExportData = async (format: "xlsx" | "csv") => {
    if (!tenantId) return;
    setIsLoading(true);

    try {
      // 1. --- FETCH RAW EXPORT DATA USING THE NEW HOOK ---
      // Use queryClient.fetchQuery to call the hook's logic imperatively
      // The hook's queryFn will make the call to the new /export/ endpoint
      const exportData: ExportDataResponse = await queryClient.fetchQuery({
        // --- IMPORTANT: Use the correct queryKey structure expected by useHistoricalDataExport ---
        // This should match the queryKey defined inside the useHistoricalDataExport hook
        queryKey: ["historicalDataExport", { // Match the key prefix used in the hook
          tenantId,
          data_ids: dataIds, // Match the parameter name used in the hook (snake_case if that's what the hook expects)
          start: startDate.toISOString(), // Ensure ISO string format
          end: endDate.toISOString(),     // Ensure ISO string format
          // export_granularity: "hourly" // If your hook/backend expects this, add it. Otherwise, omit.
        }],
        // --- IMPORTANT: Replicate the hook's queryFn logic here for fetchQuery ---
        queryFn: async () => {
          // --- CALL THE NEW EXPORT ENDPOINT ---
          // Replicate the core logic from useHistoricalDataExport's queryFn
          // You need to make the actual API call to your new /export/ endpoint here.
          // This example assumes you have generated a service method or use apiClient.axiosInstance.

          // --- OPTION 1: If you generated a service method (e.g., HistoricalDataService.readHistoricalDataExport) ---
          /*
          try {
            // Assuming your backend generates a service method like this based on OpenAPI spec
            const response = await HistoricalDataService.readHistoricalDataExport({
              // Map parameters correctly
              tenantId: tenantId, // Or tenant_id if backend expects snake_case in query params
              dataIds: dataIds,   // Or data_ids
              start: startDate.toISOString(),
              end: endDate.toISOString(),
              // exportGranularity: "hourly" // If needed
            });
            // Return the data part of the response (adjust based on your generated client)
            return response.data; // Or just response if it's the raw data array
          } catch (error) {
            // Handle error and re-throw or throw a new error compatible with React Query
            console.error("API call failed in fetchQuery:", error);
            if (error instanceof Error) {
              throw error; // Re-throw standard JS errors
            } else {
              throw new Error(`Network response was not ok: ${String(error)}`);
            }
          }
          */
          // --- END OPTION 1 ---

          // --- OPTION 2: Manual Axios/Fetch call (More common if service method not auto-generated) ---
          try {
            // Import your apiClient if needed (adjust path)
            // import apiClient from "@/client"; // Or wherever your axios instance is configured
            // const response = await apiClient.axiosInstance.get('/api/v1/historical-data/export/', { ... });

            // Example using a generic fetch or your configured apiClient instance
            // Adjust the URL path and parameter serialization method as needed.
            // Ensure headers (like Authorization) are included if required.
            const response = await fetch(`/api/v1/historical-data/export/`, { // Adjust base URL if needed
              method: 'GET',
              // Construct query parameters
              // Using URLSearchParams for simplicity, but libraries like axios handle this
              headers: {
                'Content-Type': 'application/json',
                // Add Authorization header if your API requires it
                // 'Authorization': `Bearer ${getAuthToken()}`, // Implement getAuthToken()
              },
            });

            if (!response.ok) {
              throw new Error(`Network response was not ok: ${response.statusText}`);
            }

            const data: ExportDataResponse = await response.json(); // Parse JSON response
            return data;
          } catch (error) {
            console.error("API call failed in fetchQuery:", error);
            if (error instanceof Error) {
              throw error; // Re-throw standard JS errors
            } else {
              throw new Error(`Network response was not ok: ${String(error)}`);
            }
          }
          // --- END OPTION 2 ---
        },
        // staleTime and cacheTime can be set here if needed for fetchQuery
        // They control how long this specific fetchQuery result is considered fresh/cached
        // staleTime: 1000 * 60 * 2, // 2 minutes
        // cacheTime: 1000 * 60 * 5,  // 5 minutes
      });
      // --- END FETCH ---

      if (!exportData || exportData.length === 0) {
         toaster.create({ title: "No data available for export.", type: "warning" });
         return;
      }

      // 2. --- FORMAT DATA FOR EXPORT (Simplified) ---
      // The exportData from the new endpoint is already structured as a list of row objects
      // [{timestamp: "...", "101": 123.4, ...}, ...]
      // XLSX.utils.json_to_sheet can often handle this directly.
      // If you need specific formatting (e.g., renaming columns), do it here.
      // For now, assume exportData is ready.
      const formattedData = exportData; // Or process it further if needed

      // 3. --- CREATE EXCEL SHEET ---
      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Exported_Data"); // Use a generic name or base it on plantName/timeRange

      // 4. --- TRIGGER DOWNLOAD ---
      XLSX.writeFile(wb, getFilename(plantName, `${timeRange}_export`, format)); // Adjust filename suffix if desired
    } catch (err: any) {
      console.error("Export Error:", err);
      toaster.create({
        title: "Error exporting data",
        description: err.message || "Could not fetch raw data.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };
  // --- END MODIFIED EXPORT ---

  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <Button variant="outline" size="sm" as={Button} loading={isLoading}>
          <LuDownload /> Export
        </Button>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content fontSize="sm">
            <Menu.Item value="csv" onClick={() => onExportData("csv")} disabled={isLoading}>
              Export as CSV
            </Menu.Item>
            <Menu.Item value="xlsx" onClick={() => onExportData("xlsx")} disabled={isLoading}>
              Export as XLSX
            </Menu.Item>
            <Menu.Item value="png" onClick={onExportPNG} disabled={isLoading}>
              Export Data as PNG
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

export default ChartExportMenu;