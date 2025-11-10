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
  20, 21, 22, 23, 24, // SmartLoggers
  201101, 201102, 201103, 201104, 201105, // SmartLogger 1 counters
  201201, 201202, 201203, 201204, 201205, // SmartLogger 1 inverters

  211101, 211102, 211103, 211104, 211105, // SmartLogger 2 counters
  211201, 211202, 211203, 211204, 211205, // SmartLogger 2 inverters

  221101, 221102, 221103, 221104, 221105, // SmartLogger 3 counters
  221201, 221202, 221203, 221204, 221205, // SmartLogger 3 inverters

  231101, 231102, 231103, 231104, 231105, // SmartLogger 4 counters
  231201, 231202, 231203, 231204, 231205, // SmartLogger 4 inverters

  241101, 241102, 241103, 241104, 241105, // SmartLogger 5 counters
  241201, 241202, 241203, 241204, 241205, // SmartLogger 5 inverters
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
