import React, { useEffect, useState } from "react";
import { Box, Flex, Text, Spinner } from "@chakra-ui/react";
import GetDeviceData from "./GetDeviceData";
import GetDeviceTree from "./GetDeviceTree"; // ✅ новое подключение

type PlantConfigDevice = {
  device_id: number;
  parent_id: number;
  name: string;
  class_id: number;
  plant_id?: number | string;
  children?: PlantConfigDevice[];
};

type PlantConfigResponse = {
  devices: PlantConfigDevice[];
};

interface SmartloggerProps {
  tenantId: string;
}
const REFRESH_INTERVAL = 60;

const DEVICE_IDS = [
  10, 11, 12, 13, 14, // SmartLoggers
  101101, 101102, 101103, 101104, 101105, // SmartLogger 1 counters
  101201, 101202, 101203, 101204, 101205, // SmartLogger 1 inverters

  111101, 111102, 111103, 111104, 111105, // SmartLogger 2 counters
  111201, 111202, 111203, 111204, 111205, // SmartLogger 2 inverters

  121101, 121102, 121103, 121104, 121105, // SmartLogger 3 counters
  121201, 121202, 121203, 121204, 121205, // SmartLogger 3 inverters

  131101, 131102, 131103, 131104, 131105, // SmartLogger 4 counters
  131201, 131202, 131203, 131204, 131205, // SmartLogger 4 inverters

  141101, 141102, 141103, 141104, 141105, // SmartLogger 5 counters
  141201, 141202, 141203, 141204, 141205, // SmartLogger 5 inverters
];

export default function Smartlogger({ tenantId }: SmartloggerProps) {
  const [deviceTree, setDeviceTree] = useState<PlantConfigDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<PlantConfigDevice | null>(null);
  const [plantId, setPlantId] = useState<number | string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const fetchPlantConfig = async (tenantId: string, token: string) => {
    const res = await fetch(`http://localhost:8000/api/v1/plant-config?tenant_id=${tenantId}`, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Ошибка при получении PLANT_CONFIG");
    const data: PlantConfigResponse = await res.json();
    const detectedPlantId = data.devices.find(d => d.plant_id)?.plant_id ?? tenantId;
    setPlantId(detectedPlantId);
    const filtered = data.devices
      .filter(d => DEVICE_IDS.includes(d.device_id))
      .map(d => ({ ...d, plant_id: d.plant_id ?? detectedPlantId }));
    setDeviceTree(buildTree(filtered));
  };

  const fetchDevices = async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      const token = localStorage.getItem("access_token");
      if (!token) throw new Error("Нет токена авторизации.");
      await fetchPlantConfig(tenantId, token);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setDeviceTree([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [tenantId]);

  if (loading)
    return (
      <Flex justify="center" align="center" h="100vh">
        <Spinner size="xl" />
        <Text ml={3}>Загрузка устройств...</Text>
      </Flex>
    );

  if (error)
    return (
      <Flex justify="center" align="center" h="100vh">
        <Text color="red.500">Ошибка: {error}</Text>
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
            <Text color="gray.500">Выберите устройство слева, чтобы увидеть данные</Text>
          </Flex>
        )}
      </Box>
    </Flex>
  );
}