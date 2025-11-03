// src/components/Dashboard/ChartExportMenu.tsx
import { Button, Menu, Portal } from "@chakra-ui/react";
import { toPng } from "html-to-image";
import { type RefObject, useState } from "react";
import { LuDownload } from "react-icons/lu";
import * as XLSX from "xlsx";
import { toaster } from "@/components/ui/toaster";

interface ChartExportMenuProps {
  chartRef: RefObject<HTMLDivElement | null>;
  data?: { [key: string]: any; x: number; }[];
  fileName: string;
}

export const ChartExportMenu = ({ chartRef, data, fileName }: ChartExportMenuProps) => {
  const [isLoading, setIsLoading] = useState(false);

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

  // --- CSV / XLSX EXPORT (MODIFIED to use the provided data prop) ---
  const onExportData = async (format: "xlsx" | "csv") => {
    if (!data) return;
    setIsLoading(true);

    try {
      // Use the provided data prop for export
      if (!data || data.length === 0) {
         toaster.create({ title: "No data available for export.", type: "warning" });
         return;
      }

      // 2. --- FORMAT DATA FOR EXPORT (Simplified) ---
      // The data prop is already structured as a list of row objects
      // [{timestamp: "...", "101": 123.4, ...}, ...]
      // XLSX.utils.json_to_sheet can often handle this directly.
      // If you need specific formatting (e.g., renaming columns), do it here.
      // For now, assume data is ready.
      const formattedData = data; // Or process it further if needed

      // 3. --- CREATE EXCEL SHEET ---
      const ws = XLSX.utils.json_to_sheet(formattedData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Exported_Data"); // Use a generic name or base it on plantName/timeRange

      // 4. --- TRIGGER DOWNLOAD ---
      // Use the fileName prop for consistency, but change extension based on format
      const fileExtension = format === "csv" ? ".csv" : ".xlsx";
      const finalFileName = fileName.endsWith(fileExtension) ? fileName : fileName + fileExtension;
      XLSX.writeFile(wb, finalFileName); // Use the fileName prop for consistency
    } catch (err: any) {
      console.error("Export Error:", err);
      toaster.create({
        title: "Error exporting data",
        description: err.message || "Could not export data.",
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
