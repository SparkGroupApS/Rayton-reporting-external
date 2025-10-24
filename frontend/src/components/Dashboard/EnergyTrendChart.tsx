// src/components/Dashboard/EnergyTrendChart.tsx
import React, { useMemo } from 'react';
import { Box, Spinner, Text, Flex } from '@chakra-ui/react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';

import useHistoricalData from '@/hooks/useHistoricalData'; // Adjust path
import type { EnergyDataResponse, EnergyDatapoint, ApiError } from '@/client'; // Adjust path

// Interface for component props
interface EnergyTrendChartProps {
    tenantId?: string | null;
    startDate: Date;
    endDate: Date;
    interval: 'hourly' | 'daily' | 'monthly';
    chartHeight?: string | number;
}

const EnergyTrendChart = ({
    tenantId,
    startDate,
    endDate,
    interval,
    chartHeight = '300px'
}: EnergyTrendChartProps) => {

    const { data: historicalData, isLoading, error } = useHistoricalData({
        start: '20251022 00:00:00', //startDate.toISOString(),
        end: '20251023 00:00:00', //endDate.toISOString(),
        interval: interval,
        tenantId: tenantId,
    }, {
        enabled: !!tenantId
    });

    // --- Prepare Highcharts Options based on chart.txt ---
    const chartOptions = useMemo((): Highcharts.Options | null => {
        if (!historicalData || !historicalData.data) {
            return null;
        }

        // --- Data Transformation ---
        // Assuming historicalData.data is [{ timestamp: string, value: number }]
        // Map fetched data to the 'Generation' series format [timestamp_ms, value]
        const generationData = historicalData.data.map((point: EnergyDatapoint) => [
            new Date(point.timestamp).getTime(),
            point.value
        ]);

        // Placeholder for consumption data - you'll need another data source or API response field
        const consumptionData: Array<[number, number]> = generationData.map(([ts, val]) => [ts, val * 0.8 + Math.random() * 10]); // Example: consumption = 80% of generation + noise

 // Resolve Colors to Definite Strings using type assertion
const generationColor: string = Highcharts.getOptions().colors?.[0] as string ?? '#7cb5ec';
const consumptionColor: string = Highcharts.getOptions().colors?.[1] as string ?? '#434348';

// Now, optionally, also assert the types for the end colors if needed, though get('rgba') should return a string
const generationColorEnd: string = Highcharts.color(generationColor).setOpacity(0).get('rgba') as string;
const consumptionColorEnd: string = Highcharts.color(consumptionColor).setOpacity(0).get('rgba') as string;

        // --- Highcharts Configuration from chart.txt ---
        const optionsTemplate: Highcharts.Options = {
            chart: {
                zoomType: 'x',
                height: chartHeight, // Use dynamic height
            },
            title: {
                text: `Electricity Generation and Consumption (${interval})`, // Dynamic title
                align: 'left'
            },
            subtitle: {
                // Keep the subtitle logic or remove if not needed
                text: 'Click and drag in the plot area to zoom in',
                align: 'left'
            },
            xAxis: {
                type: 'datetime',
                 dateTimeLabelFormats: { // Added formats for clarity
                    hour: '%H:%M', day: '%e. %b', week: '%e. %b', month: '%b \'%y', year: '%Y'
                },
            },
            yAxis: {
                title: {
                    text: 'Electricity (kWh)' // Adjust unit if needed
                }
            },
            legend: {
                enabled: true
            },
            plotOptions: {
                area: {
                    fillColor: {
                        linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                        // Use resolved colors
                        stops: [
                            [0, generationColor], // [0, Highcharts.getOptions().colors?.[0] || '#7cb5ec'], // <-- FIXED
                            [1, generationColorEnd] // Highcharts.color(Highcharts.getOptions().colors?.[0] || '#7cb5ec').setOpacity(0).get('rgba')]
                        ]
                    },
                    marker: { radius: 2 },
                    lineWidth: 1,
                    states: { hover: { lineWidth: 1 } },
                    threshold: null
                }
            },
            tooltip: { // Added basic tooltip formatting
                shared: true,
                crosshairs: true,
                xDateFormat: '%A, %b %e, %Y %H:%M',
                pointFormat: '<span style="color:{point.color}">\u25CF</span> {series.name}: <b>{point.y:.2f} kWh</b><br/>' // Adjust unit
            },
            series: [{
                type: 'area',
                name: 'Generation',
                data: generationData, // Use dynamically fetched data
                // Use a specific color or let Highcharts decide
                // color: generationColor // Optionally set explicit color
                 fillColor: { // Redefine fillColor for unique series color if needed
                    linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                    // Use resolved colors
                    stops: [
                        [0, generationColor], // [0, Highcharts.getOptions().colors?.[0] || '#7cb5ec'], // <-- FIXED
                        [1, generationColorEnd] // Highcharts.color(Highcharts.getOptions().colors?.[0] || '#7cb5ec').setOpacity(0).get('rgba')
                    ]
                 }
            }, {
                type: 'area',
                name: 'Consumption',
                data: consumptionData, // Use placeholder/fetched consumption data
                color: consumptionColor, // Use resolved color: Highcharts.getOptions().colors?.[1] || '#434348', // Use second color
                 fillColor: { // Define fillColor for the second series
                    linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
                    // Use resolved colors
                    stops: [
                        [0, consumptionColor], // [0, Highcharts.getOptions().colors?.[1] || '#434348'], // <-- FIXED
                        [1, consumptionColorEnd] // Highcharts.color(Highcharts.getOptions().colors?.[1] || '#434348').setOpacity(0).get('rgba')
                    ]
                 }
            }],
            credits: {
                enabled: false
            }
        };

        return optionsTemplate;

    }, [historicalData, interval, chartHeight]); // Dependencies for recalculation

    // --- Render Component ---
    if (isLoading) {
        return <Spinner />; // Or your specific loading component
    }

    if (error) {
        return <Text>Error loading chart: {(error as Error).message}</Text>; // Or your specific error component
    }

    if (!chartOptions) {
        return <Text>No data available for the chart.</Text>; // Or your specific no-data component
    }

    return (
        <Box>
            <HighchartsReact highcharts={Highcharts} options={chartOptions} />
        </Box>
    );
};

export default EnergyTrendChart;