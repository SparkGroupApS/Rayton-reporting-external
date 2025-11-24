// src/components/Dashboard/ScheduleTab.tsx
import type { ScheduleRow } from "@/client";
import { Button } from "@/components/ui/button";
import DatePicker from "@/components/ui/DatePicker";
import {
  Box,
  ButtonGroup,
  Grid,
  GridItem,
  Heading,
  HStack,
  VStack,
} from "@chakra-ui/react";
import { useQueryClient } from "@tanstack/react-query"; // <-- 2. Import useQueryClient
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FiRefreshCw } from "react-icons/fi"; // <-- 3. Import a refresh icon
import ScheduleChart from "../ScheduleChart";
import ScheduleControlTable from "../ScheduleControlTable";

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
  const queryClient = useQueryClient(); // <-- 4. Get query client instance

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

  // <-- 5. Add refresh handler
  const handleRefresh = () => {
    // Invalidate the query used by ScheduleControlTable
    // This assumes the query key is ['schedule', tenantId, selectedDate]
    // which is a standard pattern.
    queryClient.invalidateQueries({
      queryKey: ["schedule", { tenantId: tenantId, date: selectedDate }],
    });
  }

  return (
    <Box bg="white" shadow="sm" rounded="lg" p={4} borderWidth="1px">
      <HStack justify="space-between" mb={2}>
       <HStack gap="2">
          <Heading as="h2" size="lg">
            Керування розкладом
          </Heading>
          <Button size="sm"
              onClick={() => handleRefresh()}
            >
              <FiRefreshCw /> Оновити
            </Button>

          {/* <IconButton
            icon={<FiRefreshCw />}
            aria-label="Refresh Data"
            onClick={handleRefresh}
            size="sm"
            variant="ghost"
          /> */}
        </HStack>
        <HStack gap={2}>
          <ButtonGroup variant="solid" size="sm">
            <Button
              onClick={() => handleDateChange(toLocalDateString(new Date(Date.now() - 86400000)))}
            >
              Вчора
            </Button>
            <Button
              onClick={() => handleDateChange(toLocalDateString(new Date()))}
            >
              Сьогодні
            </Button>
            <Button
              onClick={() => handleDateChange(toLocalDateString(new Date(Date.now() + 86400000)))}
            >
              Завтра
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
