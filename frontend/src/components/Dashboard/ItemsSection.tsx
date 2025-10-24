// src/components/Dashboard/ItemsSection.tsx
import React from 'react';
import { Box, GridItem, Heading, Spinner, Text } from "@chakra-ui/react";
import LatestItemsTable from './latestItemsTable';
import type { ItemPublic } from "@/client"; // Import necessary types

// Define props expected by this section
interface ItemsSectionProps {
    items?: ItemPublic[];
    isLoading: boolean;
    error?: Error | null; // Allow passing the error object
}

const ItemsSection = ({ items, isLoading, error }: ItemsSectionProps) => {
    return (
        <GridItem area="items" bg="white" shadow="sm" rounded="lg" p={4} borderWidth="1px">
            <Heading size="md" color="gray.700" mb={4}>🌍 Recent Items</Heading>
            {/* Pass loading state and items data down to the table */}
            {error ? (
                <Text color="red.500">Error loading items: {error.message}</Text>
            ) : (
                // Let LatestItemsTable handle its own loading/empty state display
                <LatestItemsTable items={items} isLoading={isLoading} />
            )}
        </GridItem>
    );
};

export default ItemsSection;