import { Badge, Container, Flex, Heading, Table } from "@chakra-ui/react" // Keep existing imports
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "zod"

// --- ADDED: Import TenantPublic type ---
import { UsersService } from "@/client"
import AddUser from "@/components/Admin/AddUser"
import { UserActionsMenu } from "@/components/Common/UserActionsMenu"
import PendingUsers from "@/components/Pending/PendingUsers"
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination.tsx"
import useAuth from "@/hooks/useAuth" // --- IMPORT useAuth ---
// --- ADDED: Import tenant hook ---
import { useTenants } from "@/hooks/useTenantQueries" // Adjust path if needed

const usersSearchSchema = z.object({
  page: z.number().catch(1),
  // Keep filterTenantId if you plan to add tenant filtering UI
  filterTenantId: z.string().optional(),
  // filterAllTenants: z.enum(['true', 'false']).catch('true').transform(v => v === 'true'), // REMOVE
})

const PER_PAGE = 5

// Assuming you still want filtering capabilities
function _getUsersQueryOptions({
  page,
  tenantId,
  allTenants,
}: {
  page: number
  tenantId?: string | null
  allTenants?: boolean
}) {
  const queryParams = {
    skip: (page - 1) * PER_PAGE,
    limit: PER_PAGE,
    tenant_id: tenantId || undefined,
    all_tenants: allTenants || undefined,
  }

  return {
    queryFn: () => UsersService.readUsers(queryParams), // Make sure 'readUsers' is the correct method name
    queryKey: ["users", { page, tenantId: tenantId ?? "own", allTenants }],
  }
}

// Assuming the file path is back to _layout/admin.tsx
export const Route = createFileRoute("/_layout/admin")({
  component: Admin,
  validateSearch: (search) => usersSearchSchema.parse(search),
})

function UsersTable() {
  const { user: currentUser, isLoadingUser } = useAuth()
  // const queryClient = useQueryClient(); // Can remove if not needed elsewhere
  // const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"]); // REMOVE
  const navigate = useNavigate({ from: Route.fullPath })
  const { page, filterTenantId } = Route.useSearch()
  const { data: tenantsData } = useTenants()

  const isSuperUser = !!currentUser?.is_superuser
  const shouldFetchAll = isSuperUser && !filterTenantId
  const targetTenantId = shouldFetchAll ? null : filterTenantId

  const { data, isLoading, isPlaceholderData, error } = useQuery({
    // queryKey includes all calculated params
    queryKey: [
      "users",
      { page, tenantId: targetTenantId ?? "all", allTenants: shouldFetchAll },
    ],
    queryFn: () => {
      // --- FIX: Use camelCase keys ---
      const currentQueryParams = {
        skip: (page - 1) * PER_PAGE,
        limit: PER_PAGE,
        tenantId: targetTenantId || undefined, // Use tenantId (camelCase)
        allTenants: shouldFetchAll || undefined, // Use allTenants (camelCase)
      }
      // --- END FIX ---

      return UsersService.readUsers(currentQueryParams)
    },
    placeholderData: (prevData) => prevData,
    enabled: !isLoadingUser && isSuperUser,
  })

  const setPage = (newPage: number) => {
    // Renamed parameter for clarity
    navigate({
      // Ensure navigation uses the correct path '/admin'
      search: (prev) => ({ ...prev, page: newPage }),
      replace: true, // Use replace for pagination
    })
  }

  // Keep handleFilterChange if you still have the filter dropdown UI (not shown in provided code)
  // const handleFilterChange = (tenantId: string | null, allTenants: boolean) => { ... }

  const users = data?.data.slice(0, PER_PAGE) ?? []
  const count = data?.count ?? 0

  if (isLoadingUser || isLoading) {
    return <PendingUsers />
  }

  // --- ADDED: Basic error display ---
  if (error) {
    return <div>Error loading users: {error.message}</div>
  }
  // --- END ADDED ---

  return (
    <>
      {/* If you have filter controls, they would go here */}

      <Table.Root size={{ base: "sm", md: "md" }}>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader w="sm">Full name</Table.ColumnHeader>
            <Table.ColumnHeader w="sm">Email</Table.ColumnHeader>
            {/* --- ADDED: Tenant Header --- */}
            <Table.ColumnHeader w="sm">Tenant</Table.ColumnHeader>
            {/* --- END ADDED --- */}
            <Table.ColumnHeader w="sm">Role</Table.ColumnHeader>
            <Table.ColumnHeader w="sm">Status</Table.ColumnHeader>
            <Table.ColumnHeader w="sm">Actions</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {users?.map((user) => (
            <Table.Row key={user.id} opacity={isPlaceholderData ? 0.5 : 1}>
              <Table.Cell color={!user.full_name ? "gray.500" : "inherit"}>
                {" "}
                {/* Adjusted color */}
                {user.full_name || "N/A"}
                {currentUser?.id === user.id && (
                  <Badge ml="1" colorScheme="teal">
                    You
                  </Badge>
                )}
              </Table.Cell>
              <Table.Cell truncate maxW="sm">
                {user.email}
              </Table.Cell>
              {/* --- ADDED: Tenant Cell --- */}
              <Table.Cell>
                {/* Find tenant name from fetched tenantsData */}
                {tenantsData?.data.find((t) => t.id === user.tenant_id)?.name ??
                  `${user.tenant_id.substring(0, 8)}...`}{" "}
                {/* Fallback to truncated ID */}
              </Table.Cell>
              {/* --- END ADDED --- */}
              <Table.Cell>
                {user.is_superuser ? "Superuser" : "User"}
              </Table.Cell>
              <Table.Cell>{user.is_active ? "Active" : "Inactive"}</Table.Cell>
              <Table.Cell>
                <UserActionsMenu
                  user={user}
                  disabled={currentUser?.id === user.id}
                />
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
      <Flex justifyContent="flex-end" mt={4}>
        <PaginationRoot
          count={count}
          pageSize={PER_PAGE}
          page={page} // Pass current page state
          onPageChange={({ page: newPage }) => setPage(newPage)} // Update page state
        >
          <Flex>
            <PaginationPrevTrigger />
            <PaginationItems />
            <PaginationNextTrigger />
          </Flex>
        </PaginationRoot>
      </Flex>
    </>
  )
}

// Main Admin component remains the same
function Admin() {
  return (
    <Container maxW="full">
      <Heading size="lg" pt={12}>
        Users Management
      </Heading>
      <AddUser />
      <UsersTable />
    </Container>
  )
}
