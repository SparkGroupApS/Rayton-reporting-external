// src/components/Dashboard/LatestItemsTable.tsx
import { Box, Flex, Spinner, Table, Text } from "@chakra-ui/react" // Import necessary Chakra components
import type { ItemPublic } from "@/client" // Import ItemPublic type (adjust path if needed)

// Define props for the component
interface LatestItemsTableProps {
  items?: ItemPublic[]
  isLoading: boolean
}

const LatestItemsTable = ({ items, isLoading }: LatestItemsTableProps) => {
  // Show spinner if loading
  if (isLoading) {
    return (
      <Flex justify="center" align="center" h="100px">
        {" "}
        {/* Added container for spinner */}
        <Spinner />
      </Flex>
    )
  }
  // Show message if no items
  if (!items || items.length === 0) {
    return <Text p={4}>No recent items found.</Text> // Added padding
  }

  // Render the table
   return (
    <Box overflowX="auto" display={{ base: "block", lg: "table" }} width="100%">
      {/* Mobile Card View */}
      <Box display={{ base: "flex", lg: "none" }} flexDirection="column" gap={3} width="100%">
        {items.map((item) => (
          <Box key={item.id} borderWidth="1px" borderRadius="md" p={3} bg="gray.50">
            <Flex justifyContent="space-between" alignItems="center" mb={1}>
              <Text fontWeight="bold" fontSize="sm">{item.title}</Text>
              <Text fontSize="xs" fontFamily="monospace" color="gray.500">ID: {item.id}</Text>
            </Flex>
            <Text fontSize="sm" color={!item.description ? "gray.500" : "inherit"} mb={1}>
              {item.description || "N/A"}
            </Text>
            <Text fontSize="xs" fontFamily="monospace" color="gray.600">
              Owner: {item.owner_id}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Desktop Table View */}
      <Table.Root size={{ base: "sm", md: "sm" }} display={{ base: "none", lg: "table" }} width="100%">
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
              <Table.Cell fontWeight="medium" fontSize={{ base: "xs", md: "sm" }}>{item.title}</Table.Cell>
              <Table.Cell
                color={!item.description ? "gray.500" : "inherit"}
                maxW="lg"
                truncate
                fontSize={{ base: "xs", md: "sm" }}
              >
                {item.description || "N/A"}
              </Table.Cell>
              <Table.Cell fontFamily="monospace" fontSize={{ base: "xs", md: "xs" }}>
                {item.owner_id}
              </Table.Cell>
              <Table.Cell fontFamily="monospace" fontSize={{ base: "xs", md: "xs" }}>
                {item.id}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
    </Box>
  )
}

// Add default export
export default LatestItemsTable
