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
import { FaSolarPanel, FaBatteryFull, FaIndustry, FaBolt, FaGasPump , FaCog, FaPlug } from 'react-icons/fa'; // Ensure necessary icons are imported
import React, { memo, useMemo } from 'react';


// --- Types ---
interface EnergyFlowProps {
  pvPower?: number; // kW
  gridPower?: number; // kW (positive = import, negative = export)
  loadPower?: number; // kW
  batteryPower?: number; // kW (positive = charge, negative = discharge)
  generatorPower?: number; // kW (positive = generating)
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
    bg="transparent" // OR bgColor="transparent"
    p={2}
    rounded="lg"
    shadow="md"
    border="none"
   // borderColor={isActive ? nodeColor : 'gray.200'} // Keep highlighting logic
    zIndex={2}
    w="100px"
    //backdropFilter="blur(4px)" // Adds a subtle blur effect for better transparency
    {...props}
  >
    <Icon as={icon} boxSize={8} color={color} mb={1} aria-hidden="true" />
    <Text fontSize="xs" color="gray.600" fontWeight="bold">
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
  generatorPower = 0,
  soc = 0,
  isLoading = false,
}: EnergyFlowProps) => {
  // Validate inputs
  const validatedPvPower = isNaN(pvPower) ? 0 : pvPower;
  const validatedGridPower = isNaN(gridPower) ? 0 : gridPower;
  const validatedLoadPower = isNaN(loadPower) ? 0 : loadPower;
  const validatedBatteryPower = isNaN(batteryPower) ? 0 : batteryPower;
  const validatedGeneratorPower = isNaN(generatorPower) ? 0 : generatorPower;
  const validatedSoc = isNaN(soc) ? 0 : soc;

  const orange = useToken('colors', ['orange.400']);
  const blue = useToken('colors', ['blue.500']);
  const green = useToken('colors', ['green.500']);
  const red = useToken('colors', ['red.500']);
  const purple = useToken('colors', ['purple.500']);

  // --- Logic to determine flow direction ---
  // PV: Positive flow goes TO Load, negative means it's not contributing
  const isPvActive = validatedPvPower > 0;

  // Grid: Import (>0) flows TO Load. Export (<0) flows FROM Load.
  const isGridImport = validatedGridPower > 0;
  const isGridExport = validatedGridPower < 0;

  // Battery: Charge (>0) flows TO Load. Discharge (<0) flows FROM Load.
  const isBattCharging = validatedBatteryPower > 0;
  const isBattDischarging = validatedBatteryPower < 0;

  // Generator: Positive flow goes TO Load
  const isGeneratorActive = validatedGeneratorPower > 0;

  // Load always consumes FROM sources
  const isLoadActive = validatedLoadPower > 0;

  // Create accessible labels for each flow
  const pvFlowLabel = `Solar flow: ${validatedPvPower.toFixed(2)} kW`;
  const batteryFlowLabel = `Battery flow: ${Math.abs(validatedBatteryPower).toFixed(2)} kW ${validatedBatteryPower > 0 ? 'supplying' : validatedBatteryPower < 0 ? 'receiving' : 'idle'}`;
  const gridFlowLabel = `Grid flow: ${Math.abs(validatedGridPower).toFixed(2)} kW ${validatedGridPower > 0 ? 'importing' : validatedGridPower < 0 ? 'exporting' : 'idle'}`;
  const generatorFlowLabel = `Generator flow: ${validatedGeneratorPower.toFixed(2)} kW`;
  const loadFlowLabel = `Load: ${validatedLoadPower.toFixed(2)} kW`;

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
      bg="white"
      rounded="xl"
      overflow="hidden"
      aria-label="Energy flow diagram showing solar, battery, grid, generator, and load connections"
      role="img"
    >
      <VisuallyHidden>
        Energy flow diagram showing power flows between solar panels, battery,
        grid, generator, and load
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
        {/* Load at center, PV at top */}
        <FlowLine
          d="M 200 150 L 200 60"
          color={orange[0]}
          isActive={isPvActive}
          isReverse={true} // Flow from PV to Load (top to center)
          ariaLabel={pvFlowLabel}
        />

        {/* Load at center, Battery on left */}
        <FlowLine
          d="M 200 150 L 90 150"
          color={green[0]}
          isActive={isBattCharging || isBattDischarging}
          isReverse={isBattDischarging} // If discharging, flow goes TO Load (left to center)
          ariaLabel={batteryFlowLabel}
        />

        {/* Load at center, Grid on right */}
        <FlowLine
          d="M 200 150 L 310 150"
          color={blue[0]}
          isActive={isGridImport || isGridExport}
          isReverse={isGridExport} // If exporting, flow goes FROM Load (center to right)
          ariaLabel={gridFlowLabel}
        />

        {/* Load at center, Generator at bottom */}
        <FlowLine
          d="M 200 150 L 200 240"
          color={purple[0]}
          isActive={isGeneratorActive}
          isReverse={true} // Flow from Generator to Load (bottom to center)
          ariaLabel={generatorFlowLabel}
        />
      </chakra.svg>

      {/* --- 2. Device Nodes (Load at center, others on 4 sides) --- */}

      {/* Center: Load */}
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <DeviceNode
            icon={FaIndustry}
            label="Load"
            value={validatedLoadPower.toFixed(2)}
            color="red.500"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            aria-label="Load"
          />
        </Tooltip.Trigger>
        <Tooltip.Positioner>
          <Tooltip.Content>
            Load: {validatedLoadPower.toFixed(2)} kW
          </Tooltip.Content>
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

      {/* Bottom: Generator */}
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <DeviceNode
            icon={FaGasPump}
            label="Generator"
            value={validatedGeneratorPower.toFixed(2)}
            color="purple.500"
            bottom="20px"
            left="50%"
            transform="translateX(-50%)"
            aria-label="Generator"
          />
        </Tooltip.Trigger>
        <Tooltip.Positioner>
          <Tooltip.Content>
            Generator: {validatedGeneratorPower.toFixed(2)} kW
          </Tooltip.Content>
        </Tooltip.Positioner>
      </Tooltip.Root>
    </Box>
    </GridItem>
  );
};

export const EnergyFlowDiagram = memo(EnergyFlowDiagramComponent);
export default EnergyFlowDiagram;
