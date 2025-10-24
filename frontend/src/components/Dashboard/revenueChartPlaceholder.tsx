// src/components/Dashboard/RevenueChartPlaceholder.tsx
import { Box, Text } from "@chakra-ui/react";
import React from 'react'; // Import React if not already implicitly available

const RevenueChartPlaceholder = () => (
    <Box h="full" display="flex" alignItems="center" justifyContent="center" bg="gray.50" borderRadius="md" p={4}>
        <Text color="gray.400">Revenue Chart Placeholder</Text>
    </Box>
);

// Add default export
export default RevenueChartPlaceholder;