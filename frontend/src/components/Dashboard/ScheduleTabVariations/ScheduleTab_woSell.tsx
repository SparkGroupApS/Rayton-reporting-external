// src/components/Dashboard/ScheduleTab_woSell_woSell_woSell.tsx
import type { ScheduleRow } from "@/client";
import { Button } from "@/components/ui/button";
import DatePicker from "@/components/ui/DatePicker";
import {
  Box,
  ButtonGroup,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  IconButton,
  VStack,
} from "@chakra-ui/react";
import { useQueryClient } from "@tanstack/react-query"; // <-- 2. Import useQueryClient
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FiRefreshCw } from "react-icons/fi"; // <-- 3. Import a refresh icon
import ScheduleChart from "../ScheduleChart";
import ScheduleControlTable_woSell from "../ScheduleControlTable_woSell";

// --- Helper function to format date ---
const toLocalDateString = (date: Date) => {
  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  return `${year}-${month}-${day}`
}

interface ScheduleTab_woSellProps {
  tenantId: string
}

const ScheduleTab_woSell = ({ tenantId }: ScheduleTab_woSellProps) => {
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
    <Box
      bg="white"
      shadow="sm"
      rounded="lg"
      p={{ base: 2, md: 4 }}
      borderWidth="1px"
      // Ensure the main container doesn't overflow
      maxW="100%"
      overflow="hidden"
    >
      {/* Header Section */}
      <Flex
        direction={{ base: "column", md: "row" }}
        justify="space-between"
        align={{ base: "stretch", md: "center" }}
        mb={{ base: 3, md: 2 }}
        gap={{ base: 3, md: 0 }}
      >
        {/* Title and Refresh Button */}
        <Flex gap={2} justify="space-between" align="center">
          <Heading as="h2" size={{ base: "md", md: "lg" }}>
            Керування розкладом
          </Heading>

          <IconButton
            aria-label="Refresh Data"
            onClick={handleRefresh}
            size="sm"
            variant="ghost"
            display={{ base: "flex", md: "none" }}
          >
            <FiRefreshCw />
          </IconButton>

          <Button
            size="sm"
            onClick={handleRefresh}
            display={{ base: "none", md: "flex" }}
          >
            <FiRefreshCw /> Оновити
          </Button>
        </Flex>
        {/* Date Controls - Changed to Flex with wrap to prevent overflow */}
        <Flex
          gap={2}
          justify={{ base: "flex-start", md: "flex-end" }}
          w={{ base: "100%", md: "auto" }}
          wrap="wrap"
        >
          <ButtonGroup variant="solid" size={{ base: "xs", md: "sm" }}>
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
          <Box flexShrink={0}>
             <DatePicker
                value={selectedDate}
                onChange={handleDateChange}
                size="sm"
              />
          </Box>
        </Flex>
      </Flex>

      {/* Main Content Grid */}
      <Grid
        templateColumns={{ base: "1fr", md: "1fr 1fr" }}
        gap={{ base: 3, md: 2 }}
      >
        {/* Table Section */}
        {/* minW="0" is critical in CSS Grid to allow children to scroll instead of expanding the grid item */}
        <GridItem minW="0">
          <VStack alignItems="stretch">
            {/* Added Box wrapper with overflowX="auto" */}
            <Box
              overflowX="auto"
              w="100%"
              css={{
                "&::-webkit-scrollbar": { height: "6px" },
                "&::-webkit-scrollbar-track": { background: "#f1f1f1" },
                "&::-webkit-scrollbar-thumb": { background: "#ccc", borderRadius: "3px" },
              }}
            >
              <ScheduleControlTable_woSell
                tenantId={tenantId}
                date={selectedDate}
                onScheduleDataChange={setScheduleData}
              />
            </Box>
          </VStack>
        </GridItem>

        {/* Chart Section */}
        <GridItem minW="0">
          <VStack alignItems="stretch">
             {/* Charts also often overflow, so we wrap them too */}
            <Box overflowX="auto" w="100%">
              <ScheduleChart
                tenantId={tenantId}
                date={selectedDate}
                scheduleData={scheduleData}
              />
            </Box>
          </VStack>
        </GridItem>
      </Grid>
    </Box>
  );
};

export default ScheduleTab_woSell
