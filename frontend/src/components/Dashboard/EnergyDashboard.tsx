// src/components/Dashboard/EnergyDashboard.tsx
import React, { useMemo, useState } from 'react'; // Import useState
import {
    Box, Spinner, Text, Flex, GridItem,
    // --- Add imports for controls ---
    Heading, Button, ButtonGroup, IconButton, Input, HStack
} from '@chakra-ui/react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

import useHistoricalData from '@/hooks/useHistoricalData'; // Adjust path
import type {
    HistoricalDataGroupedResponse,
    TimeSeriesData,
    ApiError
} from '@/client'; // Adjust path


// Interface for component props
interface EnergyDashboardProps {
    tenantId?: string | null;
    plantId: number | null;
    dataIds: number[];
    // Remove startDate, endDate, interval from props
    // chartHeight is now handled internally by GridItem
}

// --- Time Range Definitions (copied from index.tsx) ---
type TimeRange = '1D' | '1W' | '1M' | '1Y' | 'All';
const timeRangeConfig: { [key in TimeRange]: {
    interval: 'hourly' | 'daily' | 'monthly',
    getStart: (date: Date) => Date
} } = {
    '1D': { interval: 'hourly', getStart: (date) => date },
    '1W': { interval: 'daily', getStart: (date) => { const d = new Date(date); d.setDate(date.getDate() - 7); return d; } },
    '1M': { interval: 'daily', getStart: (date) => { const d = new Date(date); d.setMonth(date.getMonth() - 1); return d; } },
    '1Y': { interval: 'monthly', getStart: (date) => { const d = new Date(date); d.setFullYear(date.getFullYear() - 1); return d; } },
    'All': { interval: 'monthly', getStart: () => new Date(2000, 0, 1) } // "Lifetime"
};
// --- End Time Range ---

// Formats a Date object to a YYYY-MM-DD string in its *local* timezone
const toLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};
/**
 * Formats a Date object to a local ISO string (YYYY-MM-DDTHH:mm:ss)
 * without converting to UTC.
 */
const toLocalISOString = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    // Returns format like "2025-10-14T00:00:00"
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

