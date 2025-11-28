// src/components/Dashboard/EnergyFlowDiagram.tsx
import {
  Box,
  Flex,
  Icon,
  Text,
  useToken,
  chakra,
  VisuallyHidden,
  Tooltip,
  GridItem,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import {
  FaSolarPanel,
  FaBatteryFull,
  FaIndustry,
  FaBolt,
  FaServer,
} from 'react-icons/fa';
import React, { memo } from 'react';

// --- Types ---
interface EnergyFlowProps {
  pvPower?: number; // kW
  gridPower?: number; // kW (positive = import, negative = export)
  loadPower?: number; // kW
  batteryPower?: number; // kW (positive = charge, negative = discharge)
  soc?: number; // %
  isLoading?: boolean;
}

interface DeviceNodeProps {
  icon: React.ElementType;
  label: string;
  value: string;
  unit?: string;
  subValue?: string;
  color: string;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  transform?: string;
  'aria-label'?: string;
}

interface FlowLineProps {
  d: string;
  color: string;
  isActive: boolean;
  isReverse?: boolean;
  ariaLabel?: string;
}

// --- Animations ---
const flowAnimation = keyframes`
  0% { stroke-dashoffset: 20; }
  100% { stroke-dashoffset: 0; }
`;

const animatedDashArray = '10, 10'; // Length of dash, length of gap

// --- Sub-components ---

// 1. The Device Node (Icon + Data)
const DeviceNode = ({
  icon,
  label,
  value,
  unit = 'kW',
  subValue,
  color,
  ...props
}: DeviceNodeProps) => (
  <Flex
    direction="column"
    align="center"
    position="absolute"
    bg="white"
    p={2}
    rounded="lg"
    shadow="md"
    border="1px solid"
    borderColor="gray.100"
    zIndex={2}
    w="100px"
    {...props}
  >
    <Icon as={icon} boxSize={8} color={color} mb={1} aria-hidden="true" />
    <Text fontSize="xs" color="gray.500" fontWeight="bold">
      {label}
    </Text>
    <Text fontSize="md" fontWeight="extrabold" lineHeight="1">
      {value}{' '}
      <Text as="span" fontSize="xs" fontWeight="normal">
        {unit}
      </Text>
    </Text>
    {subValue && (
      <Text fontSize="xs" color={color}>
        {subValue}
      </Text>
    )}
  </Flex>
);

// 2. The Flow Line (SVG Path + Animated Dot)
const FlowLine = ({
  d,
  color,
  isActive,
  isReverse,
  ariaLabel,
}: FlowLineProps) => {
  const dashArray = '10, 10'; // Length of dash, length of gap

  return (
    <g role="presentation">
      {/* Background Line (Static) */}
      <path
        d={d}
        stroke="#E2E8F0"
        strokeWidth="3"
        fill="none"
        aria-hidden="true"
      />

      {/* Animated Flow Line */}
      {isActive && (
        <path
          d={d}
          stroke={color}
          strokeWidth="3"
          fill="none"
          strokeDasharray={dashArray}
          style={{
            animation: `${flowAnimation} 1s linear infinite`,
            animationDirection: isReverse ? 'reverse' : 'normal',
          }}
          aria-label={ariaLabel}
        />
      )}
    </g>
  );
};

const EnergyFlowDiagramComponent = ({
  pvPower = 0,
  gridPower = 0,
  loadPower = 0,
  batteryPower = 0,
  soc = 0,
  isLoading = false,
}: EnergyFlowProps) => {
  // Validate inputs
  const validatedPvPower = isNaN(pvPower) ? 0 : pvPower;
  const validatedGridPower = isNaN(gridPower) ? 0 : gridPower;
  const validatedLoadPower = isNaN(loadPower) ? 0 : loadPower;
  const validatedBatteryPower = isNaN(batteryPower) ? 0 : batteryPower;
  const validatedSoc = isNaN(soc) ? 0 : soc;

  const orange = useToken('colors', ['orange.400']);
  const blue = useToken('colors', ['blue.500']);
  const green = useToken('colors', ['green.500']);
  const red = useToken('colors', ['red.500']);

  // --- Logic to determine flow direction ---
  // PV always flows to Inverter
  const isPvActive = validatedPvPower > 0;

  // Grid: Import (>0) flows TO Inverter. Export (<0) flows FROM Inverter.
  const isGridImport = validatedGridPower > 0;
  const isGridExport = validatedGridPower < 0;

  // Battery: Charge (>0) flows TO Battery. Discharge (<0) flows FROM Battery.
  const isBattCharging = validatedBatteryPower > 0;
  const isBattDischarging = validatedBatteryPower < 0;

  // Load always consumes FROM Inverter
  const isLoadActive = validatedLoadPower > 0;

  // Create accessible labels for each flow
  const pvFlowLabel = `Solar flow: ${validatedPvPower.toFixed(2)} kW`;
  const batteryFlowLabel = `Battery flow: ${Math.abs(validatedBatteryPower).toFixed(2)} kW ${validatedBatteryPower > 0 ? 'charging' : validatedBatteryPower < 0 ? 'discharging' : 'idle'}`;
  const gridFlowLabel = `Grid flow: ${Math.abs(validatedGridPower).toFixed(2)} kW ${validatedGridPower > 0 ? 'importing' : validatedGridPower < 0 ? 'exporting' : 'idle'}`;
  const loadFlowLabel = `Load flow: ${validatedLoadPower.toFixed(2)} kW`;

  if (isLoading) {
    return (
      <Box
        position="relative"
        h={{ base: '300px', md: '320px' }}
        w="100%"
        bg="gray.50"
        rounded="xl"
        overflow="hidden"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Text>Loading energy flow diagram...</Text>
      </Box>
    );
  }

  return (
    <GridItem

          area="chart"
          gridColumn={{ lg: 'span 3' }}
          bg="white"
          shadow="sm"
          rounded="lg"
          p={{ base: 2, md: 4 }} // Reduced from p={4}
          borderWidth="1px"
          minH={{ base: '300px', md: '400px' }}
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
    <Box
      position="relative"
      h={{ base: '300px', md: '320px' }}
      w="100%"
      bg="gray.50"
      rounded="xl"
      overflow="hidden"
      aria-label="Energy flow diagram showing solar, battery, grid, and load connections"
      role="img"
    >
      <VisuallyHidden>
        Energy flow diagram showing power flows between solar panels, battery,
        grid, and load
      </VisuallyHidden>

      {/* --- 1. SVG Layer for Lines (Absolute, covers whole box) --- */}
      <chakra.svg
        position="absolute"
        top={0}
        left={0}
        w="100%"
        h="100%"
        viewBox="0 0 400 300"
        zIndex={1}
        aria-hidden="true"
      >
        {/* PV to Center (Top to Middle) */}
        <FlowLine
          d="M 200 60 L 200 130"
          color={orange[0]}
          isActive={isPvActive}
          ariaLabel={pvFlowLabel}
        />

        {/* Center to Battery (Middle to Left) */}
        <FlowLine
          d="M 170 150 L 90 150"
          color={green[0]}
          isActive={isBattCharging || isBattDischarging}
          isReverse={isBattCharging} // If charging, flow goes TO battery (Left)
          ariaLabel={batteryFlowLabel}
        />

        {/* Center to Grid (Middle to Right) */}
        <FlowLine
          d="M 230 150 L 310 150"
          color={blue[0]}
          isActive={isGridImport || isGridExport}
          isReverse={isGridImport} // If import, flow goes TO Inverter (Left)
          ariaLabel={gridFlowLabel}
        />

        {/* Center to Load (Middle to Bottom) */}
        <FlowLine
          d="M 200 170 L 200 240"
          color={red[0]}
          isActive={isLoadActive}
          ariaLabel={loadFlowLabel}
        />
      </chakra.svg>

      {/* --- 2. Device Nodes (Absolute Positioning) --- */}

      {/* Center: Inverter */}
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <Flex
            position="absolute"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            zIndex={3}
            bg="white"
            p={3}
            rounded="full"
            shadow="lg"
            border="2px solid"
            borderColor="blue.500"
            align="center"
            justify="center"
            cursor="default"
          >
            <Icon
              as={FaServer}
              boxSize={6}
              color="blue.500"
              aria-label="Inverter"
            />
          </Flex>
        </Tooltip.Trigger>
        <Tooltip.Positioner>
          <Tooltip.Content>Inverter</Tooltip.Content>
        </Tooltip.Positioner>
      </Tooltip.Root>

      {/* Top: PV */}
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <DeviceNode
            icon={FaSolarPanel}
            label="Solar"
            value={validatedPvPower.toFixed(2)}
            color="orange.400"
            top="20px"
            left="50%"
            transform="translateX(-50%)"
            aria-label="Solar panel"
          />
        </Tooltip.Trigger>
        <Tooltip.Positioner>
          <Tooltip.Content>
            Solar: {validatedPvPower.toFixed(2)} kW
          </Tooltip.Content>
        </Tooltip.Positioner>
      </Tooltip.Root>

      {/* Left: Battery */}
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <DeviceNode
            icon={FaBatteryFull}
            label="Battery"
            value={Math.abs(validatedBatteryPower).toFixed(2)}
            subValue={`SOC: ${validatedSoc}%`}
            color="green.500"
            top="50%"
            left="20px"
            transform="translateY(-50%)"
            aria-label="Battery"
          />
        </Tooltip.Trigger>
        <Tooltip.Positioner>
          <Tooltip.Content>
            Battery: {Math.abs(validatedBatteryPower).toFixed(2)} kW, SOC:{' '}
            {validatedSoc}%
          </Tooltip.Content>
        </Tooltip.Positioner>
      </Tooltip.Root>

      {/* Right: Grid */}
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <DeviceNode
            icon={FaBolt}
            label="Grid"
            value={Math.abs(validatedGridPower).toFixed(2)}
            subValue={
              validatedGridPower > 0
                ? 'Import'
                : validatedGridPower < 0
                  ? 'Export'
                  : 'Idle'
            }
            color="blue.500"
            top="50%"
            right="20px"
            transform="translateY(-50%)"
            aria-label="Grid connection"
          />
        </Tooltip.Trigger>
        <Tooltip.Positioner>
          <Tooltip.Content>
            Grid: {Math.abs(validatedGridPower).toFixed(2)} kW,{' '}
            {validatedGridPower > 0
              ? 'Import'
              : validatedGridPower < 0
                ? 'Export'
                : 'Idle'}
          </Tooltip.Content>
        </Tooltip.Positioner>
      </Tooltip.Root>

      {/* Bottom: Load */}
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <DeviceNode
            icon={FaIndustry}
            label="Load"
            value={validatedLoadPower.toFixed(2)}
            color="red.500"
            bottom="20px"
            left="50%"
            transform="translateX(-50%)"
            aria-label="Load"
          />
        </Tooltip.Trigger>
        <Tooltip.Positioner>
          <Tooltip.Content>
            Load: {validatedLoadPower.toFixed(2)} kW
          </Tooltip.Content>
        </Tooltip.Positioner>
      </Tooltip.Root>
    </Box>
    </GridItem>
  );
};

export const EnergyFlowDiagram = memo(EnergyFlowDiagramComponent);
export default EnergyFlowDiagram;
