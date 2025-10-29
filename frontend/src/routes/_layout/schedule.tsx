// src/routes/_layout/schedule.tsx
import {
    Box, Container, Text, Heading, Grid, GridItem, Spinner, Flex,
    Input,
    HStack
} from "@chakra-ui/react";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect } from "react";

// --- Imports needed from your project ---
import useAuth from "@/hooks/useAuth";
import { useTenants } from "@/hooks/useTenantQueries";
import DashboardHeader from "@/components/Dashboard/DashboardHeader";
import ScheduleControlTable from "@/components/Dashboard/ScheduleControlTable"; // Assuming this path

// --- Helper function to format date ---
const toLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// --- Route Definition ---
export const Route = createFileRoute("/_layout/schedule")({
    component: SchedulePage,
});

// --- Main Schedule Page Component ---
function SchedulePage() {
    const { user: currentUser } = useAuth();
    const [selectedTenant, setSelectedTenant] = useState<string | null>(null);

    // --- This logic is copied from your index.tsx ---
    // TODO: This hardcoded plantId should eventually be dynamic
    //const [plantId, setPlantId] = useState<number | null>(2500);
    const [selectedDate, setSelectedDate] = useState<string>(toLocalDateString(new Date()));
    const isPrivilegedUser = currentUser?.is_superuser || currentUser?.role === 'admin' || currentUser?.role === 'manager';
    const { data: tenantsData, isLoading: isLoadingTenants } = useTenants({}, { enabled: !!isPrivilegedUser });

    useEffect(() => {
        if (currentUser && !selectedTenant) {
            setSelectedTenant(currentUser.tenant_id);
        }
    }, [currentUser, selectedTenant]);

    // TODO: Add logic here to update `plantId` when `selectedTenant` changes.

    // Handle initial loading states
    if (!currentUser || !selectedTenant || (isPrivilegedUser && isLoadingTenants)) {
        return <Container py={8} centerContent><Spinner /> Loading user data...</Container>;
    }
    // --- End copied logic ---

    return (
        <Container maxW="full" py={4}>
            {/* Header Row for tenant selection */}
            <DashboardHeader
                currentUser={currentUser}
                tenantsData={tenantsData}
                isLoadingTenants={isLoadingTenants}
                selectedTenant={selectedTenant}
                setSelectedTenant={setSelectedTenant}
                isPrivilegedUser={isPrivilegedUser}
            />

            {/* Schedule Table Section */}
            <Box mt={6} bg="white" shadow="sm" rounded="lg" p={4} borderWidth="1px">
                <HStack justify="space-between" mb={4}>
                    <Heading as="h2" size="lg">
                        Schedule Control
                    </Heading>
                    <Input
                        type="date"
                        size="md"
                        w="200px"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                    />
                </HStack>

                <ScheduleControlTable
                    tenantId={selectedTenant} // Pass the tenant UUID
                    date={selectedDate}
                />
            </Box>
        </Container>
    );
}