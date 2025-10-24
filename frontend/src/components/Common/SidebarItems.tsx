import { Box, Flex, Icon, Text } from "@chakra-ui/react";
import { useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink } from "@tanstack/react-router";
import { FiBriefcase, FiHome, FiSettings, FiUsers } from "react-icons/fi";
import { FaBuilding } from "react-icons/fa"; // Keep tenant icon
// Import an icon for Admin Summary if you add it later
// import { FiGrid } from "react-icons/fi"; 
import type { IconType } from "react-icons/lib";

import type { UserPublic } from "@/client";

interface SidebarItemsProps {
  onClose?: () => void;
}

interface Item {
  icon: IconType;
  title: string;
  path: string;
}

const SidebarItems = ({ onClose }: SidebarItemsProps) => {
  const queryClient = useQueryClient();
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"]);

  let finalItems: Item[] = [];

  // Define items always visible to clients (and admins/managers)
  const clientItems: Item[] = [
    { icon: FiHome, title: "Dashboard", path: "/" }, // Shows selected/own tenant data
    { icon: FiBriefcase, title: "Items", path: "/items" }, // Shows items for selected/own tenant
    { icon: FiSettings, title: "User Settings", path: "/settings" },
  ];

  // Define items visible only to admins/managers
  const adminItems: Item[] = [
    // Optional: Link to a future summary page
    // { icon: FiGrid, title: "Summary", path: "/admin/summary" }, 
    { icon: FiUsers, title: "User Management", path: "/admin" }, 
    { icon: FaBuilding, title: "Tenant Management", path: "/tenant" }, 
  ];

  // --- Updated Role Check ---
  // Check if user exists and has a privileged role
  const isPrivilegedUser = currentUser && (
       currentUser.is_superuser || 
       currentUser.role === 'admin' || 
       currentUser.role === 'manager'
  );

  if (isPrivilegedUser) {
      // Admins/Managers see admin links first, then client links
      finalItems = [...adminItems, ...clientItems]; 
  } else if (currentUser) { 
      // Assume any other logged-in user is a client
      finalItems = clientItems; 
  }
  // If currentUser is loading/undefined, finalItems remains empty
  // --- End Updated Role Check ---

  const listItems = finalItems.map(({ icon, title, path }) => (
    <RouterLink key={title} to={path} onClick={onClose}>
      {/* Use activeProps for styling the active link */}
      {({ isActive }) => (
          <Flex
            gap={4}
            px={4}
            py={2}
            bg={isActive ? "teal.50" : "transparent"} // Example active style
            color={isActive ? "teal.700" : "inherit"} // Example active style
            fontWeight={isActive ? "semibold" : "normal"} // Example active style
            _hover={{
              background: "gray.100", // Adjusted hover style
            }}
            alignItems="center"
            fontSize="sm"
            borderRadius="md" // Add some rounding
            my={1} // Add vertical margin
          >
            <Icon as={icon} alignSelf="center" boxSize="4" /> {/* Standardize icon size */}
            <Text ml={2}>{title}</Text>
          </Flex>
       )}
    </RouterLink>
  ));

  return (
    <>
      <Text fontSize="xs" px={4} py={2} fontWeight="bold" textTransform="uppercase" color="gray.500"> {/* Style heading */}
        Menu
      </Text>
      {/* Add spacing to the Box container */}
      <Box px={2} mt={2}>{listItems}</Box> 
    </>
  );
};

export default SidebarItems;