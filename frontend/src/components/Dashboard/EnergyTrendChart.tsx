// src/components/Dashboard/EnergyTrendChart.tsx
import React, { useMemo, useState } from 'react';
import {
    Box, Spinner, Text, Flex, GridItem,
    Button, ButtonGroup, IconButton, Input, HStack,
    Switch // --- Add Switch for Chakra UI
} from '@chakra-ui/react';
// Recharts Imports
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from 'recharts';
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

import useHistoricalData from '@/hooks/useHistoricalData';
import type {
    HistoricalDataGroupedResponse,
    TimeSeriesData,
    ApiError
} from '@/client';

// Interface for component props (no change from last step)
interface EnergyTrendChartProps {
    tenantId?: string | null;
    plantId: number | null;
    energyDataIds: number[];
    socDataId: number;
}

// Time Range Definitions (no change)
type TimeRange = '1D' | '1W' | '1M' | '1Y' | 'All';
const timeRangeConfig: { [key in TimeRange]: {
    interval: 'hourly' | 'daily' | 'monthly',
    getStart: (date: Date) => Date
} } = {
    '1D': { interval: 'hourly', getStart: (date) => date },
    '1W': { interval: 'daily', getStart: (date) => { const d = new Date(date); d.setDate(date.getDate() - 7); return d; } },
    '1M': { interval: 'daily', getStart: (date) => { const d = new Date(date); d.setMonth(date.getMonth() - 1); return d; } },
    '1Y': { interval: 'monthly', getStart: (date) => { const d = new Date(date); d.setFullYear(date.getFullYear() - 1); return d; } },
    'All': { interval: 'monthly', getStart: () => new Date(2000, 0, 1) }
};

// Helper Functions (no change)
const toLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};
const toLocalISOString = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

// Recharts Helper: Color Array (no change)
const COLORS = ['#7cb5ec', '#434348', '#90ed7d', '#f7a35c', '#8085e9', '#f15c80', '#e4d354', '#2b908f', '#f45b5b', '#91e8e1'];

// Recharts Helper: Functions for 1D View Ticks (no change)
const getHourlyTicks = (start: number, end: number): number[] => {
    const ticks: number[] = [];
    let current = start;
    const threeHours = 3 * 60 * 60 * 1000;
    while (current <= end) {
        ticks.push(current);
        current += threeHours;
    }
    return ticks;
};
const formatHourlyTick = (timestamp: number, index: number, totalTicks: number) => {
    if (index === 0) return '00:00';
    if (index === totalTicks - 1) return '24:00';
    return new Date(timestamp).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
};

// Helper: Data Transformation Function (no change)
const transformApiData = (
    apiResponse: HistoricalDataGroupedResponse | undefined,
    colorIndices: number[]
) => {
    if (!apiResponse || !apiResponse.series) {
        return null;
    }
    const dataMap: { [key: number]: { x: number;[key: string]: any } } = {};
    const seriesInfo = apiResponse.series.map((s, i) => ({
        name: s.name,
        color: COLORS[colorIndices[i] % COLORS.length]
    }));
    for (const series of apiResponse.series) {
        for (const point of series.data) {
            if (!dataMap[point.x]) {
                dataMap[point.x] = { x: point.x };
            }
            dataMap[point.x][series.name] = point.y;
        }
    }
    const chartData = Object.values(dataMap).sort((a, b) => a.x - b.x);
    return { chartData, seriesInfo };
};


