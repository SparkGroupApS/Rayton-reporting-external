import { useState, useEffect } from "react";

//import { authFetch } from "../utils";
//import type { HistoricalDataType } from "../types";
//import { fetchHistoricalChartData } from "../fetchHistoricalChartData";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export function useHistoricalData(module: any, currentPage: number, currentDate?: Date) {
  const {
    data: historicalData,
    totalPages: fetchedTotalPages,
    loading,
  } = usePaginatedFetch<HistoricalDataType>(
    `${API_BASE_URL}/api/historical_data/`,
    module,
    currentPage,
    10,
    currentDate
  );

  const [historicalChartData, setHistoricalChartData] = useState<
    { timestamp: string; values: { [key: string]: number }; data_id: number; label?: string }[]
  >([]);
  const [selectedDataId, setSelectedDataId] = useState<number | null>(null);

  // Fetch chart data when selectedDataId changes
  useEffect(() => {
    async function fetchChart() {
      if (!selectedDataId || !module?.tenant_db) return;
      const data = await fetchHistoricalChartData(
        [selectedDataId],
        module.tenant_db,
        "1D", // Default time range
        module.plant_id,
        currentDate
      );
      setHistoricalChartData(data);
    }
    fetchChart();
  }, [selectedDataId, module, currentDate]);

  const handleGenerateHistoricalChart = async (payload: {
    rawData: HistoricalDataType[];
    selectedColumns: string[];
    timeRange: string;
  }) => {
    if (!module || !module.tenant_db || payload.rawData.length === 0) {
      console.error("[ERROR] Missing data selection or module details.");
      return;
    }

    const dataIds = payload.rawData.map((row) => row.data_id);
    const plantId = payload.rawData[0]?.plant_id || module.plant_id;

    try {
      const data = await fetchHistoricalChartData(
        dataIds,
        module.tenant_db,
        payload.timeRange,
        plantId,
        currentDate
      );
      setHistoricalChartData(data);
    } catch (error) {
      console.error("[ERROR] Error fetching historical chart data:", error);
    }
    console.log("[DEBUG] Generating chart for IDs:", dataIds);

  };

  return {
    historicalData,
    totalPages: fetchedTotalPages,
    loading,
    historicalChartData,
    selectedDataId,
    setSelectedDataId,
    handleGenerateHistoricalChart,
  };
}
