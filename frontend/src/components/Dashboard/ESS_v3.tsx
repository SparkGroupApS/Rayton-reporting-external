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
  30, 31, 32, 33, 34, 35, 36, 37, 38, 39, // ESS devices

  303301, 303302, 303303, 303304, 303305, // PCS devices
  303401, 303402, 303403, 303404, 303405, // Cells
  303501, 303502, 303503, 303504, 303505, // BMS

  313301, 313302, 313303, 313304, 313305, // PCS devices
  313401, 313402, 313403, 313404, 313405, // Cells
  313501, 313502, 313503, 313504, 313505, // BMS

  323301, 323302, 323303, 323304, 323305, // PCS devices
  323401, 323402, 323403, 323404, 323405, // Cells
  323501, 323502, 323503, 323504, 323505, // BMS

  333301, 333302, 333303, 333304, 333305, // PCS devices
  333401, 333402, 333403, 333404, 333405, // Cells
  333501, 333502, 333503, 333504, 333505, // BMS

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
