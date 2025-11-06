import React, { useEffect, useState } from "react";
import {
  Box,
  Flex,
  Heading,
  Text,
  Spinner,
  useToken,
} from "@chakra-ui/react";

type RealtimeDataPoint = {
  data_id: number;
  plant_id: number;
  device_id: number;
  name: string;
  timestamp: number;
  value: string;
};




type RealtimeDataResponse = {
  values: RealtimeDataPoint[];
};

type PlantConfigDevice = {
  device_id: number;
  name: string;
};

type PlantConfigResponse = {
  devices: PlantConfigDevice[];
};

interface GetDeviceDataProps {
  tenantId: string;
  deviceIds: number[];
}

const REFRESH_INTERVAL = 300;

export default function GetDeviceData({ tenantId, deviceIds }: GetDeviceDataProps) {
  const [logs, setLogs] = useState<RealtimeDataPoint[]>([]);
  const [deviceNames, setDeviceNames] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // optional: get theme colors (works even if useColorModeValue not present)
  // we use tokens just to be safe; fallback to plain strings if token missing
  const [theadBg] = useToken("colors", ["gray.100"]);

  const fetchPlantConfig = async (tenantId: string, token: string) => {
    const res = await fetch(
      `http://localhost:8000/api/v1/plant-config?tenant_id=${tenantId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) throw new Error("Ошибка при получении PLANT_CONFIG");
    const data: PlantConfigResponse = await res.json();
    const namesMap = data.devices.reduce((acc, d) => {
      acc[d.device_id] = d.name;
      return acc;
    }, {} as Record<number, string>);
    setDeviceNames(namesMap);
  };

  const fetchLogs = async () => {
    if (!tenantId) return;

    try {
      setLoading(true);
      const token = localStorage.getItem("access_token");
      if (!token) throw new Error("Немає токена авторизації.");

      // Получаем plant config (названия устройств)
      await fetchPlantConfig(tenantId, token);

      // Получаем realtime данные
      const query = new URLSearchParams();
      query.append("tenant_id", tenantId);
      deviceIds.forEach((id) => query.append("device_ids", id.toString()));

      const res = await fetch(
        `http://localhost:8000/api/v1/realtime-data/latest?${query}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        if (res.status === 401) throw new Error("Користувач не авторизований. Перевірте токен.");
        if (res.status === 403) throw new Error("Немає доступу до цього тенанта.");
        throw new Error(`Помилка запиту: ${res.status}`);
      }

      const data: RealtimeDataResponse = await res.json();

      // optional: sort by timestamp descending (latest first)
      const sorted = (data.values || []).slice().sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

      setLogs(sorted);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, REFRESH_INTERVAL * 1000);
  //  console.log("tenantId:", tenantId);
  //  console.log("deviceIds:", deviceIds);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, deviceIds, JSON.stringify(deviceIds)]); // use stringify to avoid ref equality issues



  if (loading)
    return (
      <Flex align="center" justify="center" p={6}>
        <Spinner />
        <Text ml={3}>Завантаження даних...</Text>
      </Flex>
    );

  if (error)
    return (
      <Box p={6} color="red.500">
        Ошибка: {error}
      </Box>
    );

return (
  <Box p={4}>
    <Flex align="center" justify="space-between" mb={4} flexWrap="wrap">
      <Heading size="md" mb={{ base: 2, md: 0 }}>
        {" "}
        {deviceNames[deviceIds[0]]
          ? `${deviceNames[deviceIds[0]]}`
          : `Пристрій ${deviceIds.join(", ")}`}{" "}
    {/*     {logs[0]?.plant_id || logs[0]?.device_id
          ? `(${logs[0]?.plant_id ? `PLANT_ID: ${logs[0].plant_id}` : ""}${
              logs[0]?.plant_id && logs[0]?.device_id ? ", " : ""
            }${logs[0]?.device_id ? `DEVICE_ID: ${logs[0].device_id}` : ""})`
          : ""}*/}
      </Heading>

<Flex align="center" gap={4}>
{/*   <Text fontSize="sm" color="gray.500">
    Автооновлення кожні {REFRESH_INTERVAL} с
  </Text> */}

  {logs.length > 0 && (
    <Text fontSize="sm" color="gray.600">
      Останнє оновлення:{" "}
      {new Date(
        Math.max(...logs.map((l) => Number(l.timestamp)))
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
      // mx="auto"               // 👈 центрируем таблицу
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

         {/*    <Box
              as="th"
              px={3}
              py={2}
              textAlign="left"
              fontWeight="semibold"
              borderBottom="1px solid"
              borderColor="gray.200"
            >
              Час оновлення
            </Box>  */}

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
          {logs.map((log, idx) => (
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


          {/*     <Box
                as="td"
                px={3}
                py={2}
                borderBottom="1px solid"
                borderColor="gray.100"
              >
                {new Date(log.timestamp).toLocaleString()}
              </Box> */}
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
      {logs.map((log, idx) => (
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
   {/*       <Text fontSize="sm" color="gray.600">
            {new Date(log.timestamp).toLocaleString()}
          </Text> */}
          <Text fontSize="sm">
            <strong>Значення:</strong> {log.value ?? "-"}
          </Text>
        </Box>
      ))}
    </Box>
  </Box>
);


}
