// src/components/Dashboard/ScheduleTab.tsx
import {
  Box,
  ButtonGroup,
  Heading,
  HStack,
  Input,
  Grid,
  GridItem,
  VStack,
} from "@chakra-ui/react"
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "@tanstack/react-router"
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
  const location = useLocation()
  const navigate = useNavigate()
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // Get date from URL params or default to today
    const urlDate = (location.search as Record<string, any>).date as string | undefined
    return urlDate || toLocalDateString(new Date())
  })
  const [scheduleData, setScheduleData] = useState<ScheduleRow[] | undefined>(undefined);

   // Update URL when selectedDate changes
  useEffect(() => {
    const newParams = { ...location.search, date: selectedDate }
    navigate({ to: '.', search: newParams as any, replace: true })
  }, [selectedDate, navigate, location.search])

   // Initialize date in URL if not present on first load
  useEffect(() => {
    const searchObj = location.search as Record<string, any>;
    if (!searchObj.date) {
      const newParams = { ...searchObj, date: toLocalDateString(new Date()) }
      navigate({ to: '.', search: newParams as any, replace: true })
    }
  }, [])

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate)
  }

  return (
    <Box bg="white" shadow="sm" rounded="lg" p={4} borderWidth="1px">
      <HStack justify="space-between" mb={2}>
        <Heading as="h2" size="lg">
          Schedule Control
        </Heading>
        <ButtonGroup variant="solid" size="sm">
          <Button
            onClick={() => handleDateChange(toLocalDateString(new Date(Date.now() - 86400000)))}
          >
            Yesterday
          </Button>
          <Button
            onClick={() => handleDateChange(toLocalDateString(new Date()))}
          >
            Today
          </Button>
          <Button
            onClick={() => handleDateChange(toLocalDateString(new Date(Date.now() + 86400000)))}
          >
            Tomorrow
          </Button>
          <Input
            type="date"
            size="md"
            w="200px"
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
          />
         </ButtonGroup>
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