const EnergyTrendChart = ({
    tenantId,
    plantId,
    energyDataIds,
    socDataId
}: EnergyTrendChartProps) => {

    // --- State (Added isSocCombined) ---
    const [currentDate, setCurrentDate] = useState(new Date());
    const [timeRange, setTimeRange] = useState<TimeRange>('1D');
    const [isSocCombined, setIsSocCombined] = useState(false); // New state for the switch

    // Date Calculation (no change)
    const { startDate, endDate, interval } = useMemo(() => {
        const config = timeRangeConfig[timeRange];
        const start = config.getStart(currentDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(currentDate);
        if (config.interval === 'hourly') {
            end.setDate(end.getDate() + 1);
            end.setHours(0, 0, 0, 0);
        } else {
            end.setHours(23, 59, 59, 999);
        }
        return { startDate: start, endDate: end, interval: config.interval };
    }, [currentDate, timeRange]);

    // Data Fetching (no change)
    const commonQueryOptions = {
        plant_id: plantId,
        start: toLocalISOString(startDate),
        end: toLocalISOString(endDate),
    };

    const {
        data: energyApiResponse,
        isLoading: isLoadingEnergy,
        error: energyError
    } = useHistoricalData({
        ...commonQueryOptions,
        data_ids: energyDataIds,
    }, {
        enabled: !!tenantId && !!plantId && energyDataIds.length > 0
    });

    const {
        data: socApiResponse,
        isLoading: isLoadingSoc,
        error: socError
    } = useHistoricalData({
        ...commonQueryOptions,
        data_ids: [socDataId],
    }, {
        enabled: !!tenantId && !!plantId
    });

    // Date Handlers (no change)
    const handleTimeRangeChange = (newRange: TimeRange) => setTimeRange(newRange);
    const handleDateChange = (dateString: string) => {
        const [year, month, day] = dateString.split('-').map(Number);
        if (year && month && day) {
            setCurrentDate(new Date(year, month - 1, day));
        }
    };
    const handleDateArrow = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentDate);
        const increment = direction === 'next' ? 1 : -1;
        if (timeRange === '1D') newDate.setDate(newDate.getDate() + increment);
        else if (timeRange === '1W') newDate.setDate(newDate.getDate() + (7 * increment));
        else if (timeRange === '1M') newDate.setMonth(newDate.getMonth() + increment);
        else if (timeRange === '1Y') newDate.setFullYear(newDate.getFullYear() + increment);
        setCurrentDate(newDate);
    };
    const isToday = currentDate.toDateString() === new Date().toDateString();

    // --- Data Transformation (UPDATED) ---
    // We now have THREE datasets: separate energy, separate soc, and combined

    // 1. Separate Energy Data
    const transformedEnergyData = useMemo(() =>
        transformApiData(energyApiResponse, [0, 1, 2, 3, 4]),
        [energyApiResponse]);

    // 2. Separate SOC Data
    const transformedSocData = useMemo(() =>
        transformApiData(socApiResponse, [5]),
        [socApiResponse]);

    // 3. Combined Data
    const transformedCombinedData = useMemo(() => {
        if (!energyApiResponse || !socApiResponse) return null;

        // Combine the series from both responses
        const combinedSeriesResponse: HistoricalDataGroupedResponse = {
            series: [
                ...energyApiResponse.series,
                ...socApiResponse.series
            ]
        };
        // Use the existing transformer. Pass color indices for all series.
        return transformApiData(combinedSeriesResponse, [0, 1, 2, 3, 4, 5]);
    }, [energyApiResponse, socApiResponse]);

    // Get the name of the SOC series to map it to the correct Y-axis
    const socSeriesName = useMemo(() => socApiResponse?.series[0]?.name, [socApiResponse]);
    // --- END Data Transformation ---


    // X-Axis Ticks for 1D View (no change)
    const hourlyTicks = useMemo(() => {
        if (interval === 'hourly') {
            return getHourlyTicks(startDate.getTime(), endDate.getTime());
        }
        return undefined;
    }, [interval, startDate, endDate]);

    // Combined Loading/Error State (no change)
    const isLoading = isLoadingEnergy || isLoadingSoc;
    const error = energyError || socError;

    // --- Helper for No Data ---
    const noDataComponent = (
        <Flex justify="center" align="center" h="100%">
            <Text color="gray.500">No data available for the selected period.</Text>
        </Flex>
    );

    // Render Component
    return (
        <GridItem area="chart" gridColumn={{ lg: "span 2" }} bg="white" shadow="sm" rounded="lg" p={4} borderWidth="1px"
            minH={{ base: "400px", md: "700px" }}
            maxH="800px"
            display="flex"
            flexDirection="column"
        >
            {/* 1. Controls Section (UPDATED with Switch) */}
            <Flex justify="space-between" align="center" mb={4} wrap="wrap" gap={2}>
                <ButtonGroup size="sm" variant="outline">
                    <Button onClick={() => handleTimeRangeChange('1D')} data-active={timeRange === '1D'}>Day</Button>
                    <Button onClick={() => handleTimeRangeChange('1W')} data-active={timeRange === '1W'}>Week</Button>
                    <Button onClick={() => handleTimeRangeChange('1M')} data-active={timeRange === '1M'}>Month</Button>
                    <Button onClick={() => handleTimeRangeChange('1Y')} data-active={timeRange === '1Y'}>Year</Button>
                    <Button onClick={() => handleTimeRangeChange('All')} data-active={timeRange === 'All'}>Lifetime</Button>
                </ButtonGroup>

                {/* --- NEW: SOC Combined Switch --- */}
                <HStack gap={2} ml={4}>
                    <Text fontSize="sm" fontWeight="medium">SOC Combined Display</Text>
                    {/* Use the composite component structure */}
                    <Switch.Root
                        colorScheme="teal"
                        checked={isSocCombined}
                        // The event 'e' directly has the 'checked' property
                        onCheckedChange={(e) => setIsSocCombined(e.checked)}
                    >
                        <Switch.HiddenInput />
                        <Switch.Control>
                            <Switch.Thumb />
                        </Switch.Control>
                    </Switch.Root>
                </HStack>
                {/* --- END NEW --- */}

                {timeRange !== 'All' && (
                    <HStack>
                        <IconButton aria-label="Previous" size="sm" variant="ghost" onClick={() => handleDateArrow('prev')}>
                            <FaChevronLeft />
                        </IconButton>
                        <Input
                            type="date" size="sm"
                            value={toLocalDateString(currentDate)}
                            onChange={(e) => handleDateChange(e.target.value)}
                            maxW="160px"
                            max={toLocalDateString(new Date())}
                        />
                        <IconButton aria-label="Next" size="sm" variant="ghost" onClick={() => handleDateArrow('next')} disabled={isToday}>
                            <FaChevronRight />
                        </IconButton>
                    </HStack>
                )}
            </Flex>

            {/* 2. Chart Box (UPDATED with conditional logic) */}
            <Box flex="1" h="0" minH="300px">
                {isLoading && (
                    <Flex justify="center" align="center" h="100%">
                        <Spinner size="xl" />
                    </Flex>
                )}
                {error && (
                    <Text color="red.500">Error loading chart data: {error.message}</Text>
                )}

                {/* --- Conditional Rendering Logic --- */}
                {!isLoading && !error && (
                    isSocCombined ? (
                        // --- RENDER 1: COMBINED CHART ---
                        transformedCombinedData ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                    data={transformedCombinedData.chartData}
                                    margin={{ top: 5, right: 0, left: -20, bottom: 5 }} // Adjusted right margin
                                >
                                    <defs>
                                        {transformedCombinedData.seriesInfo.map((series, index) => (
                                            <linearGradient key={index} id={`grad_comb_${index}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={series.color} stopOpacity={0.1} />
                                                <stop offset="95%" stopColor={series.color} stopOpacity={0} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <XAxis
                                        type="number"
                                        scale="time"
                                        dataKey="x"
                                        domain={[startDate.getTime(), endDate.getTime()]}
                                        allowDataOverflow={true}
                                        ticks={hourlyTicks}
                                        tickFormatter={
                                            interval === 'hourly' && hourlyTicks
                                                ? (tick, index) => formatHourlyTick(tick, index, hourlyTicks.length)
                                                : (timestamp) => new Date(timestamp).toLocaleDateString()
                                        }
                                    />
                                    {/* Two Y-Axes */}
                                    <YAxis yAxisId="left" unit=" kWh" />
                                    <YAxis yAxisId="right" orientation="right" unit=" %" domain={[0, 100]} />

                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <Tooltip
                                        formatter={(value: number, name: string) => {
                                            const unit = name === socSeriesName ? ' %' : ' kWh';
                                            const precision = name === socSeriesName ? 1 : 2;
                                            return [`${value.toFixed(precision)}${unit}`, name];
                                        }}
                                        labelFormatter={(label: number) => new Date(label).toLocaleString()}
                                    />
                                    <Legend />
                                    {transformedCombinedData.seriesInfo.map((series, index) => (
                                        <Area
                                            key={series.name}
                                            yAxisId={series.name === socSeriesName ? "right" : "left"} // Map to correct axis
                                            type="monotone"
                                            dataKey={series.name}
                                            stroke={series.color}
                                            fill={`url(#grad_comb_${index})`}
                                            fillOpacity={1}
                                            strokeWidth={2}
                                            connectNulls={true}
                                        />
                                    ))}
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            noDataComponent // No data for combined
                        )
                    ) : (
                        // --- RENDER 2: SEPARATE CHARTS ---
                        (transformedEnergyData && transformedSocData) ? (
                            <>
                                {/* Chart 1: Energy */}
                                {/* <Text fontSize="md" fontWeight="bold" textAlign="left">Electricity Trend</Text> */}
                                <ResponsiveContainer width="100%" height="60%">
                                    <AreaChart
                                        data={transformedEnergyData.chartData}
                                        syncId="chartSync"
                                        // margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
                                        margin={{ top: 30, right: 20, left: 0, bottom: 5 }}
                                    >
                                        <defs>
                                            {transformedEnergyData.seriesInfo.map((series, index) => (
                                                <linearGradient key={index} id={`grad_energy_${index}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={series.color} stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor={series.color} stopOpacity={0} />
                                                </linearGradient>
                                            ))}
                                        </defs>
                                        <XAxis
                                            type="number"
                                            scale="time"
                                            dataKey="x"
                                            domain={[startDate.getTime(), endDate.getTime()]}
                                            allowDataOverflow={true}
                                            ticks={hourlyTicks}
                                            tickFormatter={() => ''}
                                        />
                                        <YAxis
                                            label={{
                                                value: 'kWh',
                                                position: 'top',
                                                offset: 10,
                                                // dy: -10, // Adjust vertical position
                                                // dx: 20   // Adjust horizontal position
                                            }}
                                        />
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <Tooltip
                                            formatter={(value: number, name: string) => [`${value.toFixed(2)} kWh`, name]}
                                            labelFormatter={(label: number) => new Date(label).toLocaleString()}
                                        />
                                        <Legend />
                                        {transformedEnergyData.seriesInfo.map((series, index) => (
                                            <Area
                                                key={series.name}
                                                type="monotone"
                                                dataKey={series.name}
                                                stroke={series.color}
                                                fill={`url(#grad_energy_${index})`}
                                                fillOpacity={1}
                                                strokeWidth={2}
                                                connectNulls={true}
                                            />
                                        ))}
                                    </AreaChart>
                                </ResponsiveContainer>

                                {/* Chart 2: SOC */}
                                {/* <Text fontSize="md" fontWeight="bold" textAlign="left" mt={4}>Battery SOC</Text> */}
                                <ResponsiveContainer width="100%" height="30%">
                                    <AreaChart
                                        data={transformedSocData.chartData}
                                        syncId="chartSync"
                                        margin={{ top: 30, right: 20, left: 0, bottom: 5 }}
                                    >
                                        <defs>
                                            {transformedSocData.seriesInfo.map((series, index) => (
                                                <linearGradient key={index} id={`grad_soc_${index}`} x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={series.color} stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor={series.color} stopOpacity={0} />
                                                </linearGradient>
                                            ))}
                                        </defs>
                                        <XAxis
                                            type="number"
                                            scale="time"
                                            dataKey="x"
                                            domain={[startDate.getTime(), endDate.getTime()]}
                                            allowDataOverflow={true}
                                            ticks={hourlyTicks}
                                            tickFormatter={
                                                interval === 'hourly' && hourlyTicks
                                                    ? (tick, index) => formatHourlyTick(tick, index, hourlyTicks.length)
                                                    : (timestamp) => new Date(timestamp).toLocaleDateString()
                                            }
                                        />
                                        <YAxis

                                            domain={[0, 100]}
                                            label={{
                                                value: '%',
                                                position: 'top',
                                                offset: 10,
                                            }}
                                        />
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <Tooltip
                                            formatter={(value: number, name: string) => [`${value.toFixed(1)} %`, name]}
                                            labelFormatter={(label: number) => new Date(label).toLocaleString()}
                                        />
                                        <Legend />
                                        {transformedSocData.seriesInfo.map((series, index) => (
                                            <Area
                                                key={series.name}
                                                type="monotone"
                                                dataKey={series.name}
                                                stroke={series.color}
                                                fill={`url(#grad_soc_${index})`}
                                                fillOpacity={1}
                                                strokeWidth={2}
                                                connectNulls={true}
                                            />
                                        ))}
                                    </AreaChart>
                                </ResponsiveContainer>
                            </>
                        ) : (
                            noDataComponent // No data for separate
                        )
                    )
                )}
            </Box>
        </GridItem >
    );
};

export default EnergyTrendChart;