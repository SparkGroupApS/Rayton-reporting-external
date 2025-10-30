// src/components/Dashboard/StatCard.tsx
import { Box, Flex, Heading, Text } from "@chakra-ui/react" // Import necessary Chakra components
import type React from "react" // Import React

// Define props for the component
interface StatCardProps {
  title: string
  value: string | number
  unit?: string
  Icon: React.ElementType // Type for icon component
}

const StatCard = ({ title, value, unit, Icon }: StatCardProps) => {
  return (
    <Flex
      alignItems="center"
      p={4}
      bg="white"
      rounded="lg"
      shadow="sm"
      borderWidth="1px"
      h="full"
    >
      <Icon as={Icon} boxSize={{ base: 7, sm: 8 }} color="teal.500" mr={4} />
      <Box>
        <Heading size="md">
          {value}{" "}
          {unit && (
            <Text as="span" fontSize="sm" color="gray.500">
              {unit}
            </Text>
          )}
        </Heading>
        <Text fontSize="sm" color="gray.600">
          {title}
        </Text>
      </Box>
    </Flex>
  )
}

// Add default export
export default StatCard
