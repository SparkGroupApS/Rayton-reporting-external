import { Badge, Container, Flex, Heading, Table } from "@chakra-ui/react"; // Keep existing imports
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";

// --- ADDED: Import TenantPublic type ---
import { type UserPublic, UsersService, TenantPublic } from "@/client"; 
import AddUser from "@/components/Admin/AddUser";
import { UserActionsMenu } from "@/components/Common/UserActionsMenu";
import PendingUsers from "@/components/Pending/PendingUsers";
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination.tsx";
// --- ADDED: Import tenant hook ---
import { useTenants } from "@/hooks/useTenantQueries"; // Adjust path if needed

const usersSearchSchema = z.object({
  page: z.number().catch(1),
  // NOTE: Keep tenant filters here if you still want superusers to filter the user list
  // If not, you can remove filterTenantId and filterAllTenants from schema and query options
  filterTenantId: z.string().optional(), 
  filterAllTenants: z.enum(['true', 'false']).catch('false').transform(v => v === 'true'),
});

const PER_PAGE = 5;

// Assuming you still want filtering capabilities
function getUsersQueryOptions({ 
    page, 
    tenantId, 
    allTenants 
}: { 
    page: number; 
    tenantId?: string | null; 
    allTenants?: boolean; 
}) {
  const queryParams = { 
    skip: (page - 1) * PER_PAGE, 
    limit: PER_PAGE,
    tenant_id: tenantId || undefined, 
    all_tenants: allTenants || undefined, 
  };
  
  return {
    queryFn: () => UsersService.readUsers(queryParams), // Make sure 'readUsers' is the correct method name
    queryKey: ["users", { page, tenantId: tenantId ?? "own", allTenants }], 
  };
}


// Assuming the file path is back to _layout/admin.tsx
export const Route = createFileRoute("/_layout/admin")({ 
  component: Admin,
  validateSearch: (search) => usersSearchSchema.parse(search),
});

function UsersTable() {
  const queryClient = useQueryClient();
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"]);
  const navigate = useNavigate({ from: Route.fullPath });
  const { page, filterTenantId, filterAllTenants } = Route.useSearch(); // Keep filters if needed

  // --- ADDED: Fetch tenants data ---
  const { data: tenantsData } = useTenants(); 
  // --- END ADDED ---

  const { data, isLoading, isPlaceholderData, error } = useQuery({ // Added 'error' handling
    ...getUsersQueryOptions({ 
      page, 
      // Keep filter logic if needed
      tenantId: filterAllTenants ? null : (filterTenantId ?? currentUser?.tenant_id), 
      allTenants: filterAllTenants 
    }),
    placeholderData: (prevData) => prevData,
    enabled: !!currentUser?.is_superuser, // Only superusers see this table? Adjust if needed
  });

  const setPage = (newPage: number) => { // Renamed parameter for clarity
    navigate({
      // Ensure navigation uses the correct path '/admin'
      search: (prev) => ({ ...prev, page: newPage }), 
      replace: true // Use replace for pagination
    });
  };

  // Keep handleFilterChange if you still have the filter dropdown UI (not shown in provided code)
  // const handleFilterChange = (tenantId: string | null, allTenants: boolean) => { ... }

  const users = data?.data.slice(0, PER_PAGE) ?? [];
  const count = data?.count ?? 0;

  if (isLoading) {
    return <PendingUsers />;
  }

  // --- ADDED: Basic error display ---
  if (error) {
    return <div>Error loading users: {error.message}</div>;
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
              <Table.Cell color={!user.full_name ? "gray.500" : "inherit"}> {/* Adjusted color */}
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
                {tenantsData?.data.find(t => t.id === user.tenant_id)?.name 
                 ?? user.tenant_id.substring(0, 8) + '...'} {/* Fallback to truncated ID */}
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
  );
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
  );
}