// src/components/Dashboard/TabRenderer.tsx
import { usePlant } from "@/hooks/usePlantQueries";
import { Box, Spinner, Text } from "@chakra-ui/react";
import ESS from "./ESS";
import ESSTabAdvanced from "./ESSTabVariations/ESSTab_advanced";
import ESSTabBasic from "./ESSTabVariations/ESSTab_basic";
import PLCControl from "./PLCControl";
import ScheduleTab from "./ScheduleTabVariations/ScheduleTab";
import ScheduleTabFull from "./ScheduleTabVariations/ScheduleTab_full";
import ScheduleTabLight from "./ScheduleTabVariations/ScheduleTab_light";
import Smartlogger from "./Smartlogger";

interface TabRendererProps {
  tabType: 'schedule' | 'ess' | 'smartlogger' | 'plccontrol';
  tenantId: string;
  plantId?: string | number;
}

const TabRenderer = ({ tabType, tenantId, plantId }: TabRendererProps) => {
  // Assuming plantId is passed or can be derived from tenantId
  // Since we don't have a direct mapping from tenantId to plantId, we'll need to pass plantId as prop
  // or have another mechanism to get the plantId from the tenantId
  const { data, isLoading, error, isError } = usePlant(plantId ? Number(plantId) : null);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="200px">
        <Spinner size="xl" />
      </Box>
    );
  }

  if (isError || error) {
    return (
      <Box p={4}>
        <Text color="red.500">Error loading configuration: {error?.message || 'Unknown error'}</Text>
        {/* Fallback to default component */}
        {renderDefaultTab(tabType, tenantId)}
      </Box>
    );
  }

  // Define the type for tab configuration
  interface TabConfig {
    schedule?: string;
    ess?: string;
    smartlogger?: string;
    plccontrol?: string;
    [key: string]: string | undefined;
  }

  // Parse the tab_config JSON string into an object if it exists
  let tabConfig: TabConfig = {};
  if (data?.tab_config) {
    try {
      tabConfig = JSON.parse(data.tab_config);
    } catch (e) {
      console.error('Error parsing tab_config:', e);
    }
  }

  // Determine which component to render based on the configuration
  const componentType = tabConfig[tabType] || getDefaultComponent(tabType);

  return renderComponent(componentType, tenantId);
};

// Helper function to render the appropriate component
const renderComponent = (componentType: string, tenantId: string) => {
  switch (componentType) {
    case 'ScheduleTab':
    case 'ScheduleTab_default':
      return <ScheduleTab tenantId={tenantId} />;
    case 'ScheduleTab_light':
      return <ScheduleTabLight tenantId={tenantId} />;
    case 'ScheduleTab_full':
      return <ScheduleTabFull tenantId={tenantId} />;
    case 'ESSTab_basic':
      return <ESSTabBasic tenantId={tenantId} />;
    case 'ESSTab_advanced':
      return <ESSTabAdvanced tenantId={tenantId} />;
    case 'ESS':
      return <ESS tenantId={tenantId} />;
    case 'Smartlogger':
      return <Smartlogger tenantId={tenantId} />;
    case 'PLCControl':
      return <PLCControl tenantId={tenantId} />;
    default:
      // If the component type is not recognized, return a default
      return <ScheduleTab tenantId={tenantId} />;
  }
};

// Helper function to render default tabs when config is unavailable
const renderDefaultTab = (tabType: string, tenantId: string) => {
  switch (tabType) {
    case 'schedule':
      return <ScheduleTab tenantId={tenantId} />;
    case 'ess':
      return <ESS tenantId={tenantId} />;
    case 'smartlogger':
      return <Smartlogger tenantId={tenantId} />;
    case 'plccontrol':
      return <PLCControl tenantId={tenantId} />;
    default:
      return <ScheduleTab tenantId={tenantId} />;
  }
};

// Helper function to get default component if config is not specified
const getDefaultComponent = (tabType: string) => {
  switch (tabType) {
    case 'schedule':
      return 'ScheduleTab_default';
    case 'ess':
      return 'ESS';
    case 'smartlogger':
      return 'Smartlogger';
    case 'plccontrol':
      return 'PLCControl';
    default:
      return 'ScheduleTab_default';
  }
};

export default TabRenderer;
