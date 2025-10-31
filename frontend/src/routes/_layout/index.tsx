// src/routes/_layout/index.tsx
import { Container, Spinner } from "@chakra-ui/react" // <-- Grid is removed
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { type ApiError, type DashboardData, DashboardService } from "@/client"
import DashboardHeader from "@/components/Dashboard/DashboardHeader"
// --- REMOVE THESE ---
// import EnergyTrendChart from "@/components/Dashboard/EnergyTrendChart"
// import ItemsSection from "@/components/Dashboard/ItemsSection"
// import KpiSection from "@/components/Dashboard/KpiSection"
// --- ADD THIS ---
import DashboardTabs from "@/components/Dashboard/DashboardTabs" // <-- Import new component
import useAuth from "@/hooks/useAuth"
import { useTenants } from "@/hooks/useTenantQueries"

// --- Route Definition (no change) ---
export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
})

// --- Dashboard Hook (no change) ---
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

  // --- Your new state for IDs (This is great!) ---
  // TODO: Replace '2502' with dynamic mapping from selectedTenant (UUID) to plant_id (int)
  const [_plantId, _setPlantId] = useState<number | null>(2502)
  // TODO: Replace with UI controls (e.g., checkboxes)
  const [energyDataIds, _setEnergyDataIds] = useState<number[]>([1, 2, 3, 4, 5])
  const [socDataId, _setSocDataId] = useState<number>(10)
  // --- End ---

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

  // --- Render UI (MODIFIED) ---
  return (
    <Container maxW="full" py={4}>
      {/* Header Row (no change) */}
      <DashboardHeader
        currentUser={currentUser}
        tenantsData={tenantsData}
        isLoadingTenants={isLoadingTenants}
        selectedTenant={selectedTenant}
        setSelectedTenant={setSelectedTenant}
        isPrivilegedUser={isPrivilegedUser}
      />

      {/* --- REPLACE THE ENTIRE <Grid> with <DashboardTabs> --- */}
      <DashboardTabs
        isLoadingDashboard={isLoadingDashboard}
        dashboardData={dashboardData}
        error={error}
        selectedTenant={selectedTenant}
        energyDataIds={energyDataIds} // <-- Pass your number[] state
        socDataId={socDataId}         // <-- Pass your number state
      />
      {/* --- OLD GRID IS GONE --- */}
    </Container>
  )
}