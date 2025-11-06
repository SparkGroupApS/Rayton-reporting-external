// src/components/Dashboard/ScheduleTab.tsx
import {
  Box,
 Heading,
  HStack,
  Input,
  Grid,
  GridItem,
 VStack,
} from "@chakra-ui/react"
import { useState } from "react"
import ScheduleControlTable from "./ScheduleControlTable" // Ensure this path is correct
import ScheduleChart from "./ScheduleChart"
import type { ScheduleRow } from "@/client";

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
  const [scheduleData, setScheduleData] = useState<ScheduleRow[] | undefined>(undefined);

  return (
    <Box bg="white" shadow="sm" rounded="lg" p={4} borderWidth="1px">
      <HStack justify="space-between" mb={2}>
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

      <Grid templateColumns="1fr 1fr" gap={2}>
        <GridItem>
          <VStack alignItems="stretch">
            <ScheduleControlTable
              tenantId={tenantId} // Pass the tenant UUID
              date={selectedDate}
              onScheduleDataChange={setScheduleData} // Pass callback to receive schedule data updates
            />
          </VStack>
        </GridItem>
        <GridItem>
          <VStack alignItems="stretch">
            <ScheduleChart
              tenantId={tenantId}
              date={selectedDate}
              scheduleData={scheduleData} // Pass the schedule data from the table to the chart
            />
          </VStack>
        </GridItem>
      </Grid>
    </Box>
  )
}

export default ScheduleTab
