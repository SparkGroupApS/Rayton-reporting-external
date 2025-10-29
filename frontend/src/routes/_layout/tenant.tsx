// src/routes/tenant.tsx
import {
    Container, Heading, Button, Flex, Table, Spinner, Text, Badge, // Core layout & table
    VStack, Input, Textarea, Field, NativeSelect // Form components
} from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate, useSearch, Outlet, redirect } from "@tanstack/react-router";
import { z } from 'zod';
import React, { useState } from 'react'; // Import React, useState
import { useForm, type SubmitHandler } from 'react-hook-form'; // Import useForm for AddTenant
import { FaPlus } from "react-icons/fa"; // Or FaBuilding

// Import client types, services, hooks
import {
    TenantsService, TenantPublic, TenantsPublic, TenantCreate, ApiError, UserPublic
} from "@/client"; // Adjust path
import { useTenants, useCreateTenant, useDeleteTenant } from '@/hooks/useTenantQueries'; // Adjust path
import { TenantActionsMenu } from "@/components/Admin/TenantActionsMenu"; // Adjust path
import {
    PaginationItems, PaginationNextTrigger, PaginationPrevTrigger, PaginationRoot,
} from "@/components/ui/pagination.tsx"; // Adjust path
import useCustomToast from "@/hooks/useCustomToast"; // For AddTenant success/error
import { handleError } from "@/utils"; // For AddTenant error
// Import Dialog components (adjust path)
import {
    DialogActionTrigger, DialogBody, DialogCloseTrigger, DialogContent,
    DialogFooter, DialogHeader, DialogRoot, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"; // Adjust path
// Import Auth check
import { isLoggedIn } from "@/hooks/useAuth"; // Adjust path
import { queryClient } from "@/main"; // Adjust path

// --- Search Schema & Constants ---
const tenantsSearchSchema = z.object({
  page: z.number().catch(1),
  // Add other expected params like filterTenantId, filterAllTenants if applicable
});
const PER_PAGE = 10;

// --- Route Definition ---
export const Route = createFileRoute('/_layout/tenant')({
    component: TenantsPage,
    validateSearch: (search) => tenantsSearchSchema.parse(search),
    beforeLoad: async () => { // Auth check
        if (!isLoggedIn()) {
            throw redirect({ to: "/login" });
        }
        const user = queryClient.getQueryData<UserPublic>(["currentUser"]);
        if (!user?.is_superuser) {
            throw redirect({ to: "/" });
        }
    },
});

// === AddTenant Component (Defined within tenant.tsx) ===
type TenantFormData = {
    name: string;
    description?: string | null;
};

function AddTenant() {
    const [isOpen, setIsOpen] = useState(false);
    // No need for queryClient here if invalidation happens below
    const { showSuccessToast } = useCustomToast();
    const createTenantMutation = useCreateTenant(); // Use the hook

    const {
        register, handleSubmit, reset,
        formState: { errors, isValid, isSubmitting },
    } = useForm<TenantFormData>({ mode: "onBlur", defaultValues: { name: "", description: "" } });

    const onSubmit: SubmitHandler<TenantFormData> = (data) => {
        const tenantData: TenantCreate = {
            name: data.name,
            description: data.description === "" ? null : data.description,
        };
        createTenantMutation.mutate(tenantData, {
            onSuccess: () => {
                showSuccessToast("Tenant created successfully.");
                reset();
                setIsOpen(false);
                // Invalidation is handled within useCreateTenant hook
            },
            onError: (err: ApiError) => { handleError(err); }
        });
    };

    const handleOpenChange = ({ open }: { open: boolean }) => {
        setIsOpen(open); if (!open) { reset(); }
    };

    return (
        <DialogRoot size={{ base: "xs", md: "md" }} placement="center" open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button value="add-tenant" colorScheme="teal"> <FaPlus fontSize="16px" /> Add Tenant </Button>
            </DialogTrigger>
            <DialogContent>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <DialogHeader><DialogTitle>Add Tenant</DialogTitle></DialogHeader>
                    <DialogBody>
                        <Text mb={4}> Fill in the form below to add a new tenant. </Text>
                        <VStack gap={4}>
                            <Field.Root id="tenant-name-add" required invalid={!!errors.name}>
                                <Field.Label>Tenant Name</Field.Label>
                                <Input id="name" {...register("name", { required: "Name is required", maxLength: { value: 255, message: "Max 255 chars" } })} placeholder="Tenant Name" />
                                <Field.ErrorText>{errors.name && errors.name.message}</Field.ErrorText>
                            </Field.Root>
                            <Field.Root id="tenant-desc-add" invalid={!!errors.description}>
                                <Field.Label>Description (Optional)</Field.Label>
                                <Textarea id="description" {...register("description", { maxLength: { value: 1024, message: "Max 1024 chars" } })} placeholder="Tenant Description" />
                                <Field.ErrorText>{errors.description && errors.description.message}</Field.ErrorText>
                            </Field.Root>
                        </VStack>
                        {createTenantMutation.isError && (<Text color="red.500" fontSize="sm" mt={2}> Error: {(createTenantMutation.error instanceof ApiError && typeof createTenantMutation.error.body === 'object' && createTenantMutation.error.body !== null && 'detail' in createTenantMutation.error.body) ? String(createTenantMutation.error.body.detail) : createTenantMutation.error?.message} </Text>)}
                    </DialogBody>
                    <DialogFooter gap={2}>
                        <DialogActionTrigger asChild>
                            <Button variant="subtle" colorPalette="gray" disabled={isSubmitting} type="button" onClick={() => handleOpenChange({ open: false })}> Cancel </Button>
                        </DialogActionTrigger>
                        <Button variant="solid" colorScheme="teal" type="submit" disabled={!isValid || isSubmitting} loading={isSubmitting}> Save Tenant </Button>
                    </DialogFooter>
                </form>
                <DialogCloseTrigger />
            </DialogContent>
        </DialogRoot>
    );
}
// === End AddTenant Component ===


// === TenantsTable Component (Defined within tenant.tsx) ===
//type TenantTableSearch = { page?: number }; // Type for search params

function TenantsTable() {
    const navigate = useNavigate({ from: Route.fullPath });
    const { page = 1 } = useSearch({ from: Route.id });

    const { data: tenantsData, isLoading, isPlaceholderData, error } = useTenants({
        skip: (page - 1) * PER_PAGE, limit: PER_PAGE,
    });
    const deleteTenantMutation = useDeleteTenant(); // For error display

    const setPage = (newPage: number) => {
        navigate({ 
            // Use functional update to merge with potential (though undefined here) existing params
            search: (prev) => ({ ...prev, page: newPage }), 
            replace: true 
        });
    };

    if (isLoading) { return <Container py={8} centerContent><Spinner /> Loading tenants...</Container>; }
    if (error) { return <Container py={8}><Text color="red.500">Error loading tenants: {error.message}</Text></Container>; }

    const tenants = tenantsData?.data ?? [];
    const count = tenantsData?.count ?? 0;

    return (
        <>
            {deleteTenantMutation.isError && (<Text color="red.500" mb={4}> Error deleting tenant: {(deleteTenantMutation.error instanceof ApiError && typeof deleteTenantMutation.error.body === 'object' && deleteTenantMutation.error.body !== null && 'detail' in deleteTenantMutation.error.body) ? String(deleteTenantMutation.error.body.detail) : deleteTenantMutation.error?.message} </Text>)}
            <Table.Root size={{ base: "sm", md: "md" }}>
                <Table.Header>
                    <Table.Row>
                        <Table.ColumnHeader w="sm">Name</Table.ColumnHeader>
                        <Table.ColumnHeader>Description</Table.ColumnHeader>
                        <Table.ColumnHeader w="sm">ID</Table.ColumnHeader>
                        <Table.ColumnHeader w="sm">Actions</Table.ColumnHeader>
                    </Table.Row>
                </Table.Header>
                <Table.Body>
                    {tenants.map((tenant) => (
                        <Table.Row key={tenant.id} opacity={isPlaceholderData ? 0.5 : 1}>
                            <Table.Cell fontWeight="medium">{tenant.name}</Table.Cell>
                            <Table.Cell color={!tenant.description ? "gray.500" : "inherit"} maxW="lg" truncate> {tenant.description || "N/A"} </Table.Cell>
                            <Table.Cell fontFamily="monospace" fontSize="xs">{tenant.id}</Table.Cell>
                            <Table.Cell> <TenantActionsMenu tenant={tenant} /> </Table.Cell>
                        </Table.Row>
                    ))}
                </Table.Body>
            </Table.Root>
            <Flex justifyContent="flex-end" mt={4}>
                <PaginationRoot count={count} pageSize={PER_PAGE} page={page} onPageChange={({ page: newPage }) => setPage(newPage)}>
                    <Flex> <PaginationPrevTrigger /> <PaginationItems /> <PaginationNextTrigger /> </Flex>
                </PaginationRoot>
            </Flex>
        </>
    );
}
// === End TenantsTable Component ===


// === Main Page Component ===
function TenantsPage() {
    return (
        <Container maxW="full">
            <Flex justify="space-between" align="center" mb={6} pt={12}>
                <Heading size="lg"> Tenant Management </Heading>
                {/* Render the Add Tenant button/modal trigger */}
                <AddTenant />
            </Flex>
            {/* Render the Tenants Table */}
            <TenantsTable />
        </Container>
    );
}