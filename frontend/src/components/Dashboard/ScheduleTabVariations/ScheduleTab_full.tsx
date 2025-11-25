// src/components/Dashboard/ScheduleTabVariations/ScheduleTab_full.tsx
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
    Tabs,
    VStack
} from "@chakra-ui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FiBarChart2, FiRefreshCw, FiSettings } from "react-icons/fi";
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

const ScheduleTabFull = ({ tenantId }: ScheduleTabProps) => {
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
      <HStack justify="space-between" mb={4}>
        <HStack gap="2">
          <Heading as="h2" size="lg">
            Керування розкладом (Full)
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

      {/* Full version includes tabs for better organization */}
      <Tabs.Root colorScheme="blue" variant="enclosed">
        <Tabs.List>
          <Tabs.Trigger value="control" display="flex" alignItems="center" gap={2}>
            <FiSettings /> Control
          </Tabs.Trigger>
          <Tabs.Trigger value="chart" display="flex" alignItems="center" gap={2}>
            <FiBarChart2 /> Chart
          </Tabs.Trigger>
          <Tabs.Trigger value="advanced" display="flex" alignItems="center" gap={2}>
            <FiBarChart2 /> Advanced View
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="control">
          <Grid templateColumns="1fr" gap={4} mt={4}>
            <GridItem>
              <VStack alignItems="stretch">
                <ScheduleControlTable
                  tenantId={tenantId}
                  date={selectedDate}
                  onScheduleDataChange={setScheduleData}
                />
              </VStack>
            </GridItem>
          </Grid>
        </Tabs.Content>

        <Tabs.Content value="chart">
          <Grid templateColumns="1fr" gap={4} mt={4}>
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
        </Tabs.Content>

        <Tabs.Content value="advanced">
          <Grid templateColumns="1fr 1fr" gap={4} mt={4}>
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
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  )
}

export default ScheduleTabFull
