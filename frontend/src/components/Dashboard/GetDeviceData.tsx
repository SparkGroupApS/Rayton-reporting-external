import React from "react";
import {
  Box,
  Flex,
  Heading,
  Text,
  Spinner,
} from "@chakra-ui/react";
import { useGetDeviceData } from "@/hooks/useDeviceDataQueries";
import { useGetPlantConfig } from "@/hooks/usePlantConfigQueries";

type RealtimeDataPoint = {
  data_id: number;
  plant_id: number;
  device_id: number;
  name: string;
  timestamp: number;
  value: string;
};

interface GetDeviceDataProps {
  tenantId: string;
  deviceIds: number[];
}

export default function GetDeviceData({ tenantId, deviceIds }: GetDeviceDataProps) {
  // Fetch device data using the new hook
  const { data: deviceData, isLoading, error } = useGetDeviceData({ 
    tenantId, 
    deviceIds 
  });

  // Fetch plant config to get device names
  const { data: plantConfig } = useGetPlantConfig({ tenantId });

  // Create a map of device IDs to names from plant config
  const deviceNamesMap = React.useMemo(() => {
    if (!plantConfig?.devices) return {};
    return plantConfig.devices.reduce((acc, device) => {
      acc[device.device_id] = device.name;
      return acc;
    }, {} as Record<number, string>);
  }, [plantConfig]);

  // Sort logs by timestamp descending (latest first)
  const sortedLogs = React.useMemo(() => {
    if (!deviceData?.values) return [];
    return [...deviceData.values].sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
 }, [deviceData]);

  if (isLoading)
    return (
      <Flex align="center" justify="center" p={6}>
        <Spinner />
        <Text ml={3}>Завантаження даних...</Text>
      </Flex>
    );

  if (error)
    return (
      <Box p={6} color="red.500">
        Помилка: {error.message || "Помилка при завантаженні даних"}
      </Box>
    );

  return (
    <Box p={4}>
      <Flex align="center" justify="space-between" mb={4} flexWrap="wrap">
        <Heading size="md" mb={{ base: 2, md: 0 }}>
          {" "}
          {deviceNamesMap[deviceIds[0]]
            ? `${deviceNamesMap[deviceIds[0]]}`
            : `Пристрій ${deviceIds.join(", ")}`}{" "}
        </Heading>

        <Flex align="center" gap={4}>
          {sortedLogs.length > 0 && (
            <Text fontSize="sm" color="gray.600">
              Останнє оновлення:{" "}
              {new Date(
                Math.max(...sortedLogs.map((l) => Number(l.timestamp)))
              ).toLocaleString()}
            </Text>
          )}
        </Flex>
      </Flex>

      {/* TABLE (desktop) */}
      <Box
        display={{ base: "none", md: "block" }}
        overflowX="auto"
        borderWidth="1px"
        borderRadius="md"
        maxW="800px"            // 👈 ограничиваем общую ширину таблицы
        ml={4}                // Небольшое расстояние от левого края (16px)
        shadow="sm"
      >
        <Box as="table" width="100%" borderCollapse="collapse">
          <Box as="thead" bg="gray.100">
            <Box as="tr">
              <Box
                as="th"
                px={3}
                py={2}
                textAlign="left"
                fontWeight="semibold"
                borderBottom="1px solid"
                borderColor="gray.200"
                w="40%"          // 👈 фиксируем ширину для параметра
              >
                Параметр
              </Box>
              
              <Box
                as="th"
                px={3}
                py={2}
                textAlign="left"
                fontWeight="semibold"
                borderBottom="1px solid"
                borderColor="gray.200"
                w="35%"          // 👈 фиксируем ширину для значения
              >
                Значення
              </Box>

              <Box
                as="th"
                px={3}
                py={2}
                textAlign="left"
                fontWeight="semibold"
                borderBottom="1px solid"
                borderColor="gray.200"
                w="25%"          // 👈 фиксируем ширину для ID
              >
                Data ID
              </Box>
            </Box>
          </Box>

          <Box as="tbody">
            {sortedLogs.map((log, idx) => (
              <Box as="tr" key={log.data_id ?? idx} _hover={{ bg: "gray.50" }}>
                <Box
                  as="td"
                  px={3}
                  py={2}
                  borderBottom="1px solid"
                  borderColor="gray.100"
                >
                  {log.name}
                </Box>

                <Box
                  as="td"
                  px={3}
                  py={2}
                  borderBottom="1px solid"
                  borderColor="gray.100"
                >
                  {log.value ?? "-"}
                </Box>

                <Box
                  as="td"
                  px={3}
                  py={2}
                  borderBottom="1px solid"
                  borderColor="gray.100"
                >
                  {log.plant_id}:{log.device_id}:{log.data_id}
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* CARDS (mobile) */}
      <Box display={{ base: "flex", md: "none" }} flexDir="column" gap={3}>
        {sortedLogs.map((log, idx) => (
          <Box
            key={log.data_id ?? idx}
            p={3}
            borderWidth="1px"
            borderRadius="md"
            shadow="xs"
            bg="gray.50"
          >
            <Text fontSize="sm" fontWeight="bold">
              {log.name}
            </Text>
            <Text fontSize="sm">
              <strong>Значення:</strong> {log.value ?? "-"}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
