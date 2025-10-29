// src/components/Dashboard/LatestItemsTable.tsx
import { Box, Table, Spinner, Text, Flex } from "@chakra-ui/react"; // Import necessary Chakra components
import React from 'react'; // Import React
import { ItemPublic } from "@/client"; // Import ItemPublic type (adjust path if needed)

// Define props for the component
interface LatestItemsTableProps {
    items?: ItemPublic[];
    isLoading: boolean;
}

const LatestItemsTable = ({ items, isLoading }: LatestItemsTableProps) => {
    // Show spinner if loading
    if (isLoading) {
        return (
            <Flex justify="center" align="center" h="100px"> {/* Added container for spinner */}
                <Spinner />
            </Flex>
        );
    }
    // Show message if no items
    if (!items || items.length === 0) {
        return <Text p={4}>No recent items found.</Text>; // Added padding
    }

    // Render the table
    return (
        <Box overflowX="auto">
           <Table.Root size="sm" minWidth="600px">
                <Table.Header>
                    <Table.Row>
                        <Table.ColumnHeader>Title</Table.ColumnHeader>
                        <Table.ColumnHeader>Description</Table.ColumnHeader>
                        <Table.ColumnHeader>Owner ID</Table.ColumnHeader>
                        <Table.ColumnHeader>Item ID</Table.ColumnHeader>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {items.map((item) => (
                        <Table.Row key={item.id}>
                            <Table.Cell fontWeight="medium">{item.title}</Table.Cell>
                            <Table.Cell color={!item.description ? "gray.500" : "inherit"} maxW="lg" truncate>
                                {item.description || "N/A"}
                            </Table.Cell>
                            <Table.Cell fontFamily="monospace" fontSize="xs">{item.owner_id}</Table.Cell>
                            <Table.Cell fontFamily="monospace" fontSize="xs">{item.id}</Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table.Root>
        </Box>
    );
};

// Add default export
export default LatestItemsTable;