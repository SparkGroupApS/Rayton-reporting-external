// src/routes/_layout/plant_/$plantId.tsx
import { Container, Spinner } from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"
import { type ApiError, type DashboardData, DashboardService } from "@/client"
import DashboardTabs from "@/components/Dashboard/DashboardTabs"
import useAuth from "@/hooks/useAuth"
import { useTenants, useTenant } from "@/hooks/useTenantQueries"
import { useEffect } from "react"

// Define search schema with plantId as a path parameter
const plantSearchSchema = z.object({
  plantId: z.string().transform(Number), // Transform string to number
})

// Route Definition with path parameter validation
export const Route = createFileRoute("/_layout/plant_/$plantId")({
  component: PlantDashboard,
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

function PlantDashboard() {
  const { user: currentUser } = useAuth()
  const { plantId } = Route.useParams() // Get plantId from path parameters
  const navigate = useNavigate({ from: Route.fullPath })

  // Convert plantId to number
  const plantIdNumber = Number(plantId)

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

  // --- THE FIX: Correctly determine effectiveTenantId for all user types ---
  let effectiveTenantId: string | undefined;
  if (isPrivilegedUser) {
    // For privileged users, find the tenant ID from the plantId in the URL.
    effectiveTenantId = plantIdNumber
      ? tenantsData?.data.find((t) => t.plant_id === plantIdNumber)?.id
      : undefined; // No plantId selected, so no tenant.
  } else {
    // For regular users, the effective tenant is ALWAYS their own tenant.
    effectiveTenantId = currentUser?.tenant_id;
  }
  // --- END FIX ---

  // Determine effective plantId
 const effectivePlantId = plantIdNumber || userTenantData?.plant_id

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
    (isPrivilegedUser && isLoadingTenants && !plantIdNumber) ||
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
