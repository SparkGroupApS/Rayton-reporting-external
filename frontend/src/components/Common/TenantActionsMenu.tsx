// src/components/Admin/TenantActionsMenu.tsx
import { IconButton } from "@chakra-ui/react"
import { BsThreeDotsVertical } from "react-icons/bs"

import type { TenantPublic } from "@/client"
import DeleteTenant from "../Admin/DeleteTenant"

// Import the standalone modal components
import EditTenant from "../Admin/EditTenant"
import { MenuContent, MenuRoot, MenuTrigger } from "../ui/menu"

interface TenantActionsMenuProps {
  tenant: TenantPublic
}

export const TenantActionsMenu = ({ tenant }: TenantActionsMenuProps) => {
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <IconButton variant="ghost" color="inherit">
          <BsThreeDotsVertical />
        </IconButton>
      </MenuTrigger>
      {/* Render the components directly inside the menu */}
      <MenuContent>
        <EditTenant tenant={tenant} />
        <DeleteTenant tenant={tenant} />
      </MenuContent>
    </MenuRoot>
  )
}
