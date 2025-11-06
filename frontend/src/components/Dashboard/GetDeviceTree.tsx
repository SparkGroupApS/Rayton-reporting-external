import React, { useState, useEffect } from "react";
import { Box, Text, VStack, Heading } from "@chakra-ui/react";

type PlantConfigDevice = {
  device_id: number;
  parent_id: number;
  name: string;
  class_id: number;
  plant_id?: number | string;
  children?: PlantConfigDevice[];
};

interface GetDeviceTreeProps {
  deviceTree: PlantConfigDevice[];
  selectedDevice: PlantConfigDevice | null;
  setSelectedDevice: (device: PlantConfigDevice) => void;
}

/**
 * Компонент дерева устройств с возможностью сворачивать/разворачивать ветви
 */
const GetDeviceTree: React.FC<GetDeviceTreeProps> = ({
  deviceTree,
  selectedDevice,
  setSelectedDevice,
}) => {
  // локальное состояние: хранит id раскрытых узлов
  const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>({});

  // переключение раскрытия узла
  const toggleNode = (deviceId: number) => {
    setExpandedNodes(prev => ({ ...prev, [deviceId]: !prev[deviceId] }));
  };


    // Выводим параметры в консоль каждый раз, когда компонент рендерится
  // useEffect(() => {
  //  console.log("deviceTree:", deviceTree);
  // console.log("selectedDevice:", selectedDevice);
  // console.log("setSelectedDevice:", setSelectedDevice);
  // }, [deviceTree, selectedDevice, setSelectedDevice]);

  // рекурсивный рендер дерева
  const renderTree = (devices: PlantConfigDevice[], level = 0) =>
    devices.map(device => {
      const hasChildren = device.children && device.children.length > 0;
      const isExpanded = expandedNodes[device.device_id];

      return (
        <Box key={device.device_id} pl={level * 4}>
          <Box
            py={1}
            px={2}
            borderRadius="md"
            cursor="pointer"
            bg={
              selectedDevice?.device_id === device.device_id
                ? "blue.100"
                : "transparent"
            }
            _hover={{ bg: "gray.100" }}
            display="flex"
            alignItems="center"
            onClick={e => {
              e.stopPropagation();
              setSelectedDevice(device);
            }}
          >
            {hasChildren && (
              <Text
                as="span"
                mr={2}
                fontWeight="bold"
                onClick={e => {
                  e.stopPropagation(); // чтобы не вызывался выбор устройства
                  toggleNode(device.device_id);
                }}
              >
                {isExpanded ? "▼" : "▶"}
              </Text>
            )}
            <Text fontSize="sm" fontWeight="medium">
              {device.name || "Без імені"} 
            </Text>
          </Box>

          {hasChildren && isExpanded && (
            <Box mt={1}>{renderTree(device.children!, level + 1)}</Box>
          )}
        </Box>
      );
    });

  return (
    <Box
      w="22%"
      minW="240px"
      bg="gray.50"
      borderWidth="1px"
      borderRadius="lg"
      p={4}
      overflowY="auto"
      shadow="sm"
    >
      <Heading size="md" mb={4}>
        Пристрої
      </Heading>
      <VStack align="stretch" spacing={1}>
        {renderTree(deviceTree)}
      </VStack>
    </Box>
  );
};

export default GetDeviceTree;
