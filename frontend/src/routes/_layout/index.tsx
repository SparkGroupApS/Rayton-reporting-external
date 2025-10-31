// src/routes/_layout/index.tsx
import { Container, Spinner } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { type ApiError, type DashboardData, DashboardService } from "@/client"
import DashboardTabs from "@/components/Dashboard/DashboardTabs"
import useAuth from "@/hooks/useAuth"
import { useTenants, useTenant } from "@/hooks/useTenantQueries"

// Define search schema with plantId
const dashboardSearchSchema = z.object({
  plantId: z.number().optional(),
})

// Route Definition with search validation
export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  validateSearch: (search) => dashboardSearchSchema.parse(search),
})

// Dashboard Hook - now accepts plantId instead of tenantId
const useDashboardData = (plantId?: number | null) => {
  return useQuery<DashboardData, ApiError>({
    queryKey: ["dashboard", { plantId: plantId ?? "current" }],
    queryFn: () =>
      DashboardService.readDashboardData({
        tenantIdOverride: undefined, // We'll modify backend to use plantId
      }),
    enabled: !!plantId,
  })
}

function Dashboard() {
  const { user: currentUser } = useAuth()
  const { plantId } = Route.useSearch() // Get plantId from URL

  // Determine if user is privileged
  const isPrivilegedUser =
    currentUser?.is_superuser ||
    currentUser?.role === "admin" ||
    currentUser?.role === "manager"

  // Fetch all tenants (for privileged users to map plantId to tenantId)
  const { data: tenantsData, isLoading: isLoadingTenants } = useTenants(
    {},
    { enabled: !!isPrivilegedUser }
  )

  // Get user's tenant
    // --- THE FIX: Use the correct hook to fetch a single tenant ---
  // This is much more efficient than fetching a list and filtering.
  const { data: userTenantData, isLoading: isLoadingUserTenant } = useTenant(
    currentUser?.tenant_id ?? null,
  )
  // --- END FIX ---

  // Determine effective plantId and tenantId
  const effectivePlantId = plantId || userTenantData?.plant_id
  const effectiveTenantId = plantId
    ? tenantsData?.data.find((t) => t.plant_id === plantId)?.id
    : currentUser?.tenant_id

  // Fetch dashboard data
  const {
    data: dashboardData,
    isLoading: isLoadingDashboard,
    error,
  } = useDashboardData(effectivePlantId)

  // Configuration for chart data IDs
  const energyDataIds = [1, 2, 3, 4, 5]
  const socDataId = 10

  // Loading state
  if (
    !currentUser ||
    (isPrivilegedUser && isLoadingTenants && !plantId) ||
    isLoadingUserTenant
  ) {
    return (
      <Container py={8} centerContent>
        <Spinner /> Loading dashboard...
      </Container>
    )
  }

  // No plant ID available
  if (!effectivePlantId) {
    return (
      <Container py={8} centerContent>
        No plant assigned to your account. Please contact administrator.
      </Container>
    )
  }

  return (
    <Container maxW="full" py={4}>
      {/* Render tabs with plantId and tenantId */}
      <DashboardTabs
        isLoadingDashboard={isLoadingDashboard}
        dashboardData={dashboardData}
        error={error}
        selectedTenant={effectiveTenantId ?? null}
        energyDataIds={energyDataIds}
        socDataId={socDataId}
      />
    </Container>
  )
}