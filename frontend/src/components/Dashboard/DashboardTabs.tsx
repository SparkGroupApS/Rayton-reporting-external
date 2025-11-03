// src/components/Dashboard/DashboardTabs.tsx
import {
  Box,
  Grid,
  Spinner,
  Tabs, // Import the main Tabs namespace
} from "@chakra-ui/react"
import type { ApiError, DashboardData } from "@/client"
import EnergyTrendChart from "./EnergyTrendChart"
import ItemsSection from "./ItemsSection"
import KpiSection from "./KpiSection"
import ScheduleTab from "./ScheduleTab"
import Smartlogger from "./Smartlogger"

// Define the props this component needs
interface DashboardTabsProps {
  isLoadingDashboard: boolean
  dashboardData: DashboardData | undefined
  error: ApiError | null
  selectedTenant: string | null
  energyDataIds: number[] // <-- UPDATED type
  socDataId: number       // <-- UPDATED type
}

const DashboardTabs = ({
  isLoadingDashboard,
  dashboardData,
  error,
  selectedTenant,
  energyDataIds,
  socDataId,
}: DashboardTabsProps) => {
  if (isLoadingDashboard) {
    return (
      <Box display="flex" justifyContent="center" py={10}>
        <Spinner />
      </Box>
    )
  }

  // This check is perfect. If no tenant, we can't show anything.
  if (!selectedTenant) {
    return <Box>Please select a tenant to view data.</Box>
  }

  // Use the v3 namespaced syntax
  return (
    <Tabs.Root colorScheme="blue" mt={4} defaultValue="main">
      <Tabs.List>
        <Tabs.Trigger value="main">Main Dashboard</Tabs.Trigger>
        <Tabs.Trigger value="schedule">Schedule</Tabs.Trigger>
        <Tabs.Trigger value="smdata">SmartLogger Data</Tabs.Trigger>
        <Tabs.Trigger value="essdata">ESS Data</Tabs.Trigger>
        {/* Add more tabs as needed */}
      </Tabs.List>

      {/* Panel 1: Your existing Dashboard Grid */}
      <Tabs.Content value="main" px={0} py={6}>
        <Grid
          templateAreas={{
            base: `"chart" "kpi" "items"`,
            md: `"chart chart" "kpi items"`,
            lg: `"chart chart kpi" "chart chart items"`,
          }}
          templateColumns={{ base: "1fr", md: "1fr 1fr", lg: "1fr 1fr 1fr" }}
          templateRows={{ lg: "auto 1fr" }}
          gap={6}
        >
          {/* All components are now rendered inside here */}
          <EnergyTrendChart
            tenantId={selectedTenant}
            energyDataIds={energyDataIds} // <-- Use the prop
            socDataId={socDataId}         // <-- Use the prop
          />

          <KpiSection isLoading={isLoadingDashboard} error={error} />

          <ItemsSection
            items={dashboardData?.items}
            //users={dashboardData?.users} // <-- Pass users prop
            isLoading={isLoadingDashboard}
          // error={error} // <-- ItemsSection doesn't seem to take an error prop
          />
        </Grid>
      </Tabs.Content>

      {/* Panel 2: Placeholder for future content */}
      <Tabs.Content value="schedule">
        <ScheduleTab tenantId={selectedTenant} />
      </Tabs.Content>

      {/* Panel 3: Placeholder for future content */}
      <Tabs.Content value="smdata">
       {/* <Box p={4}>
          <p>SmartLogger Data content will go here!</p>
        </Box>*/}
        <Smartlogger tenantId={selectedTenant}/>

      </Tabs.Content>

      {/* Panel 4: Placeholder for future content */}
      <Tabs.Content value="essdata">
        <Box p={4}>
          <p>ESS Data content will go here!</p>
        </Box>
      </Tabs.Content>

    </Tabs.Root>
  )
}

export default DashboardTabs