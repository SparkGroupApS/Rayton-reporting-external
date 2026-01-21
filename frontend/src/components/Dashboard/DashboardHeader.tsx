// src/components/Dashboard/DashboardHeader.tsx

import { Box, Flex, Heading, Text } from "@chakra-ui/react"
import type { UserPublic } from "@/client"

interface DashboardHeaderProps {
  currentUser: UserPublic | null | undefined
  plantName?: string | null
}

const DashboardHeader = ({ currentUser, plantName }: DashboardHeaderProps) => {
  if (!currentUser) {
    return null
  }

  return (
    <Flex justify="space-between" align="center" mb={6}>
      <Box>
        <Heading size="lg" color="rayton_orange.600">
          ☀️ Dashboard
          {plantName && (
            <Text as="span" fontSize="md" color="gray.600" ml={2}>
              - {plantName}
            </Text>
          )}
        </Heading>
        <Text fontSize="md" color="gray.600">
          Welcome back, {currentUser?.full_name || currentUser?.email}!
        </Text>
      </Box>
    </Flex>
  )
}

export default DashboardHeader
