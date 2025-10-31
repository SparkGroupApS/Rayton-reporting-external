// src/components/Dashboard/ScheduleTab.tsx
import {
  Box,
  Heading,
  HStack,
  Input,
} from "@chakra-ui/react"
import { useState } from "react"
import ScheduleControlTable from "./ScheduleControlTable" // Ensure this path is correct

// --- Helper function to format date ---
const toLocalDateString = (date: Date) => {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  return `${year}-${month}-${day}`
}

interface ScheduleTabProps {
  tenantId: string
}

const ScheduleTab = ({ tenantId }: ScheduleTabProps) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    toLocalDateString(new Date()),
  )

  return (
    <Box mt={6} bg="white" shadow="sm" rounded="lg" p={4} borderWidth="1px">
      <HStack justify="space-between" mb={4}>
        <Heading as="h2" size="lg">
          Schedule Control
        </Heading>
        <Input
          type="date"
          size="md"
          w="200px"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </HStack>

      <ScheduleControlTable
        tenantId={tenantId} // Pass the tenant UUID
        date={selectedDate}
      />
    </Box>
  )
}

export default ScheduleTab