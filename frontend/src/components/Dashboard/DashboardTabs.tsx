// src/components/Dashboard/DashboardTabs.tsx
import type { ApiError, DashboardData } from '@/client';
import {
  Box,
  Grid,
  GridItem,
  Spinner,
  Tabs, // Import the main Tabs namespace
} from '@chakra-ui/react';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { usePlant } from '@/hooks/usePlantQueries';
import EnergyTrendChart from './EnergyTrendChart';
import { EnergyFlowDiagram } from './EnergyFlowDiagram';
import ItemsSection from './ItemsSection';
import KpiSection from './KpiSection';
import PLCDataSettingsTable from './PLCDataSettingsTable';
import TabRenderer from './TabRenderer';

// Define the props this component needs
interface DashboardTabsProps {
  isLoadingDashboard: boolean;
  dashboardData: DashboardData | undefined;
  error: ApiError | null;
  selectedTenant: string | null;
  energyDataIds: number[]; // <-- UPDATED type
  socDataId: number; // <-- UPDATED type
  initialTab?: string; // <-- Add initialTab prop to receive tab from route
  plantId?: number | string; // <-- Add plantId prop for tab configuration
}

const DashboardTabs = ({
  isLoadingDashboard,
  dashboardData,
  error,
  selectedTenant,
  energyDataIds,
  socDataId,
  initialTab = 'main', // Default to main tab
  plantId,
}: DashboardTabsProps) => {
  // Initialize activeTab from the prop passed from the route, default to "main"
  const [activeTab, setActiveTab] = useState(initialTab);

  const navigate = useNavigate();

  // Fetch plant configuration to determine which tabs should be visible
  const { data: plantData, isLoading: isPlantLoading } = usePlant(
    plantId ? Number(plantId) : null
  );

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
  if (plantData?.tab_config) {
    try {
      tabConfig = JSON.parse(plantData.tab_config);
    } catch (e) {
      console.error('Error parsing tab_config:', e);
    }
  }

  // Determine if a tab should be visible based on configuration
  const isTabVisible = (tabKey: string): boolean => {
    return tabConfig[tabKey] !== 'none';
  };

  // Update the URL when activeTab changes
  useEffect(() => {
    navigate({
      to: '.',
      search: (prev: any) => ({
        ...prev,
        tab: activeTab,
      }),
      replace: true, // Replace history instead of pushing to avoid back button issues
    });
  }, [activeTab, navigate]);

  // If the active tab is hidden due to configuration, switch to a visible default tab
  useEffect(() => {
    if (
      !isPlantLoading &&
      activeTab !== 'main' &&
      activeTab !== 'settings' &&
      !isTabVisible(activeTab)
    ) {
      // Find the first visible configurable tab as default
      const firstVisibleTab = ['schedule', 'smdata', 'essdata', 'control'].find(
        (tab) =>
          isTabVisible(
            tab === 'smdata'
              ? 'smartlogger'
              : tab === 'essdata'
                ? 'ess'
                : tab === 'control'
                  ? 'plcontrol'
                  : tab
          )
      );

      if (firstVisibleTab) {
        // Map back to the correct tab value
        const tabMap: Record<string, string> = {
          smartlogger: 'smdata',
          ess: 'essdata',
          plccontrol: 'control',
        };
        const mappedTab = tabMap[firstVisibleTab] || firstVisibleTab;
        setActiveTab(mappedTab);
      } else {
        // If no configurable tabs are visible, default to main
        setActiveTab('main');
      }
    }
  }, [isPlantLoading, activeTab, tabConfig]);

  if (isLoadingDashboard) {
    return (
      <Box display="flex" justifyContent="center" py={10}>
        <Spinner />
      </Box>
    );
  }

  // This check is perfect. If no tenant, we can't show anything.
  if (!selectedTenant) {
    return <Box>Please select a tenant to view data.</Box>;
  }

  // Don't render the tabs until plant configuration is loaded to avoid flickering
  if (isPlantLoading) {
    return (
      <Box display="flex" justifyContent="center" py={10}>
        <Spinner />
      </Box>
    );
  }

  // Function to handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  // Use the v3 namespaced syntax
  return (
    <Tabs.Root colorScheme="blue" mt={4} value={activeTab}>
      <Tabs.List
        overflowX={{ base: 'auto', md: 'visible' }}
        pb={2}
        css={{
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          '-ms-overflow-style': 'none', // IE and Edge
          'scrollbar-width': 'none', // Firefox
        }}
      >
        <Tabs.Trigger
          value="main"
          onClick={() => handleTabChange('main')}
          minW="fit-content"
        >
          Головна
        </Tabs.Trigger>
        {isTabVisible('schedule') && (
          <Tabs.Trigger
            value="schedule"
            onClick={() => handleTabChange('schedule')}
            minW="fit-content"
          >
            Розклад
          </Tabs.Trigger>
        )}
        {isTabVisible('smartlogger') && (
          <Tabs.Trigger
            value="smdata"
            onClick={() => handleTabChange('smdata')}
            minW="fit-content"
          >
            СЕС
          </Tabs.Trigger>
        )}
        {isTabVisible('ess') && (
          <Tabs.Trigger
            value="essdata"
            onClick={() => handleTabChange('essdata')}
            minW="fit-content"
          >
            УЗЕ
          </Tabs.Trigger>
        )}
        {isTabVisible('plcontrol') && (
          <Tabs.Trigger
            value="control"
            onClick={() => handleTabChange('control')}
            minW="fit-content"
          >
            Керування
          </Tabs.Trigger>
        )}
        <Tabs.Trigger
          value="settings"
          onClick={() => handleTabChange('settings')}
          minW="fit-content"
        >
          Налаштування
        </Tabs.Trigger>
        {/* Add more tabs as needed */}
      </Tabs.List>

      {/* Panel 1: Your existing Dashboard Grid */}
      <Tabs.Content value="main" px={0} py={6}>
        <Grid
          templateAreas={{
            base: `"chart" "flow" "items"`,
            md: `"chart chart" "flow items"`,
            lg: `"chart chart chart flow" "chart chart chart items"`,
          }}
          templateColumns={{
            base: '1fr',
            md: '1fr 1fr',
            lg: '1fr 1fr 1fr 1fr',
          }}
          templateRows={{ lg: 'auto 1fr' }}
          gap={{ base: 4, md: 6 }}
        >
          {/* All components are now rendered inside here */}
          <EnergyTrendChart
            tenantId={selectedTenant}
            energyDataIds={energyDataIds} // <-- Use the prop
            socDataId={socDataId} // <-- Use the prop
          />

            {/* <EnergyFlowDiagram
              // You need to wire these up to your actual data source
              // Example using mocked or derived data:
              pvPower={12.5}
              gridPower={-5.2} // Negative = Exporting
              loadPower={7.3}
              batteryPower={0.0}
              soc={85}
            /> */}

          {/* <ItemsSection
            items={dashboardData?.items}
            //users={dashboardData?.users} // <-- Pass users prop
            isLoading={isLoadingDashboard}
          // error={error} // <-- ItemsSection doesn't seem to take an error prop
          /> */}
        </Grid>
      </Tabs.Content>

      {isTabVisible('schedule') && (
        <Tabs.Content value="schedule">
          <TabRenderer
            tabType="schedule"
            tenantId={selectedTenant}
            plantId={plantId}
          />
        </Tabs.Content>
      )}

      {isTabVisible('smartlogger') && (
        <Tabs.Content value="smdata">
          <TabRenderer
            tabType="smartlogger"
            tenantId={selectedTenant}
            plantId={plantId}
          />
        </Tabs.Content>
      )}

      {isTabVisible('ess') && (
        <Tabs.Content value="essdata">
          <TabRenderer
            tabType="ess"
            tenantId={selectedTenant}
            plantId={plantId}
          />
        </Tabs.Content>
      )}

      {isTabVisible('plccontrol') && (
        <Tabs.Content value="control">
          <TabRenderer
            tabType="plccontrol"
            tenantId={selectedTenant}
            plantId={plantId}
          />
        </Tabs.Content>
      )}

      <Tabs.Content value="settings">
        <PLCDataSettingsTable tenantId={selectedTenant} />
        {/* <p>Control content will go here!</p> */}
      </Tabs.Content>
    </Tabs.Root>
  );
};

export default DashboardTabs;
