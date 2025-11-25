// src/components/Dashboard/EnergyTrendChart.tsx

import {
  Box,
  ButtonGroup,
  Flex,
  GridItem,
  HStack,
  IconButton,
  Input,
  Spinner,
  Switch,
  Text,
  Select,
  createListCollection,
} from '@chakra-ui/react';
import { useBreakpointValue } from '@chakra-ui/react';
import { Button } from '@/components/ui/button';
import { useMemo, useState, useRef } from 'react';
import ChartExportMenu from './ChartExportMenu';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { HistoricalDataGroupedResponse } from '@/client';
import useHistoricalData from '@/hooks/useHistoricalData';

interface EnergyTrendChartProps {
  tenantId: string | null;
  energyDataIds: number[];
  socDataId: number;
}

type TimeRange = '1D' | '1W' | '1M' | '1Y' | 'All';

// Preferred brand colors by stable text_id (if present)
const colorByTextId: Record<string, string> = {
  'txt-solar-power': '#facc15', // yellow
  'txt-grid-power': '#3b82f6', // blue
  'txt-plant-power': '#10b981', // green
  'txt-generator-power': '#f97316', // orange
  'txt-ess-power': '#8b5cf6', // violet
  'txt-ess-discharge': '#e11d48', // red
  'txt-ess-charge': '#0ea5e9', // sky blue
  'txt-generator-consumption': '#a855f7', // purple
};

// Fallback old english mapping, then we finally fall back to palette
const legacyColorByEnglish: Record<string, string> = {
  'GRID CONSUMPTION': '#3b82f6',
  'SOLAR GENERATION': '#facc15',
  'ESS CHARGE': '#0ea5e9',
  'ESS DISCHARGE': '#e11d48',
  'GENERATOR CONSMPTION': '#a855f7',
};

// Small palette if everything else fails
const smallFallbackPalette = [
  '#22c55e',
  '#64748b',
  '#fb923c',
  '#0ea5e9',
  '#8b5cf6',
];

// Nice HSL ramp palette that scales to N series
const hslToHex = (h: number, s: number, l: number) => {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) =>
    Math.round(255 * x)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
};
const makePalette = (n: number) =>
  Array.from({ length: n }, (_, i) =>
    hslToHex((i * 360) / Math.max(1, n), 70, 52)
  );
//more pastel
//const makePalette = (n: number) => Array.from({ length: n }, (_, i) => hslToHex((i * 360) / Math.max(1, n), 55, 70)); //If you want an even subtler look, you can tweak to s = 35, l = 78.

const toLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toLocalISOString = (date: Date) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

const getHourlyTicks = (start: number, end: number): number[] => {
  const ticks: number[] = [];
  let current = start;
  const threeHours = 3 * 60 * 60 * 1000;
  while (current <= end) {
    ticks.push(current);
    current += threeHours;
  }
  return ticks;
};

const formatHourlyTick = (
  timestamp: number,
  index: number,
  totalTicks: number
) => {
  if (index === 0) return '00:00';
  if (index === totalTicks - 1) return '24:00';
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

// Transform API response to chart format
const transformApiData = (
  apiResponse: HistoricalDataGroupedResponse | undefined,
  colorIndices: number[],
  timeRange?: TimeRange,
  useCurrentPeriod?: boolean,
  startDate?: Date,
  endDate?: Date
) => {
  if (!apiResponse || !apiResponse.series) {
    return null;
  }

  const dataMap: { [key: number]: { x: number; [key: string]: any } } = {};
  const seriesNames = apiResponse.series.map((s) => s.name);
  const palette = makePalette(seriesNames.length);
  const seriesInfo = apiResponse.series.map((s, i) => {
    const name = s.name;
    const english = name.toUpperCase();
    // Check for text_id in the name or use the name itself as a key
    const textIdKey = Object.keys(colorByTextId).find(
      (key) => name.toLowerCase().includes(key) || name.toLowerCase() === key
    );
    const color =
      (textIdKey && colorByTextId[textIdKey]) ||
      legacyColorByEnglish[english] ||
      palette[i] ||
      smallFallbackPalette[i % smallFallbackPalette.length];
    return {
      name: name,
      color: color,
    };
  });

  for (const series of apiResponse.series) {
    for (const point of series.data) {
      if (!dataMap[point.x]) {
        dataMap[point.x] = { x: point.x };
      }
      dataMap[point.x][series.name] = point.y;
    }
  }

  let chartData = Object.values(dataMap).sort((a, b) => a.x - b.x);

  // For "Current week" and "Last 7 days" views, ensure all 7 days are present in the data
  if (timeRange === '1W' && startDate && endDate) {
    const filledDataMap: { [key: number]: { x: number; [key: string]: any } } =
      { ...dataMap };

    // Generate all days for the 7-day period and fill missing ones with 0
    const periodStart = new Date(startDate);
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(periodStart);
      dayDate.setDate(periodStart.getDate() + i);
      dayDate.setHours(0, 0, 0, 0);
      const dayTimestamp = dayDate.getTime();

      if (!filledDataMap[dayTimestamp]) {
        filledDataMap[dayTimestamp] = { x: dayTimestamp };
        // Initialize all series with 0 for missing days
        for (const series of apiResponse.series) {
          filledDataMap[dayTimestamp][series.name] = 0;
        }
      }
    }

    chartData = Object.values(filledDataMap).sort((a, b) => a.x - b.x);
  }

  return { chartData, seriesInfo };
};

