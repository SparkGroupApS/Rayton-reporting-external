import React, { useState } from "react";
import { Box, Flex, Text, Spinner } from "@chakra-ui/react";
import GetDeviceData from "./GetDeviceData";
import GetDeviceTree from "./GetDeviceTree"; // ✅ новое подключение
import { useGetPlantConfig } from "@/hooks/usePlantConfigQueries";

type PlantConfigDevice = {
 device_id: number;
  parent_id: number;
  name: string;
 class_id: number;
  plant_id?: number | string;
  children?: PlantConfigDevice[];
};

interface SmartloggerProps {
  tenantId: string;
}

const DEVICE_IDS = [
  30, 31, 32, 33, 34, // SmartLoggers
  301101, 301102, 301103, 301104, 301105, // SmartLogger 1 counters
  301201, 301202, 301203, 301204, 301205, // SmartLogger 1 inverters

  311101, 311102, 311103, 311104, 311105, // SmartLogger 2 counters
  311201, 311202, 311203, 311204, 311205, // SmartLogger 2 inverters

  321101, 321102, 321103, 321104, 321105, // SmartLogger 3 counters
  321201, 321202, 321203, 321204, 321205, // SmartLogger 3 inverters

  331101, 331102, 331103, 331104, 331105, // SmartLogger 4 counters
  331201, 331202, 331203, 331204, 331205, // SmartLogger 4 inverters

  341101, 341102, 341103, 341104, 341105, // SmartLogger 5 counters
  341201, 341202, 341203, 341204, 341205, // SmartLogger 5 inverters
];

export default function Smartlogger({ tenantId }: SmartloggerProps) {
  const [selectedDevice, setSelectedDevice] = useState<PlantConfigDevice | null>(null);
  const [plantId, setPlantId] = useState<number | string | null>(null);

  const { data, isLoading, error } = useGetPlantConfig({ tenantId });

  const buildTree = (devices: PlantConfigDevice[]): PlantConfigDevice[] => {
    const map: Record<number, PlantConfigDevice> = {};
    devices.forEach(d => (map[d.device_id] = { ...d, children: [] }));
    const tree: PlantConfigDevice[] = [];
    devices.forEach(d => {
      const node = map[d.device_id];
      if (d.parent_id === 0) tree.push(node);
      else map[d.parent_id]?.children?.push(node);
    });
    return tree;
  };

  // Process the API response data to filter and build the tree
  const deviceTree = React.useMemo(() => {
    if (!data?.devices) return [];

    const detectedPlantId = data.devices.find(d => d.plant_id)?.plant_id ?? tenantId;
    setPlantId(detectedPlantId);

    const filtered = data.devices
      .filter(d => DEVICE_IDS.includes(d.device_id))
      .map(d => ({ ...d, plant_id: d.plant_id ?? detectedPlantId }));

    return buildTree(filtered);
  }, [data, tenantId]);

  if (isLoading)
    return (
      <Flex justify="center" align="center" h="100vh">
        <Spinner size="xl" />
        <Text ml={3}>Загрузка устройств...</Text>
      </Flex>
    );

  if (error)
    return (
      <Flex justify="center" align="center" h="100vh">
        <Text color="red.500">Ошибка: {error.message || "Ошибка при загрузке данных"}</Text>
      </Flex>
    );

  return (
    <Flex p={4} h="calc(100vh - 100px)" gap={6} align="stretch" justify="space-between">
      {/* ✅ Компонент дерева */}
      <GetDeviceTree
        deviceTree={deviceTree}
        selectedDevice={selectedDevice}
        setSelectedDevice={setSelectedDevice}
      />

      {/* Правая панель */}
      <Box flex="1" bg="white" borderWidth="1px" borderRadius="lg" p={4} overflowY="auto" shadow="sm">
        {selectedDevice ? (
          <GetDeviceData tenantId={tenantId} deviceIds={[selectedDevice.device_id]} />
        ) : (
          <Flex justify="center" align="center" h="full">
            <Text color="gray.500">Виберіть пристрій ліворуч, щоб побачити дані</Text>
          </Flex>
        )}
      </Box>
    </Flex>
  );
};
