// src/components/Dashboard/ChartSection.tsx
import React from 'react';
import {
    GridItem, Flex, Spinner, Text, Box // Keep necessary Chakra components
} from "@chakra-ui/react";
// --- Highcharts Imports ---
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
// --- End Highcharts Imports ---

// Import type for potential chart data later, ApiError maybe needed
import type { ApiError } from "@/client"; // Adjust path

// Define props - Adjust later to pass actual chart data
interface ChartSectionProps {
    // chartData?: YourChartDataType; // Example: Pass chart data here later
    isLoading: boolean;
    error?: Error | null | ApiError; // Allow ApiError type
}

// --- Placeholder Highcharts Options ---
// You'll replace this with options generated from your actual data
const placeholderChartOptions: Highcharts.Options = {
    chart: {
        type: 'spline', // Example chart type
         height: '250px' // Example height
    },
    title: {
        text: 'Chart Overview' // Example title
    },
     xAxis: {
        categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    },
    yAxis: {
        title: {
            text: 'Values'
        }
    },
    series: [{
        type: 'spline', // Match chart type
        name: 'Example Chart 1',
        data: [1, 0, 4, 6, 3, 5]
    }, {
        type: 'spline',
        name: 'Example Chart 2',
        data: [5, 7, 3, 4, 6, 2]
    }],
     credits: {
        enabled: false // Hide Highcharts.com credits
    }
};
// --- End Placeholder Options ---

const ChartSection = ({ isLoading, error }: ChartSectionProps) => {
    return (
        // Keep GridItem for layout consistency
        <GridItem area="chart" bg="white" shadow="sm" rounded="lg" p={4} borderWidth="1px">
            {/* Remove or adjust heading as needed */}
            {/* <Heading size="md" color="gray.700" mb={4}>Overview</Heading> */}
            {isLoading ? (
                <Flex justify="center" align="center" h="250px"> {/* Add Flex for centering spinner */}
                    <Spinner />
                </Flex>
            ) : error ? (
                <Text color="red.500">Error loading chart data: {error.message}</Text>
            ) : (
                // --- Render HighchartsReact component ---
                <Box> {/* Optional: Add Box for additional styling */}
                    <HighchartsReact
                        highcharts={Highcharts}
                        options={placeholderChartOptions} // Use placeholder options for now
                    />
                </Box>
                // --- End Render ---
            )}
        </GridItem>
    );
};

export default ChartSection;