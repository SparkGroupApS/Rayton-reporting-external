// src/routes/_layout/index.tsx
import { Container, Grid, Spinner } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { type ApiError, type DashboardData, DashboardService } from "@/client"
// --- END CHANGE 1 ---
import DashboardHeader from "@/components/Dashboard/DashboardHeader"
import EnergyTrendChart from "@/components/Dashboard/EnergyTrendChart"
import ItemsSection from "@/components/Dashboard/ItemsSection"
import KpiSection from "@/components/Dashboard/KpiSection"
import useAuth from "@/hooks/useAuth"
import { useTenants } from "@/hooks/useTenantQueries"

// --- Route Definition ---
export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
})

// Formats a Date object to a YYYY-MM-DD string (Helper removed, as it's now inside EnergyDashboard)

// --- Dashboard Hook (Keep as is) ---
const useDashboardData = (tenantId?: string | null) => {
  return useQuery<DashboardData, ApiError>({
    queryKey: ["dashboard", { tenantId: tenantId ?? "current" }],
    queryFn: () =>
      DashboardService.readDashboardData({
        tenantIdOverride: tenantId ?? undefined,
      }),
    enabled: !!tenantId,
  })
}

// --- Main Dashboard Component ---
function Dashboard() {
  const { user: currentUser } = useAuth()
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null)

  // --- CHANGE 2: Update Chart ID state ---
  // TODO: Replace '2502' with dynamic mapping from selectedTenant (UUID) to plant_id (int)
  const [_plantId, _setPlantId] = useState<number | null>(2502)

  // TODO: Replace with UI controls (e.g., checkboxes)
  const [energyDataIds, _setEnergyDataIds] = useState<number[]>([1, 2, 3, 4, 5])
  const [socDataId, _setSocDataId] = useState<number>(10) // New state for SOC
  // --- END CHANGE 2 ---

  const isPrivilegedUser =
    currentUser?.is_superuser ||
    currentUser?.role === "admin" ||
    currentUser?.role === "manager"
  const { data: tenantsData, isLoading: isLoadingTenants } = useTenants(
    {},
    { enabled: !!isPrivilegedUser },
  )
  const {
    data: dashboardData,
    isLoading: isLoadingDashboard,
    error,
  } = useDashboardData(selectedTenant)

  useEffect(() => {
    if (currentUser && !selectedTenant) {
      setSelectedTenant(currentUser.tenant_id)
    }
  }, [currentUser, selectedTenant])

  // TODO: Add logic here to update `plantId` when `selectedTenant` changes.

  if (
    !currentUser ||
    (isPrivilegedUser && isLoadingTenants && !selectedTenant)
  ) {
    return (
      <Container py={8} centerContent>
        <Spinner /> Loading user data...
      </Container>
    )
  }

  // --- Render UI using Grid Layout ---
  return (
    <Container maxW="full" py={4}>
      {/* Header Row */}
      <DashboardHeader
        currentUser={currentUser}
        tenantsData={tenantsData}
        isLoadingTenants={isLoadingTenants}
        selectedTenant={selectedTenant}
        setSelectedTenant={setSelectedTenant}
        isPrivilegedUser={isPrivilegedUser}
      />

      {/* Main Grid Layout */}
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
        {/* --- CHANGE 3: Render new Dashboard component --- */}
        {/* <EnergyDashboard
          tenantId={selectedTenant}
          plantId={plantId}
          dataIds={energyDataIds}
        /> */}
        <EnergyTrendChart
          tenantId={selectedTenant}
          energyDataIds={energyDataIds}
          socDataId={socDataId}
        />
        {/* --- END CHANGE 3 --- */}

        {/* KPI Cards Area */}
        <KpiSection isLoading={isLoadingDashboard} error={error} />

        {/* Items/Invoices Area */}
        <ItemsSection
          items={dashboardData?.items}
          isLoading={isLoadingDashboard}
          error={error}
        />
      </Grid>
    </Container>
  )
}
