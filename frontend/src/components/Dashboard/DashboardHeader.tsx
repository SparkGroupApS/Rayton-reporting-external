// src/components/Dashboard/DashboardHeader.tsx
import React from 'react';
import { Box, Flex, Heading, NativeSelect, Text } from "@chakra-ui/react";
import type { UserPublic, TenantPublic, TenantsPublic } from "@/client"; // Adjust path

// Define props needed by the header
interface DashboardHeaderProps {
    currentUser: UserPublic | null | undefined;
    tenantsData?: TenantsPublic | null; // Allow null or undefined
    isLoadingTenants: boolean; // Pass loading state
    selectedTenant: string | null;
    setSelectedTenant: (value: string | null) => void;
    isPrivilegedUser: boolean; // Pass role check result
}

const DashboardHeader = ({
    currentUser,
    tenantsData,
    isLoadingTenants, // Receive loading state
    selectedTenant,
    setSelectedTenant,
    isPrivilegedUser
}: DashboardHeaderProps) => {

    // Don't render anything if the user isn't loaded yet
    if (!currentUser) {
        return null;
    }

    return (
        <Flex justify="space-between" align="center" mb={6}>
            <Box>
                <Heading size="lg" color="teal.600">☀️ Dashboard</Heading>
                <Text fontSize="md" color="gray.600">
                    Welcome back, {currentUser?.full_name || currentUser?.email}!
                </Text>
            </Box>

            {/* Conditional Tenant Switcher */}
            {isPrivilegedUser && ( // Use the passed prop
                <NativeSelect.Root
                    maxWidth="300px"
                    // Show loading state or actual tenants
                    disabled={isLoadingTenants || !tenantsData}
                >
                    <NativeSelect.Field
                        value={selectedTenant ?? ""}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedTenant(e.target.value || null)}
                        placeholder={isLoadingTenants ? "Loading tenants..." : undefined} // Add placeholder for loading
                    >
                        {/* Only map options if tenantsData exists */}
                        {currentUser.tenant_id && <option key={currentUser.tenant_id} value={currentUser.tenant_id}>My Tenant</option>}
                        {tenantsData?.data?.filter(t => t.id !== currentUser.tenant_id).map((tenant: TenantPublic) => (
                            <option key={tenant.id} value={tenant.id}>
                                {tenant.name}
                            </option>
                        ))}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                </NativeSelect.Root>
            )}
        </Flex>
    );
};

export default DashboardHeader;