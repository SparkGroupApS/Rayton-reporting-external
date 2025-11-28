// frontend/src/components/Common/SidebarItems.tsx
import { Box, Flex, Icon, Separator, Spinner, Text } from "@chakra-ui/react"
import { useQueryClient } from "@tanstack/react-query"
import { Link as RouterLink } from "@tanstack/react-router"
import { useMemo } from "react"
import { FaBuilding, FaSolarPanel } from "react-icons/fa"
import { FiSettings, FiUsers } from "react-icons/fi"
import type { IconType } from "react-icons/lib"

import type { TenantPublic, UserPublic } from "@/client"
import { useTenant, useTenants } from "@/hooks/useTenantQueries"


interface SidebarItemsProps {
  onClose?: () => void
}

interface SidebarItem {
  icon: IconType
  title: string
  path: string
}

const SidebarItems = ({ onClose }: SidebarItemsProps) => {
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])

  // Check if user is privileged
  const isPrivilegedUser =
    currentUser &&
    (currentUser.is_superuser ||
      currentUser.role === "admin" ||
      currentUser.role === "manager")

  // Fetch all tenants if privileged user
  const { data: tenantsData, isLoading: isLoadingTenants } = useTenants(
    {},
    { enabled: !!isPrivilegedUser },
  )

  const { data: userTenant, isLoading: isLoadingUserTenant } = useTenant(
    currentUser?.tenant_id ?? null,
    {
      // Only run this query if the user is NOT privileged and has a tenant_id
      enabled: !isPrivilegedUser && !!currentUser?.tenant_id,
    },
  )
  // Fetch current user's tenant details
  //const currentUserTenantId = currentUser?.tenant_id
  // const userTenant = useMemo(() => {
  //   if (!currentUserTenantId || !tenantsData) return null
  //   return tenantsData.data.find((t: TenantPublic) => t.id === currentUserTenantId)
  // }, [currentUserTenantId, tenantsData])

  // Build dynamic plant menu items
  const plantItems = useMemo((): SidebarItem[] => {
    if (isPrivilegedUser && tenantsData) {
      // For superuser: create items for all tenants with plant_id
      return tenantsData.data
        .filter((tenant: TenantPublic) => tenant.plant_id)
         .map((tenant: TenantPublic) => ({
          icon: FaSolarPanel,
          title: tenant.name,
          path: `/plant/${tenant.plant_id}`,
        }))
    } else if (userTenant?.plant_id) {
      // For regular user: create single item for their tenant's plant
      return [
        {
          icon: FaSolarPanel,
          title: userTenant.name,
          path: `/plant/${userTenant.plant_id}`,
        },
      ]
    }
    return []
  }, [isPrivilegedUser, tenantsData, userTenant])

  // Static items available to all users
  const staticItems: SidebarItem[] = [
    // { icon: FiSettings, title: "User Settings", path: "/settings" },
  ]

  // Admin-only items
  //  const adminItems: SidebarItem[] = isPrivilegedUser
 const shouldShowAdminItems =
    isPrivilegedUser && currentUser?.email !== "solar@rayton.com.ua"
  const adminItems: SidebarItem[] = shouldShowAdminItems
    ? [
        { icon: FiUsers, title: "User Management", path: "/admin" },
        { icon: FaBuilding, title: "Tenant Management", path: "/tenant" },
        { icon: FaSolarPanel, title: "Plant Management", path: "/plant-management" },
      ]
    : []

  // Combine all items: admin items first, then plant items, then static items
  const allItems = [...adminItems, ...plantItems, ...staticItems]

  // Show loading state while fetching tenant data
  const isLoading = isLoadingTenants || isLoadingUserTenant

  // Show loading state while fetching tenant data
  if (isLoading) {
    return (
      <Box px={4} py={2}>
        <Flex align="center" gap={2}>
          <Spinner size="sm" />
          <Text fontSize="sm">Loading menu...</Text>
        </Flex>
      </Box>
    )
  }

  return (
    <>
      <Text
        fontSize="xs"
        px={4}
        py={2}
        fontWeight="bold"
        textTransform="uppercase"
        color="gray.500"
      >
        Menu
      </Text>
      <Box px={2} mt={2}>
        {/* Render Admin Items */}
        {adminItems.map(({ icon, title, path }) => (
          <RouterLink key={path} to={path} onClick={onClose}>
             {({ isActive }: { isActive: boolean }) => (
              <Flex
                gap={4}
                px={4}
                py={2}
                bg={isActive ? "rayton_orange.50" : "transparent"}
                color={isActive ? "rayton_orange.700" : "inherit"}
                fontWeight={isActive ? "semibold" : "normal"}
                _hover={{ background: "gray.100" }}
                alignItems="center"
                fontSize="sm"
                borderRadius="md"
                my={1}
              >
                <Icon as={icon} alignSelf="center" boxSize="4" />
                <Text ml={2}>{title}</Text>
              </Flex>
            )}
          </RouterLink>
        ))}

        {/* Separator after Admin Items */}
        {adminItems.length > 0 && plantItems.length > 0 && <Separator my={2} />}

        {/* Render Plant Items */}
        {plantItems.map(({ icon, title, path }) => (
          <RouterLink key={path} to={path} onClick={onClose}>
             {({ isActive }: { isActive: boolean }) => (
              <Flex
                gap={4}
                px={4}
                py={2}
                bg={isActive ? "rayton_orange.50" : "transparent"}
                color={isActive ? "rayton_orange.700" : "inherit"}
                fontWeight={isActive ? "semibold" : "normal"}
                _hover={{ background: "gray.100" }}
                alignItems="center"
                fontSize="sm"
                borderRadius="md"
                my={1}
              >
                <Icon as={icon} alignSelf="center" boxSize="4" />
                <Text ml={2}>{title}</Text>
              </Flex>
            )}
          </RouterLink>
        ))}

        {/* Separator after Plant Items */}
        {plantItems.length > 0 && staticItems.length > 0 && <Separator my={2} />}

        {/* Render Static Items */}
        {staticItems.map(({ icon, title, path }) => (
          <RouterLink key={path} to={path} onClick={onClose}>
             {({ isActive }: { isActive: boolean }) => (
              <Flex
                gap={4}
                px={4}
                py={2}
                bg={isActive ? "rayton_orange.50" : "transparent"}
                color={isActive ? "rayton_orange.700" : "inherit"}
                fontWeight={isActive ? "semibold" : "normal"}
                _hover={{ background: "gray.100" }}
                alignItems="center"
                fontSize="sm"
                borderRadius="md"
                my={1}
              >
                <Icon as={icon} alignSelf="center" boxSize="4" />
                <Text ml={2}>{title}</Text>
              </Flex>
            )}
          </RouterLink>
        ))}
      </Box>
    </>
  )
}

export default SidebarItems
