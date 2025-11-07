// src/components/Dashboard/DashboardTabs.tsx
import {
  Box,
  Grid,
  Spinner,
  Tabs, // Import the main Tabs namespace
} from "@chakra-ui/react"
import type { ApiError, DashboardData } from "@/client"
import { useNavigate } from "@tanstack/react-router"
import EnergyTrendChart from "./EnergyTrendChart"
import ItemsSection from "./ItemsSection"
import KpiSection from "./KpiSection"
import ScheduleTab from "./ScheduleTab"
import Smartlogger from "./Smartlogger"
import ESS from "./ESS"
import { useEffect, useState } from "react"

// Define the props this component needs
interface DashboardTabsProps {
  isLoadingDashboard: boolean
  dashboardData: DashboardData | undefined
  error: ApiError | null
  selectedTenant: string | null
  energyDataIds: number[] // <-- UPDATED type
  socDataId: number       // <-- UPDATED type
  initialTab?: string     // <-- Add initialTab prop to receive tab from route
}

const DashboardTabs = ({
  isLoadingDashboard,
  dashboardData,
  error,
  selectedTenant,
  energyDataIds,
  socDataId,
  initialTab = "main"     // Default to main tab
}: DashboardTabsProps) => {
  // Initialize activeTab from the prop passed from the route, default to "main"
  const [activeTab, setActiveTab] = useState(initialTab)

  const navigate = useNavigate()

  // Update the URL when activeTab changes
  useEffect(() => {
    navigate({
      to: ".",
      search: (prev: any) => ({
        ...prev,
        tab: activeTab
      }),
      replace: true // Replace history instead of pushing to avoid back button issues
    })
  }, [activeTab, navigate])

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

  // Function to handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value)
  }

  // Use the v3 namespaced syntax
  return (
    <Tabs.Root colorScheme="blue" mt={4} value={activeTab}>
      <Tabs.List>
        <Tabs.Trigger value="main" onClick={() => handleTabChange("main")}>Головна</Tabs.Trigger>
        <Tabs.Trigger value="schedule" onClick={() => handleTabChange("schedule")}>Розклад</Tabs.Trigger>
        <Tabs.Trigger value="smdata" onClick={() => handleTabChange("smdata")}>СЕС</Tabs.Trigger>
        <Tabs.Trigger value="essdata" onClick={() => handleTabChange("essdata")}>УЗЕ</Tabs.Trigger>
        <Tabs.Trigger value="control" onClick={() => handleTabChange("control")}>Керування</Tabs.Trigger>
        {/* Add more tabs as needed */}
      </Tabs.List>

      {/* Panel 1: Your existing Dashboard Grid */}
      <Tabs.Content value="main" px={0} py={6}>
        <Grid
          templateAreas={{
            base: `"chart" "kpi" "items"`,
            md: `"chart chart" "kpi items"`,
            lg: `"chart chart chart kpi" "chart chart chart items"`,
          }}
          templateColumns={{ base: "1fr", md: "1fr 1fr", lg: "1fr 1fr 1fr 1fr" }}
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

      <Tabs.Content value="schedule">
        <ScheduleTab tenantId={selectedTenant} />
      </Tabs.Content>

      <Tabs.Content value="smdata">
        <Smartlogger tenantId={selectedTenant}/>
      </Tabs.Content>

      <Tabs.Content value="essdata">
       {/* <Box p={4}>
          <p>SmartLogger Data content will go here!</p>
        </Box>*/}
        <ESS tenantId={selectedTenant}/>
      </Tabs.Content>

      <Tabs.Content value="control">
       <Box p={4}>
          <p>Settings content will go here!</p>
        </Box>
      </Tabs.Content>

    </Tabs.Root>
  )
}

export default DashboardTabs
