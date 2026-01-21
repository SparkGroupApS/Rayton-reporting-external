// src/routes/_layout/tenant.tsx
import {
  Container,
  Flex,
  Heading,
  Spinner,
  Table,
  Text,
} from "@chakra-ui/react"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"

// Import client types, services, hooks
import { ApiError, TenantsService } from "@/client"
// Import standalone components
import AddTenant from "@/components/Admin/AddTenant" // Import the AddTenant modal
import { TenantActionsMenu } from "@/components/Common/TenantActionsMenu" // Import the new ActionsMenu
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination.tsx"
import useAuth from "@/hooks/useAuth"
import { useDeleteTenant } from "@/hooks/useTenantQueries"

//import { queryClient } from "@/main";

// --- Search Schema & Constants (like admin.tsx) ---
const tenantsSearchSchema = z.object({
  page: z.number().catch(1),
})
const PER_PAGE = 10

// --- Query Options Helper (like admin.tsx) ---
function getTenantsQueryOptions({ page }: { page: number }) {
  const queryParams = {
    skip: (page - 1) * PER_PAGE,
    limit: PER_PAGE,
  }
  return {
    queryFn: () => TenantsService.readTenants(queryParams),
    queryKey: ["tenants", { page }],
  }
}

// --- Route Definition (like admin.tsx) ---
export const Route = createFileRoute("/_layout/tenant")({
  component: TenantsPage,
  validateSearch: (search) => tenantsSearchSchema.parse(search),
  // beforeLoad: async () => {
  //     if (!isLoggedIn()) {
  //         throw redirect({ to: "/login" });
  //     }
  //     const user = queryClient.getQueryData<UserPublic>(["currentUser"]);
  //     if (!user?.is_superuser) {
  //         throw redirect({ to: "/" });
  //     }
  // },
})

// === TenantsTable Component (Defined internally, like UsersTable in admin.tsx) ===
function TenantsTable() {
  const navigate = useNavigate({ from: Route.fullPath })
  const { page } = Route.useSearch() // Use search from the route
  const { user: currentUser, isLoadingUser } = useAuth()

  const {
    data: tenantsData,
    isLoading,
    isPlaceholderData,
    error,
  } = useQuery({
    ...getTenantsQueryOptions({ page }),
    placeholderData: (prevData) => prevData,
    enabled: !isLoadingUser && !!currentUser?.is_superuser,
  })

  // Get mutation for displaying top-level errors if a delete fails
  const deleteTenantMutation = useDeleteTenant()

  const setPage = (newPage: number) => {
    navigate({
      search: (prev) => ({ ...prev, page: newPage }),
      replace: true,
    })
  }

  if (isLoadingUser || isLoading) {
    return (
      <Container py={8} centerContent>
        <Spinner /> Loading tenants...
      </Container>
    )
  }
  if (error) {
    return (
      <Container py={8}>
        <Text color="red.500">Error: {error.message}</Text>
      </Container>
    )
  }
  if (!currentUser?.is_superuser) {
    return (
      <Container py={8}>
        <Text color="red.500">Access Denied.</Text>
      </Container>
    )
  }

  const tenants = tenantsData?.data ?? []
  const count = tenantsData?.count ?? 0

  return (
    <>
      {deleteTenantMutation.isError && (
        <Text color="red.500" mb={4}>
          Error:
          {deleteTenantMutation.error instanceof ApiError &&
          typeof deleteTenantMutation.error.body === "object" &&
          deleteTenantMutation.error.body !== null &&
          "detail" in deleteTenantMutation.error.body
            ? String(deleteTenantMutation.error.body.detail)
            : deleteTenantMutation.error?.message}
        </Text>
      )}
      <Table.Root size={{ base: "sm", md: "md" }}>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader w="sm">Name</Table.ColumnHeader>
            <Table.ColumnHeader>Description</Table.ColumnHeader>
            <Table.ColumnHeader w="xs">Plant ID</Table.ColumnHeader>
            <Table.ColumnHeader w="sm">ID</Table.ColumnHeader>
            <Table.ColumnHeader w="sm">Actions</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {tenants.map((tenant) => (
            <Table.Row key={tenant.id} opacity={isPlaceholderData ? 0.5 : 1}>
              <Table.Cell fontWeight="medium">{tenant.name}</Table.Cell>
              <Table.Cell
                color={!tenant.description ? "gray.500" : "inherit"}
                maxW="lg"
                truncate
              >
                {" "}
                {tenant.description || "N/A"}{" "}
              </Table.Cell>
              <Table.Cell color={!tenant.plant_id ? "gray.500" : "inherit"}>
                {tenant.plant_id ?? "N/A"}
              </Table.Cell>
              <Table.Cell fontFamily="monospace" fontSize="xs">
                {tenant.id}
              </Table.Cell>
              <Table.Cell>
                {/* Use the imported Actions Menu */}
                <TenantActionsMenu tenant={tenant} />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
      <Flex justifyContent="flex-end" mt={4}>
        <PaginationRoot
          count={count}
          pageSize={PER_PAGE}
          page={page}
          onPageChange={({ page: newPage }) => setPage(newPage)}
        >
          <Flex>
            {" "}
            <PaginationPrevTrigger /> <PaginationItems />{" "}
            <PaginationNextTrigger />{" "}
          </Flex>
        </PaginationRoot>
      </Flex>
    </>
  )
}
// === End TenantsTable Component ===

// === Main Page Component (like Admin component in admin.tsx) ===
function TenantsPage() {
  return (
    <Container maxW="full">
      <Flex justify="space-between" align="center" mb={6} pt={12}>
        <Heading size="lg"> Tenant Management </Heading>
        <AddTenant /> {/* Use imported AddTenant */}
      </Flex>
      <TenantsTable /> {/* Use internal TenantsTable */}
    </Container>
  )
}
