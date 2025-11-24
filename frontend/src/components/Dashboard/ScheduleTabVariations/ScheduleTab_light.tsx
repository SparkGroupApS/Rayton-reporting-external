// src/components/Dashboard/ScheduleTabVariations/ScheduleTab_light.tsx
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
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";
import ScheduleChart from "../ScheduleChart";
import ScheduleControlTableLight from "../ScheduleControlTable_light";

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

const ScheduleTabLight = ({ tenantId }: ScheduleTabProps) => {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient();

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

  const handleRefresh = () => {
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
        </HStack>
        <HStack gap={2}>
          <ButtonGroup variant="solid" size="sm">
            <Button
              onClick={() => handleDateChange(toLocalDateString(new Date(Date.now() - 864000)))}
            >
              Вчора
            </Button>
            <Button
              onClick={() => handleDateChange(toLocalDateString(new Date()))}
            >
              Сьогодні
            </Button>
            <Button
              onClick={() => handleDateChange(toLocalDateString(new Date(Date.now() + 864000)))}
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
            <ScheduleControlTableLight
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

export default ScheduleTabLight
