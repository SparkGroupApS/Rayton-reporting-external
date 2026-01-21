// src/components/Dashboard/ESSTabVariations/ESSTab_advanced.tsx
import {
    Box,
    Button,
    ButtonGroup,
    Grid,
    GridItem,
    Heading,
    HStack,
    Text,
    VStack
} from "@chakra-ui/react";
import { useState } from "react";
import ESS from "../ESS"; // Using the existing ESS component as base

interface ESSTabProps {
  tenantId: string;
}

const ESSTabAdvanced = ({ tenantId }: ESSTabProps) => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <Box bg="white" shadow="sm" rounded="lg" p={4} borderWidth="1px">
      <HStack justify="space-between" mb={4}>
        <Heading as="h2" size="lg">
          ESS Data (Advanced)
        </Heading>
        <ButtonGroup variant="outline" size="sm">
          <Button
            onClick={() => setActiveTab('overview')}
            colorScheme={activeTab === 'overview' ? 'blue' : 'gray'}
          >
            Overview
          </Button>
          <Button
            onClick={() => setActiveTab('detailed')}
            colorScheme={activeTab === 'detailed' ? 'blue' : 'gray'}
          >
            Detailed
          </Button>
          <Button
            onClick={() => setActiveTab('predictions')}
            colorScheme={activeTab === 'predictions' ? 'blue' : 'gray'}
          >
            Predictions
          </Button>
        </ButtonGroup>
      </HStack>

      <Grid templateColumns="repeat(4, 1fr)" gap={4} mb={6}>
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
        <GridItem p={4} bg="gray.50" rounded="md">
          <Text fontSize="sm" color="gray.600" mb={1}>Capacity</Text>
          <Text fontSize="xl" fontWeight="bold">400 Ah</Text>
          <Text fontSize="xs" color="gray.500">Total Capacity</Text>
        </GridItem>
        <GridItem p={4} bg="gray.50" rounded="md">
          <Text fontSize="sm" color="gray.600" mb={1}>Health</Text>
          <Text fontSize="xl" fontWeight="bold">95%</Text>
          <Text fontSize="xs" color="gray.500">Battery Health</Text>
        </GridItem>
      </Grid>

      <VStack alignItems="stretch" mb={4}>
        <Text fontSize="md" fontWeight="bold">Advanced ESS Information</Text>
        <Text fontSize="sm" color="gray.600">
          This view shows comprehensive ESS metrics with advanced features and controls.
        </Text>
      </VStack>

      {/* Using the existing ESS component as the main content */}
      <Box mt={4}>
        <ESS tenantId={tenantId} />
      </Box>
    </Box>
  );
};

export default ESSTabAdvanced;
