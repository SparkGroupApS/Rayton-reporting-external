// src/routes/_layout/index.tsx
import {
  Box, Container, Text, Heading, Grid, GridItem, Spinner, NativeSelect,
  Flex, Icon, Table,
  SimpleGrid
} from "@chakra-ui/react";
import { createFileRoute, Link as RouterLink } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import React, { useState, useEffect } from "react";

import useAuth from "@/hooks/useAuth";
import { DashboardService, type DashboardData, type TenantPublic, type ItemPublic, ApiError } from "@/client";
import { useTenants } from "@/hooks/useTenantQueries";

// --- Icons ---
import { FiUsers, FiBox, FiActivity, FiAlertCircle, FiCheckCircle } from "react-icons/fi";
//import RevenueChartPlaceholder from "@/components/Dashboard/revenueChartPlaceholder";
//import LatestItemsTable from "@/components/Dashboard/latestItemsTable";
import StatCard from "@/components/Dashboard/statCard";
import ItemsSection from "@/components/Dashboard/ItemsSection";
// --- CHANGE 1: Remove old chart, import new dashboard ---
// import EnergyTrendChart from "@/components/Dashboard/EnergyTrendChart";
import EnergyDashboard from "@/components/Dashboard/EnergyDashboard"; // New
// --- END CHANGE 1 ---
import DashboardHeader from "@/components/Dashboard/DashboardHeader";
import KpiSection from "@/components/Dashboard/KpiSection";
import EnergyTrendChart from "@/components/Dashboard/EnergyTrendChart";

// --- Route Definition ---
export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
});

// Formats a Date object to a YYYY-MM-DD string (Helper removed, as it's now inside EnergyDashboard)

// --- Dashboard Hook (Keep as is) ---
const useDashboardData = (tenantId?: string | null) => {
  return useQuery<DashboardData, ApiError>({
    queryKey: ['dashboard', { tenantId: tenantId ?? 'current' }],
    queryFn: () => DashboardService.readDashboardData({ tenantIdOverride: tenantId ?? undefined }),
    enabled: !!tenantId,
  });
};

// --- Main Dashboard Component ---
function Dashboard() {
  const { user: currentUser } = useAuth();
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);

  // --- CHANGE 2: Update Chart ID state ---
  // TODO: Replace '2502' with dynamic mapping from selectedTenant (UUID) to plant_id (int)
  const [plantId, setPlantId] = useState<number | null>(2502);

  // TODO: Replace with UI controls (e.g., checkboxes)
  const [energyDataIds, setEnergyDataIds] = useState<number[]>([1, 2, 3, 4, 5]);
  const [socDataId, setSocDataId] = useState<number>(10); // New state for SOC
  // --- END CHANGE 2 ---

  const isPrivilegedUser = currentUser?.is_superuser || currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const { data: tenantsData, isLoading: isLoadingTenants } = useTenants({}, { enabled: !!isPrivilegedUser });
  const { data: dashboardData, isLoading: isLoadingDashboard, error } = useDashboardData(selectedTenant);

  useEffect(() => {
    if (currentUser && !selectedTenant) {
      setSelectedTenant(currentUser.tenant_id);
    }
  }, [currentUser, selectedTenant]);

  // TODO: Add logic here to update `plantId` when `selectedTenant` changes.

  if (!currentUser || (isPrivilegedUser && isLoadingTenants && !selectedTenant)) {
    return <Container py={8} centerContent><Spinner /> Loading user data...</Container>;
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
          plantId={plantId}
          energyDataIds={energyDataIds}
          socDataId={socDataId}
        />
        {/* --- END CHANGE 3 --- */}

        {/* KPI Cards Area */}
        <KpiSection
          isLoading={isLoadingDashboard}
          error={error}
        />

        {/* Items/Invoices Area */}
        <ItemsSection
          items={dashboardData?.items}
          isLoading={isLoadingDashboard}
          error={error}
        />
      </Grid>
    </Container>
  );
}