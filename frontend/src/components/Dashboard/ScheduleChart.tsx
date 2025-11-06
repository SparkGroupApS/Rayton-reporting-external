import { Box, Heading, Text, Flex, Spinner } from "@chakra-ui/react";
import { useMemo } from "react";
import { Area, AreaChart, Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { ScheduleRow, ElectricityCostRow } from "@/client";
import { useGetSchedule } from "@/hooks/useScheduleQueries";
import { useGetElectricityCost } from "@/hooks/useElectricityCostQueries";

interface ScheduleChartProps {
  tenantId: string;
  date: string;
  scheduleData?: ScheduleRow[]; // Optional prop to pass schedule data from table
}

// Transform API response to chart format
const transformElectricityCostData = (apiResponse: ElectricityCostRow[] | undefined) => {
  if (!apiResponse) {
    return [];
  }

  // Create a map of all hours with their prices
  const hourMap = new Map<number, number>();
  apiResponse.forEach((cost) => {
    hourMap.set(cost.hour_of_day, parseFloat(cost.price_UAH_per_MWh.toString()));
  });

  // Generate data for all 24 hours from 00:00 to 23:00
  let chartData = [];
  for (let hour = 0; hour < 24; hour++) {
    let price;
    if (hourMap.has(hour)) {
      price = hourMap.get(hour)!;
    } else if (hour === 0 && hourMap.has(1)) {
      // For hour 0, use the price from the next hour (01:00) if available
      price = hourMap.get(1)!;
    } else {
      price = 0; // Use 0 if no data for this hour and no next hour data for hour 0
    }
    chartData.push({
      hour: hour,
      timeLabel: `${hour.toString().padStart(2, "0")}:00`,
      price: price,
    });
  }

  // Add a point at hour 24 with the actual price if available in API data, otherwise use the last hour's price
 const hour24Price = hourMap.has(24) ? hourMap.get(24)! : chartData[chartData.length - 1].price;
  chartData = [
    ...chartData,
    {
      hour: 24,
      timeLabel: "24:00",
      price: hour24Price,
    },
  ];

  return chartData;
};

// Transform schedule data for charting
const transformScheduleData = (scheduleRows: ScheduleRow[] | undefined) => {
  if (!scheduleRows || scheduleRows.length === 0) {
    // Return empty data for all 24 hours if no schedule data
    let chartData = [];
    for (let hour = 0; hour < 24; hour++) {
      chartData.push({
        hour: hour,
        timeLabel: `${hour.toString().padStart(2, "0")}:00`,
        charge_power: 0,
        discharge_power: 0,
      });
    }
    // Add a point at hour 24 with same values as the last hour
    const lastPoint = chartData[chartData.length - 1];
    chartData = [
      ...chartData,
      {
        hour: 24,
        timeLabel: "24:00",
        charge_power: lastPoint.charge_power,
        discharge_power: lastPoint.discharge_power,
      },
    ];

    return chartData;
  }

  // Create an array to hold the schedule values for each hour of the day
  const hourValues = new Array(24).fill(null).map(() => ({
    charge_power: 0,
    discharge_power: 0,
  }));

  // Filter out duplicate start times, keeping only the first occurrence (by rec_no)
  // This handles the case where there might be multiple records with the same start time
  const uniqueScheduleRows = [];
  const seenTimes = new Set();
  for (const row of scheduleRows) {
    const timeKey = row.start_time;
    if (!seenTimes.has(timeKey)) {
      seenTimes.add(timeKey);
      uniqueScheduleRows.push(row);
    }
  }

  // Process each unique schedule row to fill the appropriate hours
  for (let i = 0; i < uniqueScheduleRows.length; i++) {
    const currentRow = uniqueScheduleRows[i];
    const currentHour = parseInt(currentRow.start_time.split(":")[0], 10);

    // Determine the end hour for this row's values
    let endHour;
    if (i === uniqueScheduleRows.length - 1) {
      // For the last row in the list, the values apply until the next row in the list (which might be the first row if wrapping around)
      // Or until the end of the day if the next row has an earlier time (indicating wrap-around)
      const nextRow = uniqueScheduleRows[0]; // First row in the list
      const nextHour = parseInt(nextRow.start_time.split(":")[0], 10);
      if (nextHour > currentHour) {
        // If next hour is later in the day, use that as the end point
        endHour = nextHour;
      } else {
        // If next hour is earlier (indicating wrap-around), go to the end of the day
        endHour = 24;
      }
    } else {
      // For non-last rows, values apply until the next row in the list
      const nextRow = uniqueScheduleRows[i + 1];
      endHour = parseInt(nextRow.start_time.split(":")[0], 10);
    }

    // Apply the current row's values to all hours from currentHour up to (but not including) endHour
    for (let hour = currentHour; hour < endHour; hour++) {
      if (hour < 24) {
        // Only for valid hours 0-23
        hourValues[hour] = {
          charge_power: currentRow.charge_power != 0 && currentRow.charge_from_grid ? currentRow.charge_power : 0,
          discharge_power: currentRow.discharge_power || 0,
        };
      }
    }
  }

  // Generate data for all 24 hours from 00:00 to 23:00
  let chartData = [];
  for (let hour = 0; hour < 24; hour++) {
    chartData.push({
      hour: hour,
      timeLabel: `${hour.toString().padStart(2, "0")}:00`,
      charge_power: hourValues[hour].charge_power,
      discharge_power: hourValues[hour].discharge_power,
    });
  }

  // Add a point at hour 24 with same values as the last hour of the day (hour 23)
  const lastPoint = chartData[23]; // Use the values from hour 23, not from chartData[chartData.length - 1] which would be hour 23's data
  chartData = [
    ...chartData,
    {
      hour: 24,
      timeLabel: "24:00",
      charge_power: lastPoint.charge_power,
      discharge_power: lastPoint.discharge_power,
    },
  ];

  return chartData;
};

const ScheduleChart = ({ tenantId, date, scheduleData: propScheduleData }: ScheduleChartProps) => {
  const { data: fetchedScheduleData, isLoading: isScheduleLoading, error: scheduleError } = useGetSchedule({ tenantId, date });

  const { data: electricityCostData, isLoading: isElectricityCostLoading, error: electricityCostError } = useGetElectricityCost({ tenantId, date });

  // Use the schedule data passed via props if available, otherwise use the fetched data
  const scheduleDataToUse = propScheduleData || fetchedScheduleData;

  // Transform electricity cost data for charting
  const transformedCostData = useMemo(() => {
    return transformElectricityCostData(electricityCostData);
  }, [electricityCostData]);

  // Transform schedule data for charting
  const transformedScheduleData = useMemo(() => {
    return transformScheduleData(scheduleDataToUse);
  }, [scheduleDataToUse]);

  // Combine the two datasets by merging the power values into the cost data
  const combinedData = useMemo(() => {
    if (transformedCostData.length > 0 && transformedScheduleData.length > 0) {
      // Merge the two datasets by matching the timeLabel
      return transformedCostData.map((costPoint, index) => {
        const schedulePoint = transformedScheduleData[index];
        return {
          ...costPoint, // Spread the cost data (hour, timeLabel, price)
          charge_power: schedulePoint.charge_power,
          discharge_power: schedulePoint.discharge_power,
        };
      });
    } else if (transformedScheduleData.length > 0) {
      // If only schedule data is available, use it with default price values
      return transformedScheduleData;
    }
    return [];
  }, [transformedCostData, transformedScheduleData]);

  // If schedule data is provided via props, we don't need to wait for the schedule fetch
  const isLoading = isElectricityCostLoading; // Only check electricity cost loading since schedule data can come from props
  const error = electricityCostError;

  if (isLoading) {
    return (
      <Box p={4} borderWidth="1px" borderRadius="md" bg="gray.50" minHeight="400px">
        <Heading as="h3" size="md" mb={2}>
          Schedule Chart
        </Heading>
        <Flex justify="center" align="center" h="300px">
          <Spinner size="xl" />
        </Flex>
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={4} borderWidth="1px" borderRadius="md" bg="gray.50" minHeight="400px">
        <Heading as="h3" size="md" mb={2}>
          Schedule Chart
        </Heading>
        <Text color="red.500">Error loading chart: {error.message}</Text>
      </Box>
    );
  }

  return (
    <Box p={2} borderWidth="1px" borderRadius="md" bg="gray.50" minHeight="400px">
      {/* <Heading as="h3" size="md" mb={2}>Schedule Chart</Heading>
      <Text>Schedule visualization for {date}</Text>
      <Text>Total entries: {combinedData.length}</Text> */}

      <Box h="450px" mt={2}>
        {combinedData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height="50%">
              <AreaChart data={combinedData} syncId="chartSync" margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorChargePower" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorDischargePower" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3"  vertical={false} />
                <XAxis
                  dataKey="timeLabel"
                  interval={3} // Show every 3rd label to avoid crowding
                />
                {/* <YAxis yAxisId="left" label={{ value: "UAH/MWh", angle: -90, position: "insideLeft" }} domain={["auto", "auto"]} /> */}
                <YAxis yAxisId="right" orientation="left" label={{ value: "MW", angle: -90, position: "insideLeft" }} domain={["auto", "auto"]} />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "price") {
                      return [`${value} UAH/MWh`, "Price"];
                    } else if (name === "charge_power") {
                      return [`${value} MW`, "Charge Power"];
                    } else if (name === "discharge_power") {
                      return [`${value} MW`, "Discharge Power"];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(label) => `Time: ${label}`}
                />
                <Legend />
                {/* <Area
                  type="stepBefore"
                  dataKey="price"
                  name="Electricity Price (UAH/MWh)"
                  stroke="#3b82f6"
                  fill="url(#colorPrice)"
                  fillOpacity={1}
                  strokeWidth={2}
                  dot={{ r: 0 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                  yAxisId="left"
                /> */}
                <Area
                  type="stepAfter"
                  dataKey="charge_power"
                  name="Charge Power (MW)"
                  stroke="#10b981"
                  fill="url(#colorChargePower)"
                  fillOpacity={1}
                  strokeWidth={2}
                  dot={{ r: 0 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                  yAxisId="right"
                />
                <Area
                  type="stepAfter"
                  dataKey="discharge_power"
                  name="Discharge Power (MW)"
                  stroke="#ef4444"
                  fill="url(#colorDischargePower)"
                  fillOpacity={1}
                  strokeWidth={2}
                  dot={{ r: 0 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                  yAxisId="right"
                />
              </AreaChart>
            </ResponsiveContainer>
            <ResponsiveContainer width="100%" height="50%">
              <AreaChart data={combinedData} syncId="chartSync" margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorChargePower" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorDischargePower" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3"  vertical={false} />
                <XAxis
                  dataKey="timeLabel"
                  interval={3} // Show every 3rd label to avoid crowding
                />
                <YAxis yAxisId="left" label={{ value: "UAH/MWh", angle: -90, position: "insideLeft" }} domain={["auto", "auto"]} />
                {/* <YAxis yAxisId="right" orientation="right" label={{ value: "MW", angle: 90, position: "insideRight" }} domain={["auto", "auto"]} /> */}
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "price") {
                      return [`${value} UAH/MWh`, "Price"];
                    } else if (name === "charge_power") {
                      return [`${value} MW`, "Charge Power"];
                    } else if (name === "discharge_power") {
                      return [`${value} MW`, "Discharge Power"];
                    }
                    return [value, name];
                  }}
                  labelFormatter={(label) => `Time: ${label}`}
                />
                <Legend />
                <Area
                  type="stepBefore"
                  dataKey="price"
                  name="Electricity Price (UAH/MWh)"
                  stroke="#3b82f6"
                  fill="url(#colorPrice)"
                  fillOpacity={1}
                  strokeWidth={2}
                  dot={{ r: 0 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                  yAxisId="left"
                />
                {/* <Area
                  type="stepAfter"
                  dataKey="charge_power"
                  name="Charge Power (MW)"
                  stroke="#10b981"
                  fill="url(#colorChargePower)"
                  fillOpacity={1}
                  strokeWidth={2}
                  dot={{ r: 0 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                  yAxisId="right"
                />
                <Area
                  type="stepAfter"
                  dataKey="discharge_power"
                  name="Discharge Power (MW)"
                  stroke="#ef4444"
                  fill="url(#colorDischargePower)"
                  fillOpacity={1}
                  strokeWidth={2}
                  dot={{ r: 0 }}
                  activeDot={{ r: 6 }}
                  isAnimationActive={false}
                  yAxisId="right"
                /> */}
              </AreaChart>
            </ResponsiveContainer>
          </>
        ) : (
          <Flex justify="center" align="center" h="300px">
            <Text>No data available for charting</Text>
          </Flex>
        )}
      </Box>
    </Box>
  );
};

export default ScheduleChart;
