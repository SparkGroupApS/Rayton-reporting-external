import { Box, Flex, IconButton, Text } from "@chakra-ui/react"
import { useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { FaBars } from "react-icons/fa"
import { FiLogOut } from "react-icons/fi"

import type { UserPublic } from "@/client"
import useAuth from "@/hooks/useAuth"
import {
  DrawerBackdrop,
  DrawerBody,
  DrawerCloseTrigger,
  DrawerContent,
  DrawerRoot,
  DrawerTrigger,
} from "../ui/drawer"
import SidebarItems from "./SidebarItems"

const Sidebar = () => {
  const queryClient = useQueryClient()
  const currentUser = queryClient.getQueryData<UserPublic>(["currentUser"])
  const { logout } = useAuth()
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Mobile */}
      <DrawerRoot
        placement="start"
        open={open}
        onOpenChange={(e) => setOpen(e.open)}
      >
        <DrawerBackdrop />
        <DrawerTrigger asChild>
          <IconButton
            variant="ghost"
            color="inherit"
            display={{ base: "flex", md: "none" }}
            aria-label="Open Menu"
            position="fixed"
            zIndex="100"
            m={4}
            top="calc(65px + 1rem)" // Position below the navbar with additional margin
          >
            <FaBars />
          </IconButton>
        </DrawerTrigger>
        <DrawerContent maxW="xs">
          <DrawerCloseTrigger />
          <DrawerBody pt={12}> {/* Add padding to account for close button */}
            <Flex flexDir="column" justify="space-between" h="100%">
              <Box>
                <SidebarItems onClose={() => setOpen(false)} />
                <Flex
                  as="button"
                  onClick={() => {
                    logout()
                  }}
                  alignItems="center"
                  gap={4}
                  px={4}
                  py={2}
                  mt={4}
                >
                  <FiLogOut />
                  <Text>Log Out</Text>
                </Flex>
              </Box>
              {currentUser?.email && (
                <Text fontSize="sm" p={4} truncate maxW="sm" mt="auto">
                  Logged in as: {currentUser.email}
                </Text>
              )}
            </Flex>
          </DrawerBody>
        </DrawerContent>
      </DrawerRoot>

      {/* Desktop */}

      <Box
        display={{ base: "none", md: "flex" }}
        position="sticky"
        bg="rayton_neutral.200"
        top={0}
        minW="3xs" // Change "xs" to "sm", "md", or a specific value like "250px", "16rem"
        // Optionally add a fixed width:
        // w="250px"
        h="calc(100vh - 65px)" // Subtract navbar height
        p={4}
      >
        <Box w="100%">
          <SidebarItems />
        </Box>
      </Box>
    </>
  )
}

export default Sidebar
