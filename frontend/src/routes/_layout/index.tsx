// src/routes/_layout/index.tsx
import { Container, Spinner } from "@chakra-ui/react"
import { useQuery,  } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import { type ApiError, type DashboardData, DashboardService } from "@/client"
import DashboardTabs from "@/components/Dashboard/DashboardTabs"
import useAuth from "@/hooks/useAuth"
import { useTenants, useTenant } from "@/hooks/useTenantQueries"
import { useEffect } from "react"

// Define search schema with plantId and tab
const dashboardSearchSchema = z.object({
  plantId: z.number().optional(),
  tab: z.string().optional(),
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
  const { plantId, tab } = Route.useSearch() // Get plantId and tab from URL
  const navigate = useNavigate({ from: Route.fullPath }) // --- 2. Get the navigate function ---

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
   const { data: userTenantData, isLoading: isLoadingUserTenant } = useTenant(
    currentUser?.tenant_id ?? null,
  )

  // --- 3. ADD THIS useEffect HOOK ---
   useEffect(() => {
    // This effect syncs the URL for a regular user after login.
    // It runs when the user's tenant data is loaded.

    // Condition 1: Only run for regular users.
    // Condition 2: We must have the user's tenant data, specifically the plant_id.
    // Condition 3: The URL's plantId must not already be correct (prevents loops).
    if (
      !isPrivilegedUser &&
      userTenantData?.plant_id &&
      plantId !== userTenantData.plant_id
    ) {
      // Perform a "replace" navigation to update the URL without adding to browser history.
      navigate({
        to: "/plant/$plantId",
        params: { plantId: userTenantData.plant_id.toString() },
        search: (prev: any) => ({ ...prev, tab: tab }), // Preserve the tab parameter
        replace: true, // This is important for a clean user history
      })
    }
  }, [
    isPrivilegedUser,
    userTenantData,
    plantId,
    navigate,
    tab,
  ]) // Dependencies for the effect

  // --- THE FIX: Correctly determine effectiveTenantId for all user types ---
  let effectiveTenantId: string | undefined;
  if (isPrivilegedUser) {
    // For privileged users, find the tenant ID from the plantId in the URL.
    effectiveTenantId = plantId
      ? tenantsData?.data.find((t) => t.plant_id === plantId)?.id
      : undefined; // No plantId selected, so no tenant.
  } else {
    // For regular users, the effective tenant is ALWAYS their own tenant.
    effectiveTenantId = currentUser?.tenant_id;
  }
  // --- END FIX ---

  // Determine effective plantId
  const effectivePlantId = plantId || userTenantData?.plant_id

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
        initialTab={tab || "main"} // Pass the tab from URL search params
      />
    </Container>
  )
}