const EnergyDashboard = ({
    tenantId,
    plantId,
    dataIds
}: EnergyDashboardProps) => {

    const [currentDate, setCurrentDate] = useState(new Date()); // The *end* date
    const [timeRange, setTimeRange] = useState<TimeRange>('1D'); // Default to '1D'
    const chartHeight = '300px';

    // --- Calculate Chart Dates/Interval (moved from index.tsx) ---
    const { startDate, endDate, interval } = useMemo(() => {
        const config = timeRangeConfig[timeRange];
        const start = config.getStart(currentDate);
        start.setHours(0, 0, 0, 0); // Start at 00:00:00

        const end = new Date(currentDate);

        // --- FIX FOR 24:00 TICK ---
        if (config.interval === 'hourly') {
            // If 'Day' view, set end to 00:00:00 of the *next* day
            end.setDate(end.getDate() + 1);
            end.setHours(0, 0, 0, 0);
        } else {
            // For other views, end of the current day is fine
            end.setHours(23, 59, 59, 999);
        }
        // --- END FIX ---
        return { startDate: start, endDate: end, interval: config.interval };
    }, [currentDate, timeRange]);
    // --- End Calculation ---

    const { data: apiResponse, isLoading, error } = useHistoricalData({
        plant_id: plantId,
        data_ids: dataIds,
        start: toLocalISOString(startDate), // Use local ISO string
        end: toLocalISOString(endDate),     // Use local ISO string
        // tenant_id_override: tenantId, // Uncomment if superusers should override
    }, {
        enabled: !!tenantId && !!plantId && dataIds.length > 0
    });

    // --- Handlers for Date Controls (moved from index.tsx) ---
    const handleTimeRangeChange = (newRange: TimeRange) => {
        setTimeRange(newRange);
        // setCurrentDate(new Date()); // Optional: reset date on range change
    };

    const handleDateChange = (dateString: string) => {
        const [year, month, day] = dateString.split('-').map(Number);
        if (year && month && day) {
            // This correctly creates a date at midnight local time
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
    // --- End Handlers ---

    // Prepare Highcharts Options
    const chartOptions = useMemo((): Highcharts.Options | null => {
        if (!apiResponse || !apiResponse.series || apiResponse.series.length === 0) {
            return null;
        }

        // Map API series directly to Highcharts series
        const highchartsSeries = apiResponse.series.map((seriesData: TimeSeriesData, index: number) => {
            const baseColor = Highcharts.getOptions().colors?.[index] || '#7cb5ec';
            const stopColorString = baseColor as Highcharts.ColorString;
            const stopColorStringTransp = Highcharts.color(stopColorString)
                .setOpacity(0.1)
                .get('rgba') as string; // This returns 'rgba(124,181,236,0)'
            const transparentColor = Highcharts.color(stopColorString).setOpacity(0).get('rgba') as string;

            const gradientStops: Highcharts.GradientColorStopObject[] = [
                [0, stopColorStringTransp],
                [1, transparentColor]
            ];

            return {
                type: 'areaspline' as const,
                name: seriesData.name,
                data: seriesData.data.map(point => [point.x, point.y]),
                color: baseColor,
                fillColor: {
                    linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                    stops: gradientStops
                }
            };
        });

        // --- Define base xAxis options ---
        const xAxisOptions: Highcharts.XAxisOptions = {
            type: 'datetime',
            crosshair: true,
            gridLineWidth: 1,
            // You can add dateTimeLabelFormats here if you want
            dateTimeLabelFormats: {
                hour: '%H:%M'
            }
        };

        // --- APPLY 'Day' (hourly) specific scaling ---
        if (interval === 'hourly') {
            // Force the chart's x-axis to span the full selected day
            xAxisOptions.min = startDate.getTime(); // This is 00:00:00
            xAxisOptions.max = endDate.getTime();   // This is 23:59:59.999

            // Set grid lines/ticks every 3 hours
            xAxisOptions.tickInterval = 3 * 3600 * 1000; // 3 hours in milliseconds
            // Format labels to show 00:00 instead of the date for the last tick
            xAxisOptions.labels = {
                formatter: function () {
                    // @ts-ignore
                    if (this.isLast) {
                        return '24:00';
                    }
                    // @ts-ignore
                    if (this.isFirst) {
                        return '00:00';
                    }
                    // @ts-ignore
                    return Highcharts.dateFormat('%H:%M', this.value);
                }
            };
        }
        // --- End scaling ---

        Highcharts.setOptions({
            time: {
                timezone: 'Europe/Kyiv' // Set your desired timezone
            }
        });

        // Highcharts Configuration
        const optionsTemplate: Highcharts.Options = {
            chart: { height: '50%' }, // Use 100%
            title: { text: `Electricity Trend (${interval})`, align: 'left' },
            //subtitle: { text: 'Click and drag in the plot area to zoom in', align: 'left' },
            xAxis: xAxisOptions, // <-- Use the new options object
            yAxis: { title: { text: 'Electricity (kWh)' } },
            legend: { enabled: true },
            plotOptions: {
                areaspline: {
                    //marker: { radius: 3, symbol: 'circle' },
                    lineWidth: 2,
                    //states: { hover: { lineWidth: 3 } },
                    threshold: 0,
                    fillOpacity: 0.1
                }
            },
            tooltip: {
                shared: true,
                xDateFormat: '%A, %b %e, %Y %H:%M',
                pointFormat: '<span style="color:{point.color}">\u25CF</span> {series.name}: <b>{point.y:.2f} kWh</b><br/>'
            },
            series: highchartsSeries,
            credits: { enabled: false }
        };

        return optionsTemplate;

    }, [apiResponse, interval, startDate, endDate]); // Dependency

    // Render Component
    return (
        <GridItem area="chart" gridColumn={{ lg: "span 2" }} bg="white" shadow="sm" rounded="lg" p={4} borderWidth="1px"
            // Give the grid item a defined height so '100%' works
            minH={{ base: "400px", md: "500px" }}
            maxH="700px"
            display="flex" // Use flex to layout controls and chart
            flexDirection="column"
        >
            {/* 1. Controls Section */}
            <Flex justify="space-between" align="center" mb={4} wrap="wrap" gap={2}>
                <ButtonGroup size="sm" variant="outline" attached >
                    <Button onClick={() => handleTimeRangeChange('1D')} data-active={timeRange === '1D'}>Day</Button>
                    <Button onClick={() => handleTimeRangeChange('1W')} data-active={timeRange === '1W'}>Week</Button>
                    <Button onClick={() => handleTimeRangeChange('1M')} data-active={timeRange === '1M'}>Month</Button>
                    <Button onClick={() => handleTimeRangeChange('1Y')} data-active={timeRange === '1Y'}>Year</Button>
                    <Button onClick={() => handleTimeRangeChange('All')} data-active={timeRange === 'All'}>Lifetime</Button>
                </ButtonGroup>
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

            {/* 2. Chart Box (takes remaining space) */}
            <Box flex="1" h="0" minH="300px"> {/* Use flex='1' and h='0' to make Box fill remaining space */}
                {isLoading && (
                    <Flex justify="center" align="center" h="100%"> {/* 100% of the Box height */}
                        <Spinner size="xl" />
                    </Flex>
                )}
                {error && (
                    <Text color="red.500">Error loading chart data: {error.message}</Text>
                )}
                {!isLoading && !error && chartOptions && (
                    <HighchartsReact
                        highcharts={Highcharts}
                        options={chartOptions}
                        // Make Highcharts fill the <Box>
                        containerProps={{ style: { height: '100%' } }}
                    />
                )}
                {!isLoading && !error && !chartOptions && (
                    <Flex justify="center" align="center" h="100%"> {/* 100% of the Box height */}
                        <Text color="gray.500">No data available for the selected period.</Text>
                    </Flex>
                )}
            </Box>
        </GridItem >
    );
};

export default EnergyDashboard;