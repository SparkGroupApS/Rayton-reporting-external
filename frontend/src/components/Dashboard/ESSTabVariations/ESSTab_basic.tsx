// src/components/Dashboard/ESSTabVariations/ESSTab_basic.tsx
import {
  Box,
  Grid,
  GridItem,
  Heading,
  Text,
  VStack
} from "@chakra-ui/react";

interface ESSTabProps {
  tenantId: string;
}

const ESSTabBasic = ({ tenantId }: ESSTabProps) => {
  return (
    <Box bg="white" shadow="sm" rounded="lg" p={4} borderWidth="1px">
      <Heading as="h2" size="lg" mb={4}>
        ESS Data (Basic)
      </Heading>

      <Grid templateColumns="repeat(2, 1fr)" gap={6} mb={6}>
        <GridItem p={4} bg="gray.50" rounded="md">
          <Text fontSize="sm" color="gray.600" mb={1}>SOC</Text>
          <Text fontSize="xl" fontWeight="bold">85%</Text>
          <Text fontSize="xs" color="gray.500">Current State of Charge</Text>
        </GridItem>
        <GridItem p={4} bg="gray.50" rounded="md">
          <Text fontSize="sm" color="gray.600" mb={1}>Power</Text>
          <Text fontSize="xl" fontWeight="bold">12.5 kW</Text>
          <Text fontSize="xs" color="gray.500">Current Power Flow</Text>
        </GridItem>
      </Grid>

      <VStack alignItems="stretch" mb={4}>
        <Text fontSize="md" fontWeight="bold">Basic ESS Information</Text>
        <Text fontSize="sm" color="gray.600">
          This view shows essential ESS metrics in a simplified format.
        </Text>
      </VStack>

      {/* Using the existing ESS component as the main content */}
      <Box mt={4}>
        <Text fontSize="md" fontWeight="bold" mb={2}>ESS Device Data</Text>
        <Text fontSize="sm" color="gray.600">Detailed ESS information will be displayed here based on plant configuration.</Text>
      </Box>
    </Box>
  );
};

export default ESSTabBasic;
