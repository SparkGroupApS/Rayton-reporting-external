// src/components/Dashboard/ChartExportMenutsx
import { Button } from "@chakra-ui/react"; //, Menu, Portal
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from "../ui/menu";
import { toPng } from "html-to-image";
import { type RefObject, useState } from "react";
import { LuDownload } from "react-icons/lu";
import * as XLSX from "xlsx";
import { toaster } from "@/components/ui/toaster";
import useHistoricalDataExport from "@/hooks/useHistoricalDataExport";
import type { HistoricalDataGroupedResponse } from "@/client";

interface ChartExportMenuProps {
  chartRef: RefObject<HTMLDivElement | null>;
  tenantId: string;
  dataIds: number[];
  startDate: Date;
  endDate: Date;
  fileName: string;
}

// --- ADD THIS HELPER FUNCTION ---
/**
 * Formats a Date object as a local ISO string (e.g., "2025-11-04T00:00:00")
 * without converting it to UTC.
 */
const toLocalISOString = (date: Date) => {
  const tzOffset = date.getTimezoneOffset() * 60000; // offset in milliseconds
  const localISOTime = new Date(date.getTime() - tzOffset)
    .toISOString()
    .slice(0, 23); // Get precision (YYYY-MM-DDTHH:mm:ss.sss)

  // Return YYYY-MM-DDTHH:mm:ss format
  return localISOTime.slice(0, 19);
};
// ---------------------------------

export const ChartExportMenu = ({ chartRef, tenantId, dataIds, startDate, endDate, fileName }: ChartExportMenuProps) => {
  const [isLoading, setIsLoading] = useState(false);

  // Use the hook to fetch historical data for export
  const { refetch: refetchExportData } = useHistoricalDataExport(
    {
      tenantId,
      data_ids: dataIds,
      start: toLocalISOString(startDate), // Was: startDate.toISOString()
      end: toLocalISOString(endDate),     // Was: endDate.toISOString()
      export_granularity: "hourly",
    },
    {
      enabled: false, // Disable automatic fetching, we'll use refetch when needed
    }
  );

  // --- PNG EXPORT ---
  const onExportPNG = async () => {
    if (!chartRef.current) {
      toaster.create({ title: "Error exporting PNG", type: "error" });
      return;
    }
    setIsLoading(true);
    try {
      const dataUrl = await toPng(chartRef.current, { cacheBust: true });
      const link = document.createElement("a");
      link.download = fileName || "chart.png";
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error(err);
      toaster.create({ title: "Error exporting PNG", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // --- CSV / XLSX EXPORT ---
  const onExportData = async (format: "xlsx" | "csv") => {
    setIsLoading(true);

    try {
      // Fetch data using the hook's refetch function
      const result = await refetchExportData();
      const responseData = result.data as HistoricalDataGroupedResponse;

      if (!responseData || !responseData.series || responseData.series.length === 0) {
        toaster.create({ title: "No data available for export.", type: "warning" });
        return;
      }

      // Transform the series data into a flat array of rows for Excel
      const seriesData = responseData.series;

      // Create a map of timestamp -> row data
      const rowMap = new Map<string, any>();

      seriesData.forEach((series) => {
        const columnName = series.name || `Data ID ${series.data_id}`;

        series.data.forEach((point) => {
          // Convert millisecond timestamp to readable format for Excel
          const date = new Date(point.x);
          // Format as "YYYY-MM-DD HH:MM:SS" without timezone
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const day = String(date.getDate()).padStart(2, "0");
          const hours = String(date.getHours()).padStart(2, "0");
          const minutes = String(date.getMinutes()).padStart(2, "0");
          const seconds = String(date.getSeconds()).padStart(2, "0");
          const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

          // Якщо getHours() = 4, це кінець 4-ї години (03:00-04:00). Це і є "Година 4".
          // Виняток: 00:00 (getHours() = 0) - це кінець "Години 24".
          const marketHour = date.getHours() === 0 ? 24 : date.getHours();

          if (!rowMap.has(timestamp)) {
            rowMap.set(timestamp, {
              Timestamp: timestamp,
              "Година": marketHour,
            });
          }

          const row = rowMap.get(timestamp);
          row[columnName] = point.y;
        });
      });

      // Convert map to array and sort by timestamp
      const exportData = Array.from(rowMap.values()).sort((a, b) => new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime());

      if (exportData.length === 0) {
        toaster.create({ title: "No data available for export.", type: "warning" });
        return;
      }

      // Create Excel sheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Hourly_Energy_Data");

      // Trigger download with appropriate file extension
      const fileExtension = format === "csv" ? ".csv" : ".xlsx";
      const finalFileName = fileName.endsWith(fileExtension) ? fileName : fileName + fileExtension;
      XLSX.writeFile(wb, finalFileName);

      toaster.create({
        title: "Export successful",
        description: `Exported ${exportData.length} hours of data`,
        type: "success",
      });
    } catch (err: any) {
      console.error("Export Error:", err);
      toaster.create({
        title: "Error exporting data",
        description: err.message || "Could not fetch data for export.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <Button variant="solid" size="sm" as={Button} loading={isLoading}>
          <LuDownload /> Експорт
        </Button>
      </MenuTrigger>

      <MenuContent>
        <MenuItem value="csv" onClick={() => onExportData("csv")} disabled={isLoading}>
          Експорт CSV
        </MenuItem>
        <MenuItem value="xlsx" onClick={() => onExportData("xlsx")} disabled={isLoading}>
          Експорт XLSX
        </MenuItem>
        <MenuItem value="png" onClick={onExportPNG} disabled={isLoading}>
          Експорт PNG
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  );
};

export default ChartExportMenu;