const EnergyTrendChart = ({
  tenantId,
  energyDataIds,
  socDataId,
}: EnergyTrendChartProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const chartRef = useRef<HTMLDivElement | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('1D');
  const [isSocCombined, setIsSocCombined] = useState(false);
  const [useCurrentPeriod, setUseCurrentPeriod] = useState(false);

  // Calculate date range and aggregation level based on time range
  // Time Range to Aggregation Mapping:
  // - Day view: hour (raw data points)
  // - Week/Month view: day (daily deltas)
  // - Year view: month (monthly deltas)
  // - Lifetime view: year (yearly deltas)
  const { startDate, endDate, aggregateBy } = useMemo(() => {
    let start: Date = new Date(currentDate);
    let end = new Date(currentDate);
    let aggregateBy: 'hour' | 'day' | 'month' | 'year' = 'hour';

    if (timeRange === '1D') {
      start = new Date(currentDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(currentDate);
      end.setDate(end.getDate() + 1);
      end.setHours(0, 0, 0, 0);
      aggregateBy = 'hour';
    } else if (timeRange === '1W' || timeRange === '1M') {
      aggregateBy = 'day';
      if (useCurrentPeriod && timeRange === '1W') {
        // Current week: Monday to Sunday (full week for X-axis), but data only up to current day
        start = new Date(currentDate);
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Get Monday
        start.setDate(diff);
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 7); // End on Sunday
        end.setHours(23, 59, 999);
      } else if (useCurrentPeriod && timeRange === '1M') {
        start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + 1,
          0
        );
        end.setHours(23, 59, 999);
      } else if (timeRange === '1W') {
        // Last 7 days: exactly 7 consecutive days counting backwards from current day (inclusive)
        // If today is Sunday, this will show Monday to Sunday (current week)
        start = new Date(currentDate);
        start.setDate(start.getDate() - 6); // 6 days back + today = 7 days total
        start.setHours(0, 0, 0, 0);
        end = new Date(currentDate);
        end.setHours(23, 59, 59, 999);
      } else {
        start = new Date(currentDate);
        start.setDate(start.getDate() - 29); // 29 days back + today = 30 days total
        start.setHours(0, 0, 0, 0);
        end = new Date(currentDate);
        end.setHours(23, 59, 999);
      }
    } else if (timeRange === '1Y') {
      aggregateBy = 'month';
      if (useCurrentPeriod) {
        start = new Date(currentDate.getFullYear(), 0, 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(currentDate.getFullYear(), 11, 31);
        end.setHours(23, 59, 999);
      } else {
        start = new Date(currentDate);
        start.setMonth(start.getMonth() - 11); // 11 months back + current month = 12 months total
        start.setHours(0, 0, 0, 0);
        end = new Date(currentDate);
        end.setHours(23, 59, 59, 999);
      }
    } else if (timeRange === 'All') {
      aggregateBy = 'year';
      start = new Date(2000, 0, 1);
      end = new Date();
      end.setHours(23, 59, 999);
    }

    return { startDate: start, endDate: end, aggregateBy };
  }, [currentDate, timeRange, useCurrentPeriod]);

  const {
    data: energyApiResponse,
    isLoading: isLoadingEnergy,
    error: energyError,
  } = useHistoricalData(
    {
      tenantId: tenantId,
      start: toLocalISOString(startDate),
      end: toLocalISOString(endDate),
      data_ids: energyDataIds,
      aggregate_by: aggregateBy,
    },
    {
      enabled: !!tenantId && energyDataIds.length > 0,
    }
  );

  const {
    data: socApiResponse,
    isLoading: isLoadingSoc,
    error: socError,
  } = useHistoricalData(
    {
      tenantId: tenantId,
      start: toLocalISOString(startDate),
      end: toLocalISOString(endDate),
      data_ids: [socDataId],
      aggregate_by: 'hour',
    },
    {
      enabled: !!tenantId && timeRange === '1D',
    }
  );

  const handleTimeRangeChange = (newRange: TimeRange) => {
    setTimeRange(newRange);
    setUseCurrentPeriod(false);
  };

  const handleDateChange = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    if (year && month && day) {
      setCurrentDate(new Date(year, month - 1, day));
    }
  };

  const handleDateArrow = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    const increment = direction === 'next' ? 1 : -1;
    if (timeRange === '1D') newDate.setDate(newDate.getDate() + increment);
    else if (timeRange === '1W')
      newDate.setDate(newDate.getDate() + 7 * increment);
    else if (timeRange === '1M')
      newDate.setMonth(newDate.getMonth() + increment);
    else if (timeRange === '1Y')
      newDate.setFullYear(newDate.getFullYear() + increment);
    setCurrentDate(newDate);
  };

  const isToday = currentDate.toDateString() === new Date().toDateString();

  // Backend returns deltas, just transform to chart format
  // Generate consistent colors for each series name across all chart states
  const allSeriesNames = useMemo(() => {
    const names = new Set<string>();
    energyApiResponse?.series?.forEach((s) => names.add(s.name));
    socApiResponse?.series?.forEach((s) => names.add(s.name));
    return Array.from(names);
  }, [energyApiResponse, socApiResponse]);

  const consistentColorMap = useMemo(() => {
    const palette = makePalette(allSeriesNames.length);
    const colorMap: Record<string, string> = {};
    allSeriesNames.forEach((name, i) => {
      const english = name.toUpperCase();
      // Check for text_id in the name or use the name itself as a key
      const textIdKey = Object.keys(colorByTextId).find(
        (key) => name.toLowerCase().includes(key) || name.toLowerCase() === key
      );
      const color =
        (textIdKey && colorByTextId[textIdKey]) ||
        legacyColorByEnglish[english] ||
        palette[i] ||
        smallFallbackPalette[i % smallFallbackPalette.length];
      colorMap[name] = color;
    });
    return colorMap;
  }, [allSeriesNames]);

  const transformedEnergyData = useMemo(() => {
    if (!energyApiResponse) return null;
    const dataMap: { [key: number]: { x: number; [key: string]: any } } = {};
    const seriesInfo = energyApiResponse.series.map((s, i) => ({
      name: s.name,
      color:
        consistentColorMap[s.name] ||
        makePalette(energyApiResponse.series.length)[i],
    }));

    for (const series of energyApiResponse.series) {
      for (const point of series.data) {
        if (!dataMap[point.x]) {
          dataMap[point.x] = { x: point.x };
        }
        dataMap[point.x][series.name] = point.y;
      }
    }

    let chartData = Object.values(dataMap).sort((a, b) => a.x - b.x);

    // For "Current week" and "Last 7 days" views, ensure all 7 days are present in the data
    if (timeRange === '1W' && startDate && endDate) {
      const filledDataMap: {
        [key: number]: { x: number; [key: string]: any };
      } = { ...dataMap };

      // Generate all days for the 7-day period and fill missing ones with 0
      const periodStart = new Date(startDate);
      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(periodStart);
        dayDate.setDate(periodStart.getDate() + i);
        dayDate.setHours(0, 0, 0, 0);
        const dayTimestamp = dayDate.getTime();

        if (!filledDataMap[dayTimestamp]) {
          filledDataMap[dayTimestamp] = { x: dayTimestamp };
          // Initialize all series with 0 for missing days
          for (const series of energyApiResponse.series) {
            filledDataMap[dayTimestamp][series.name] = 0;
          }
        }
      }

      chartData = Object.values(filledDataMap).sort((a, b) => a.x - b.x);
    }

    return { chartData, seriesInfo };
  }, [energyApiResponse, consistentColorMap, timeRange, startDate, endDate]);

  const transformedSocData = useMemo(() => {
    if (!socApiResponse) return null;
    const dataMap: { [key: number]: { x: number; [key: string]: any } } = {};
    const seriesInfo = socApiResponse.series.map((s, i) => ({
      name: s.name,
      color:
        consistentColorMap[s.name] ||
        makePalette(socApiResponse.series.length)[i],
    }));

    for (const series of socApiResponse.series) {
      for (const point of series.data) {
        if (!dataMap[point.x]) {
          dataMap[point.x] = { x: point.x };
        }
        dataMap[point.x][series.name] = point.y;
      }
    }

    const chartData = Object.values(dataMap).sort((a, b) => a.x - b.x);

    return { chartData, seriesInfo };
  }, [socApiResponse, consistentColorMap]);

  const transformedCombinedData = useMemo(() => {
    if (!energyApiResponse || !socApiResponse) return null;
    const combinedSeriesResponse: HistoricalDataGroupedResponse = {
      series: [...energyApiResponse.series, ...socApiResponse.series],
    };
    const dataMap: { [key: number]: { x: number; [key: string]: any } } = {};
    const seriesInfo = combinedSeriesResponse.series.map((s, i) => ({
      name: s.name,
      color:
        consistentColorMap[s.name] ||
        makePalette(combinedSeriesResponse.series.length)[i],
    }));

    for (const series of combinedSeriesResponse.series) {
      for (const point of series.data) {
        if (!dataMap[point.x]) {
          dataMap[point.x] = { x: point.x };
        }
        dataMap[point.x][series.name] = point.y;
      }
    }

    const chartData = Object.values(dataMap).sort((a, b) => a.x - b.x);

    return { chartData, seriesInfo };
  }, [energyApiResponse, socApiResponse, consistentColorMap]);

  const socSeriesName = useMemo(
    () => socApiResponse?.series[0]?.name,
    [socApiResponse]
  );

  const hourlyTicks = useMemo(() => {
    if (aggregateBy === 'hour') {
      return getHourlyTicks(startDate.getTime(), endDate.getTime());
    }
    return undefined;
  }, [aggregateBy, startDate, endDate]);

  // Generate week ticks for both "Last 7 days" and "Current week" views to show all 7 days
  const weekTicks = useMemo(() => {
    if (timeRange === '1W') {
      const ticks: number[] = [];
      const periodStart = new Date(startDate);
      for (let i = 0; i < 7; i++) {
        const tickDate = new Date(periodStart);
        tickDate.setDate(periodStart.getDate() + i);
        ticks.push(tickDate.getTime());
      }
      return ticks;
    }
    return undefined;
  }, [timeRange, startDate]);

  const isLoading = isLoadingEnergy || (timeRange === '1D' && isLoadingSoc);
  const error = energyError || (timeRange === '1D' && socError);

  const noDataComponent = (
    <Flex justify="center" align="center" h="100%">
      <Text color="gray.500">No data available for the selected period.</Text>
    </Flex>
  );

  // Format X-axis labels based on aggregation
  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);

    if (aggregateBy === 'hour') {
      return date.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    } else if (aggregateBy === 'day') {
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } else if (aggregateBy === 'month') {
      return date.toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
      });
    } else {
      return date.getFullYear().toString();
    }
  };

  // At the top of your component
  //const chartsMinHeight = useBreakpointValue({ base: "300px", md: "300px" }, { ssr: false });
  const energyChartHeight = useBreakpointValue(
    { base: '50%', md: '60%' },
    { ssr: false }
  ) as '50%' | '60%';
  const socChartHeight = useBreakpointValue(
    { base: '50%', md: '30%' },
    { ssr: false }
  ) as '50%' | '30%';

  const tooltipFontSize = useBreakpointValue(
    { base: 10, md: 12 },
    { ssr: false }
  );
  const tooltipPadding = useBreakpointValue(
    { base: 5, md: 10 },
    { ssr: false }
  );

  const chartMargins = useBreakpointValue(
    {
      base: { top: 20, right: 5, left: 0, bottom: 0 }, // Changed top from 0 to 20
      md: { top: 30, right: 20, left: 0, bottom: 5 }, // Changed top from 10 to 30
    },
    { ssr: false }
  );

  const barChartMargins = useBreakpointValue(
    {
      base: { top: 20, right: 10, left: 0, bottom: 0 }, // Changed top from 5 to 20, left from -15 to 0
      md: { top: 30, right: 30, left: 0, bottom: 0 }, // Changed top from 10 to 30
    },
    { ssr: false }
  );

  const yAxisWidth = useBreakpointValue({ base: 35, md: 60 }, { ssr: false });

  // Optional: Reduce offset on mobile for even tighter spacing
  const yAxisLabelOffset = useBreakpointValue(
    { base: 8, md: 10 },
    { ssr: false }
  );

  // Add this with your other breakpoint values at the top of the component
  const xAxisHeight = useBreakpointValue({ base: 15, md: 20 }, { ssr: false });

  // Define the time range collection for the Select component
  const timeRangeCollection = createListCollection({
    items: [
      { label: 'День', value: '1D' },
      { label: 'Тиждень', value: '1W' },
      { label: 'Місяць', value: '1M' },
      { label: 'Рік', value: '1Y' },
      { label: 'Всі', value: 'All' },
    ],
  });

  return (
    <GridItem
      ref={chartRef}
      area="chart"
      gridColumn={{ lg: 'span 3' }}
      bg="white"
      shadow="sm"
      rounded="lg"
      p={{ base: 2, md: 4 }} // Reduced from p={4}
      borderWidth="1px"
      minH={{ base: '400px', md: '700px' }}
      maxH="800px"
      display="flex"
      flexDirection="column"
      outline="none"
      _focus={{ outline: 'none', boxShadow: 'none' }}
      _focusVisible={{ outline: 'none', boxShadow: 'none' }}
      sm={{
        '& *:focus': {
          outline: 'none !important',
          boxShadow: 'none !important',
        },
        '& *:focus-visible': {
          outline: 'none !important',
          boxShadow: 'none !important',
        },
      }}
    >
      <Flex
        direction={{ base: 'column', md: 'row' }}
        justify="space-between"
        align="flex-start"
        mb={{ base: 2, md: 4 }} // Reduced from mb={4}
        wrap="wrap"
        gap={{ base: 1, md: 2 }} // Reduced gap on mobile
      >
        {/* Show Select on mobile, ButtonGroup on larger screens */}
        <Flex
          display={{ base: 'flex', md: 'none' }}
          mb={2}
          w="100%"
          gap={2}
          align="center"
        >
          <Select.Root
            collection={timeRangeCollection}
            size="sm"
            width="40%"
            value={[timeRange]}
            onValueChange={(e) =>
              handleTimeRangeChange(e.value[0] as TimeRange)
            }
          >
            <Select.HiddenSelect />
            <Select.Control>
              <Select.Trigger>
                <Select.ValueText placeholder="Select time range" />
              </Select.Trigger>
              <Select.IndicatorGroup>
                <Select.Indicator />
              </Select.IndicatorGroup>
            </Select.Control>
            <Select.Positioner>
              <Select.Content>
                {timeRangeCollection.items.map((item) => (
                  <Select.Item item={item} key={item.value}>
                    {item.label}
                    <Select.ItemIndicator />
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Positioner>
          </Select.Root>
          {timeRange !== 'All' && (
            <HStack width="60%" gap={0}>
              <IconButton
                aria-label="Previous"
                size="xs"
                variant="ghost"
                onClick={() => handleDateArrow('prev')}
                minW="auto"
                px={1}
              >
                <FaChevronLeft />
              </IconButton>
              <Input
                type="date"
                size="sm"
                value={toLocalDateString(currentDate)}
                onChange={(e) => handleDateChange(e.target.value)}
                flex="1"
                max={toLocalDateString(new Date())}
                fontSize="sm"
              />
              <IconButton
                aria-label="Next"
                size="xs"
                variant="ghost"
                onClick={() => handleDateArrow('next')}
                disabled={isToday}
                minW="auto"
                px={1}
              >
                <FaChevronRight />
              </IconButton>
            </HStack>
          )}
        </Flex>
        <ButtonGroup
          variant="solid"
          size={{ base: 'xs', md: 'sm' }}
          display={{ base: 'none', md: 'flex' }}
          mb={{ base: 2, md: 0 }}
        >
          <Button
            onClick={() => handleTimeRangeChange('1D')}
            data-active={timeRange === '1D' || undefined}
          >
            День
          </Button>
          <Button
            onClick={() => handleTimeRangeChange('1W')}
            data-active={timeRange === '1W' || undefined}
          >
            Тиждень
          </Button>
          <Button
            onClick={() => handleTimeRangeChange('1M')}
            data-active={timeRange === '1M' || undefined}
          >
            Місяць
          </Button>
          <Button
            onClick={() => handleTimeRangeChange('1Y')}
            data-active={timeRange === '1Y' || undefined}
          >
            Рік
          </Button>
          <Button
            onClick={() => handleTimeRangeChange('All')}
            data-active={timeRange === 'All' || undefined}
          >
            Всі
          </Button>
        </ButtonGroup>

        <Flex
          direction={{ base: 'column', md: 'row' }}
          align={{ base: 'flex-start', md: 'center' }}
          gap={2}
          ml={{ base: 0, md: 4 }}
          mb={{ base: 2, md: 0 }}
          w={{ base: '100%', md: 'auto' }}
        >
          {timeRange !== '1D' && timeRange !== 'All' && (
            <HStack gap={2}>
              <Text
                fontSize={{ base: 'xs', md: 'sm' }}
                fontWeight="medium"
                whiteSpace="nowrap"
              >
                {timeRange === '1W' &&
                  (useCurrentPeriod ? 'Current Week' : 'Last 7 Days')}
                {timeRange === '1M' &&
                  (useCurrentPeriod ? 'Current Month' : 'Last 30 Days')}
                {timeRange === '1Y' &&
                  (useCurrentPeriod ? 'Current Year' : 'Last 12 Months')}
              </Text>
              <Switch.Root
                colorScheme="rayton_orange"
                checked={useCurrentPeriod}
                onCheckedChange={(e) => setUseCurrentPeriod(e.checked)}
              >
                <Switch.HiddenInput />
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Root>
            </HStack>
          )}

          {timeRange === '1D' && (
            <HStack gap={2}>
              <Text
                fontSize={{ base: 'xs', md: 'sm' }}
                fontWeight="medium"
                whiteSpace="nowrap"
              >
                Комбінований дисплей SOC
              </Text>
              <Switch.Root
                colorScheme="rayton_orange"
                checked={isSocCombined}
                onCheckedChange={(e) => setIsSocCombined(e.checked)}
              >
                <Switch.HiddenInput />
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Root>
            </HStack>
          )}
        </Flex>

        <Flex
          direction={{ base: 'column', md: 'row' }}
          align={{ base: 'flex-start', md: 'center' }}
          gap={2}
          w={{ base: '100%', md: 'auto' }}
          display={{ base: 'none', md: 'flex' }}
        >
          {timeRange !== 'All' && (
            <HStack>
              <IconButton
                aria-label="Previous"
                size={{ base: 'xs', md: 'sm' }}
                variant="ghost"
                onClick={() => handleDateArrow('prev')}
              >
                <FaChevronLeft />
              </IconButton>
              <Input
                type="date"
                size={{ base: 'xs', md: 'sm' }}
                value={toLocalDateString(currentDate)}
                onChange={(e) => handleDateChange(e.target.value)}
                maxW={{ base: '120px', md: '160px' }}
                max={toLocalDateString(new Date())}
                fontSize={{ base: 'xs', md: 'sm' }}
              />
              <IconButton
                aria-label="Next"
                size={{ base: 'xs', md: 'sm' }}
                variant="ghost"
                onClick={() => handleDateArrow('next')}
                disabled={isToday}
              >
                <FaChevronRight />
              </IconButton>
            </HStack>
          )}

          <ChartExportMenu
            chartRef={chartRef}
            tenantId={tenantId || ''}
            dataIds={energyDataIds}
            startDate={startDate}
            endDate={endDate}
            fileName={`energy-trend-chart-${timeRange}-${toLocalDateString(currentDate)}`}
          />
        </Flex>
      </Flex>

      <Box flex="1" h="0" minH={{ base: '400px', md: '300px' }}>
        {isLoading && (
          <Flex justify="center" align="center" h="100%">
            <Spinner size="xl" />
          </Flex>
        )}
        {error && (
          <Text color="red.500">Error loading chart data: {error.message}</Text>
        )}

        {!isLoading && !error && (
          <>
            {/* Day View - Area Charts */}
            {timeRange === '1D' &&
              (transformedEnergyData &&
              (isSocCombined ? transformedCombinedData : transformedSocData) ? (
                <>
                  {isSocCombined ? (
                    <ResponsiveContainer
                      key="combined-chart"
                      width="100%"
                      height="100%"
                    >
                      <AreaChart
                        data={transformedCombinedData!.chartData}
                        syncId="chartSync"
                        margin={chartMargins}
                      >
                        <defs>
                          {transformedCombinedData!.seriesInfo.map(
                            (series, index) => (
                              <linearGradient
                                key={index}
                                id={`grad_combined_${index}`}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor={series.color}
                                  stopOpacity={0.1}
                                />
                                <stop
                                  offset="95%"
                                  stopColor={series.color}
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            )
                          )}
                        </defs>
                        <XAxis
                          type="number"
                          scale="time"
                          dataKey="x"
                          height={xAxisHeight}
                          domain={[startDate.getTime(), endDate.getTime()]}
                          allowDataOverflow={true}
                          ticks={hourlyTicks}
                          tickFormatter={
                            aggregateBy === 'hour' && hourlyTicks
                              ? (tick, index) =>
                                  formatHourlyTick(
                                    tick,
                                    index,
                                    hourlyTicks.length
                                  )
                              : (timestamp) => formatXAxis(timestamp)
                          }
                        />
                        <YAxis
                          label={{
                            value: 'kWh / %',
                            position: 'top',
                            offset: yAxisLabelOffset,
                          }}
                          width={yAxisWidth}
                        />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <Tooltip
                          contentStyle={{
                            fontSize: tooltipFontSize,
                            padding: tooltipPadding,
                            borderRadius: '4px',
                          }}
                          formatter={(value: number, name: string) => {
                            // Determine if this is SOC data (contains percentage) or energy data (kWh)
                            const isSocData =
                              name.toLowerCase().includes('soc') ||
                              name.toLowerCase().includes('state') ||
                              name.toLowerCase().includes('percentage');
                            return [
                              isSocData
                                ? `${value.toFixed(1)} %`
                                : `${value.toFixed(2)} kWh`,
                              name,
                            ];
                          }}
                          labelFormatter={(label: number) =>
                            new Date(label).toLocaleString()
                          }
                        />
                        <Legend
                          content={(props) => {
                            const { payload } = props;
                            return (
                              <Flex
                                as="ul"
                                direction="row"
                                overflowX={{ base: 'auto', md: 'visible' }}
                                overflowY="hidden"
                                py={2}
                                px={{ base: 2, md: 0 }}
                                gap={{ base: 2, md: 3 }}
                                listStyleType="none"
                                css={{
                                  '&::-webkit-scrollbar': {
                                    display: 'none',
                                  },
                                  scrollbarWidth: 'none',
                                  msOverflowStyle: 'none',
                                }}
                              >
                                {payload?.map((entry, index) => (
                                  <Flex
                                    key={`item-${index}`}
                                    as="li"
                                    direction="row"
                                    align="center"
                                    fontSize={{ base: 'xs', md: 'sm' }}
                                    px={2}
                                    flex="0 0 auto"
                                    whiteSpace="nowrap"
                                  >
                                    <Box
                                      width={{ base: '8px', md: '10px' }}
                                      height={{ base: '8px', md: '10px' }}
                                      borderRadius="2px"
                                      mr={2}
                                      backgroundColor={entry.color}
                                    />
                                    {entry.value}
                                  </Flex>
                                ))}
                              </Flex>
                            );
                          }}
                        />
                        {transformedCombinedData!.seriesInfo.map(
                          (series, index) => (
                            <Area
                              key={series.name}
                              type="monotone"
                              dataKey={series.name}
                              stroke={series.color}
                              fill={`url(#grad_combined_${index})`}
                              fillOpacity={1}
                              strokeWidth={2}
                              connectNulls={true}
                              isAnimationActive={false}
                            />
                          )
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <>
                      <ResponsiveContainer
                        key="energy-chart"
                        width="100%"
                        height={energyChartHeight}
                        initialDimension={{ width: 320, height: 200 }}
                      >
                        <AreaChart
                          data={transformedEnergyData.chartData}
                          syncId="chartSync"
                          margin={chartMargins}
                        >
                          <defs>
                            {transformedEnergyData.seriesInfo.map(
                              (series, index) => (
                                <linearGradient
                                  key={index}
                                  id={`grad_energy_${index}`}
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="5%"
                                    stopColor={series.color}
                                    stopOpacity={0.1}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor={series.color}
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                              )
                            )}
                          </defs>
                          <XAxis
                            type="number"
                            scale="time"
                            dataKey="x"
                            height={xAxisHeight}
                            domain={[startDate.getTime(), endDate.getTime()]}
                            allowDataOverflow={true}
                            ticks={hourlyTicks}
                            tickFormatter={() => ''}
                          />
                          <YAxis
                            label={{
                              value: 'kWh',
                              position: 'top',
                              offset: yAxisLabelOffset,
                            }}
                            width={yAxisWidth}
                          />
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <Tooltip
                            contentStyle={{
                              fontSize: tooltipFontSize,
                              padding: tooltipPadding,
                              borderRadius: '4px',
                            }}
                            formatter={(value: number, name: string) => [
                              `${value.toFixed(2)} kWh`,
                              name,
                            ]}
                            labelFormatter={(label: number) =>
                              new Date(label).toLocaleString()
                            }
                          />
                          <Legend
                            content={(props) => {
                              const { payload } = props;
                              return (
                                <Flex
                                  as="ul"
                                  direction="row"
                                  overflowX={{ base: 'auto', md: 'visible' }}
                                  overflowY="hidden"
                                  py={2}
                                  px={{ base: 2, md: 0 }}
                                  gap={{ base: 2, md: 3 }}
                                  listStyleType="none"
                                  css={{
                                    '&::-webkit-scrollbar': {
                                      display: 'none',
                                    },
                                    scrollbarWidth: 'none',
                                    msOverflowStyle: 'none',
                                  }}
                                >
                                  {payload?.map((entry, index) => (
                                    <Flex
                                      key={`item-${index}`}
                                      as="li"
                                      direction="row"
                                      align="center"
                                      fontSize={{ base: 'xs', md: 'sm' }}
                                      px={2}
                                      flex="0 0 auto"
                                      whiteSpace="nowrap"
                                    >
                                      <Box
                                        width={{ base: '8px', md: '10px' }}
                                        height={{ base: '8px', md: '10px' }}
                                        borderRadius="2px"
                                        mr={2}
                                        backgroundColor={entry.color}
                                      />
                                      {entry.value}
                                    </Flex>
                                  ))}
                                </Flex>
                              );
                            }}
                          />
                          {transformedEnergyData.seriesInfo.map(
                            (series, index) => (
                              <Area
                                key={series.name}
                                type="monotone"
                                dataKey={series.name}
                                stroke={series.color}
                                fill={`url(#grad_energy_${index})`}
                                fillOpacity={1}
                                strokeWidth={2}
                                connectNulls={true}
                                isAnimationActive={false}
                              />
                            )
                          )}
                        </AreaChart>
                      </ResponsiveContainer>
                      <ResponsiveContainer
                        key="soc-chart"
                        width="100%"
                        height={socChartHeight}
                        initialDimension={{ width: 320, height: 200 }}
                      >
                        <AreaChart
                          data={transformedSocData?.chartData || []}
                          syncId="chartSync"
                          margin={chartMargins}
                        >
                          <defs>
                            {transformedSocData?.seriesInfo.map(
                              (series, index) => (
                                <linearGradient
                                  key={index}
                                  id={`grad_soc_${index}`}
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="5%"
                                    stopColor={series.color}
                                    stopOpacity={0.1}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor={series.color}
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                              )
                            )}
                          </defs>
                          <XAxis
                            type="number"
                            scale="time"
                            dataKey="x"
                            height={xAxisHeight}
                            domain={[startDate.getTime(), endDate.getTime()]}
                            allowDataOverflow={true}
                            ticks={hourlyTicks}
                            tickFormatter={
                              aggregateBy === 'hour' && hourlyTicks
                                ? (tick, index) =>
                                    formatHourlyTick(
                                      tick,
                                      index,
                                      hourlyTicks.length
                                    )
                                : (timestamp) => formatXAxis(timestamp)
                            }
                          />
                          <YAxis
                            domain={[0, 100]}
                            label={{
                              value: '%',
                              position: 'top',
                              offset: yAxisLabelOffset,
                            }}
                            width={yAxisWidth}
                          />
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <Tooltip
                            contentStyle={{
                              fontSize: tooltipFontSize,
                              padding: tooltipPadding,
                              borderRadius: '4px',
                            }}
                            formatter={(value: number, name: string) => [
                              `${value.toFixed(1)} %`,
                              name,
                            ]}
                            labelFormatter={(label: number) =>
                              new Date(label).toLocaleString()
                            }
                          />
                          <Legend
                            content={(props) => {
                              const { payload } = props;
                              return (
                                <Flex
                                  as="ul"
                                  direction="row"
                                  overflowX={{ base: 'auto', md: 'visible' }}
                                  overflowY="hidden"
                                  py={2}
                                  px={{ base: 2, md: 0 }}
                                  gap={{ base: 2, md: 3 }}
                                  listStyleType="none"
                                  css={{
                                    '&::-webkit-scrollbar': {
                                      display: 'none',
                                    },
                                    scrollbarWidth: 'none',
                                    msOverflowStyle: 'none',
                                  }}
                                >
                                  {payload?.map((entry, index) => (
                                    <Flex
                                      key={`item-${index}`}
                                      as="li"
                                      direction="row"
                                      align="center"
                                      fontSize={{ base: 'xs', md: 'sm' }}
                                      px={2}
                                      flex="0 0 auto"
                                      whiteSpace="nowrap"
                                    >
                                      <Box
                                        width={{ base: '8px', md: '10px' }}
                                        height={{ base: '8px', md: '10px' }}
                                        borderRadius="2px"
                                        mr={2}
                                        backgroundColor={entry.color}
                                      />
                                      {entry.value}
                                    </Flex>
                                  ))}
                                </Flex>
                              );
                            }}
                          />
                          {transformedSocData?.seriesInfo.map(
                            (series, index) => (
                              <Area
                                key={series.name}
                                type="monotone"
                                dataKey={series.name}
                                stroke={series.color}
                                fill={`url(#grad_soc_${index})`}
                                fillOpacity={1}
                                strokeWidth={2}
                                connectNulls={true}
                                isAnimationActive={false}
                              />
                            )
                          )}
                        </AreaChart>
                      </ResponsiveContainer>
                    </>
                  )}
                </>
              ) : (
                noDataComponent
              ))}

            {/* Week/Month/Year/Lifetime View - Bar Chart */}
            {timeRange !== '1D' && transformedEnergyData && (
              <ResponsiveContainer
                width="100%"
                height="100%"
                initialDimension={{ width: 320, height: 200 }}
              >
                <BarChart
                  data={transformedEnergyData.chartData}
                  margin={barChartMargins}
                  // margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    scale="time"
                    dataKey="x"
                    height={xAxisHeight}
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(value) => formatXAxis(value)}
                    allowDataOverflow={true}
                    ticks={timeRange === '1W' ? weekTicks : undefined}
                    padding={{ left: 80, right: 80 }}
                  />
                  <YAxis
                    label={{ value: 'kWh', angle: -90, position: 'insideLeft' }} //offset: yAxisLabelOffset
                    width={yAxisWidth}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: tooltipFontSize,
                      padding: tooltipPadding,
                      borderRadius: '4px',
                    }}
                    formatter={(value: number) => `${value.toFixed(2)} kWh`}
                    labelFormatter={(label) => formatXAxis(label as number)}
                  />
                  <Legend
                    content={(props) => {
                      const { payload } = props;
                      return (
                        <Flex
                          as="ul"
                          direction="row"
                          overflowX={{ base: 'auto', md: 'visible' }}
                          overflowY="hidden"
                          py={2}
                          px={{ base: 2, md: 0 }}
                          gap={{ base: 2, md: 3 }}
                          listStyleType="none"
                          css={{
                            '&::-webkit-scrollbar': {
                              display: 'none',
                            },
                            scrollbarWidth: 'none',
                            msOverflowStyle: 'none',
                          }}
                        >
                          {payload?.map((entry, index) => (
                            <Flex
                              key={`item-${index}`}
                              as="li"
                              direction="row"
                              align="center"
                              fontSize={{ base: 'xs', md: 'sm' }}
                              px={2}
                              flex="0 0 auto"
                              whiteSpace="nowrap"
                            >
                              <Box
                                width={{ base: '8px', md: '10px' }}
                                height={{ base: '8px', md: '10px' }}
                                borderRadius="2px"
                                mr={2}
                                backgroundColor={entry.color}
                              />
                              {entry.value}
                            </Flex>
                          ))}
                        </Flex>
                      );
                    }}
                  />
                  {transformedEnergyData.seriesInfo.map((series) => (
                    <Bar
                      key={series.name}
                      dataKey={series.name}
                      fill={series.color}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </>
        )}
      </Box>
    </GridItem>
  );
};

export default EnergyTrendChart;
