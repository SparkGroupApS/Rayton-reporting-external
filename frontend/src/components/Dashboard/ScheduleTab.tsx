// src/components/Dashboard/ScheduleTab.tsx
import {
  Box,
  ButtonGroup,
  Heading,
  HStack,
  Grid,
  GridItem,
  VStack,
} from "@chakra-ui/react"
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "@tanstack/react-router"
import DatePicker from "@/components/ui/DatePicker";
import ScheduleControlTable from "./ScheduleControlTable"
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
    const urlDate = (location.search as Record<string, any>).date as string | undefined
    
    // Validate URL date format (YYYY-MM-DD)
    if (urlDate && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
      return urlDate
    }
    
    return toLocalDateString(new Date())
  })
  
  const [scheduleData, setScheduleData] = useState<ScheduleRow[] | undefined>(undefined);

  // Sync URL with selectedDate
  useEffect(() => {
    const searchObj = location.search as Record<string, any>;
    const urlDate = searchObj.date;
    
    if (urlDate !== selectedDate) {
      const newParams = { ...searchObj, date: selectedDate }
      navigate({ to: '.', search: newParams as any, replace: true })
    }
  }, [selectedDate, navigate, location.search])

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate)
  }

  return (
    <Box bg="white" shadow="sm" rounded="lg" p={4} borderWidth="1px">
      <HStack justify="space-between" mb={2}>
        <Heading as="h2" size="lg">
          Schedule Control
        </Heading>
        <HStack gap={2}>
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
          </ButtonGroup>
          <DatePicker
            value={selectedDate}
            onChange={handleDateChange}
            size="sm"
          />
        </HStack>
      </HStack>

      <Grid templateColumns="1fr 1fr" gap={2}>
        <GridItem>
          <VStack alignItems="stretch">
            <ScheduleControlTable
              tenantId={tenantId}
              date={selectedDate}
              onScheduleDataChange={setScheduleData}
            />
          </VStack>
        </GridItem>
        <GridItem>
          <VStack alignItems="stretch">
            <ScheduleChart
              tenantId={tenantId}
              date={selectedDate}
              scheduleData={scheduleData}
            />
          </VStack>
        </GridItem>
      </Grid>
    </Box>
  )
}

export default ScheduleTab