// src/routes/_layout/plant-management.tsx
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
import { type PlantsResponse } from "@/hooks/usePlantQueries"
// Import standalone components
import AddPlant from "@/components/Admin/AddPlant"; // Import the AddPlant modal
import { PlantActionsMenu } from "@/components/Common/PlantActionsMenu"; // Import the new ActionsMenu
import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPrevTrigger,
  PaginationRoot,
} from "@/components/ui/pagination.tsx"
import useAuth from "@/hooks/useAuth"

//import { queryClient } from "@/main";

// --- Search Schema & Constants (like admin.tsx) ---
const plantsSearchSchema = z.object({
  page: z.number().catch(1),
})
const PER_PAGE = 10

// --- Query Options Helper (like admin.tsx) ---
function getPlantsQueryOptions({ page }: { page: number }) {
  const skip = (page - 1) * PER_PAGE;
  const limit = PER_PAGE;
  return {
    queryFn: async () => {
      const response = await fetch(`/api/v1/plants/?skip=${skip}&limit=${limit}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch plants");
      }
      return response.json() as Promise<PlantsResponse>;
    },
    queryKey: ["plants", "all", { page, limit }],
  }
}

// --- Route Definition (like admin.tsx) ---
export const Route = createFileRoute("/_layout/plant-management")({
//export const Route = createFileRoute("/_layout/tenant")({
  component: PlantsPage,
  validateSearch: (search) => plantsSearchSchema.parse(search),
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

// === PlantsTable Component (Defined internally, like UsersTable in admin.tsx) ===
function PlantsTable() {
  const navigate = useNavigate({ from: Route.fullPath })
  const { page } = Route.useSearch() // Use search from the route
  const { user: currentUser, isLoadingUser } = useAuth()

  const {
    data: plantsData,
    isLoading,
    isPlaceholderData,
    error,
  } = useQuery({
    ...getPlantsQueryOptions({ page }),
    placeholderData: (prevData) => prevData,
    enabled: !isLoadingUser && !!currentUser?.is_superuser,
  })

  const setPage = (newPage: number) => {
    navigate({
      search: (prev) => ({ ...prev, page: newPage }),
      replace: true,
    })
  }

  if (isLoadingUser || isLoading) {
    return (
      <Container py={8} centerContent>
        <Spinner /> Loading plants...
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

  const plants = plantsData?.data ?? []
  const count = plantsData?.count ?? 0

  return (
    <>
      <Table.Root size={{ base: "sm", md: "md" }}>
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeader w="sm">Plant ID</Table.ColumnHeader>
            <Table.ColumnHeader>Description</Table.ColumnHeader>
            <Table.ColumnHeader w="xs">Timezone</Table.ColumnHeader>
            <Table.ColumnHeader w="sm">Location</Table.ColumnHeader>
            <Table.ColumnHeader w="sm">Actions</Table.ColumnHeader>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {plants.map((plant) => (
            <Table.Row key={plant.ID} opacity={isPlaceholderData ? 0.5 : 1}>
              <Table.Cell fontWeight="medium">{plant.PLANT_ID}</Table.Cell>
              <Table.Cell
                color={!plant.TEXT_L1 && !plant.TEXT_L2 ? "gray.500" : "inherit"}
                maxW="lg"
                truncate
              >
                {plant.TEXT_L1 || plant.TEXT_L2 || "N/A"}
              </Table.Cell>
              <Table.Cell>{plant.timezone}</Table.Cell>
              <Table.Cell>
                {plant.latitude && plant.longitude ? `${plant.latitude}, ${plant.longitude}` : "N/A"}
              </Table.Cell>
              <Table.Cell>
                {/* Use the imported Actions Menu */}
                <PlantActionsMenu plant={plant} />
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
// === End PlantsTable Component ===

// === Main Page Component (like Admin component in admin.tsx) ===
function PlantsPage() {
  return (
    <Container maxW="full">
      <Flex justify="space-between" align="center" mb={6} pt={12}>
        <Heading size="lg"> Plant Management </Heading>
        <AddPlant /> {/* Use imported AddPlant */}
      </Flex>
      <PlantsTable /> {/* Use internal PlantsTable */}
    </Container>
  )
}
