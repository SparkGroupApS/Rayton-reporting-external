// src/routes/_layout/index.tsx
import {
    Box, Container, Text, Heading, Grid, GridItem, Spinner, NativeSelect,
    Flex, Icon, Table, // Existing imports needed for sub-components
    SimpleGrid // Keep SimpleGrid for inside the KPI area if needed
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
import ChartSection from "@/components/Dashboard/_nused_ChartSection";
import ItemsSection from "@/components/Dashboard/ItemsSection";
import EnergyTrendChart from "@/components/Dashboard/EnergyTrendChart";
import DashboardHeader from "@/components/Dashboard/DashboardHeader";
import KpiSection from "@/components/Dashboard/KpiSection";

// --- Route Definition ---
export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
});

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

  // State for Chart Parameters
    const [endDate, setEndDate] = useState(new Date());
    const [startDate, setStartDate] = useState(() => {
        const date = new Date(); date.setDate(date.getDate() - 7); return date;
    });
    const [interval, setInterval] = useState<'hourly' | 'daily' | 'monthly'>('daily');

  const isPrivilegedUser = currentUser?.is_superuser || currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const { data: tenantsData, isLoading: isLoadingTenants } = useTenants({}, { enabled: !!isPrivilegedUser });
  const { data: dashboardData, isLoading: isLoadingDashboard, error } = useDashboardData(selectedTenant);

  useEffect(() => {
    if (currentUser && !selectedTenant) {
      setSelectedTenant(currentUser.tenant_id);
    }
  }, [currentUser, selectedTenant]);

  // Handle initial loading states
  if (!currentUser || (isPrivilegedUser && isLoadingTenants && !selectedTenant)) {
      return <Container py={8} centerContent><Spinner /> Loading user data...</Container>;
  }
  // Handle case where selectedTenant is still null after user loads (shouldn't happen with useEffect)
//   if (!selectedTenant) {
//      return <Container py={8} centerContent><Spinner /> Initializing...</Container>;
//   }

  // --- Render UI using Grid Layout ---
  return (
    <Container maxW="full" py={4}>
      {/* Header Row */}
      <DashboardHeader
        currentUser={currentUser}
        tenantsData={tenantsData}
        isLoadingTenants={isLoadingTenants} // Pass loading state
        selectedTenant={selectedTenant}
        setSelectedTenant={setSelectedTenant}
        isPrivilegedUser={isPrivilegedUser} // Pass role check
      />

      {/* Main Grid Layout */}
      <Grid
        templateAreas={{ // Define areas based on Layout.txt
          base: `"chart" "kpi" "items"`, // Stack on mobile
          md: `"chart chart" "kpi items"`, // 2x2 on medium screens
          lg: `"chart chart kpi" "chart chart items"`, // Desired large screen layout
        }}
        templateColumns={{ base: "1fr", md: "1fr 1fr", lg: "1fr 1fr 1fr" }} // Define column structure
        templateRows={{ lg: "auto 1fr" }} // Define rows for large layout
        gap={6} // Spacing between grid items
      >
        {/* Chart Area */}
        {/* <EnergyTrendChart 
            isLoading={isLoadingDashboard} 
            error={error} 
            // Pass data={dashboardData?.revenue} if ChartSection needs it later
        /> */}

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