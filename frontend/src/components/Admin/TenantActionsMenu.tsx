import { IconButton, Button } from "@chakra-ui/react"; // Import Button
import { BsThreeDotsVertical } from "react-icons/bs";
import { Link } from '@tanstack/react-router'; // Import Link for navigation
import { useDeleteTenant } from '@/hooks/useTenantQueries'; // Import delete hook
import type { TenantPublic } from "@/client";
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from "../ui/menu"; // Adjust path if needed

interface TenantActionsMenuProps {
  tenant: TenantPublic;
}

export const TenantActionsMenu = ({ tenant }: TenantActionsMenuProps) => {
  const deleteTenantMutation = useDeleteTenant();

  const handleDelete = () => {
    // Add confirmation dialog here!
    if (window.confirm(`Are you sure you want to delete tenant "${tenant.name}"? This is irreversible and might affect users/items.`)) {
        deleteTenantMutation.mutate(tenant.id);
    }
  };

  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <IconButton variant="ghost" color="inherit">
          <BsThreeDotsVertical />
        </IconButton>
      </MenuTrigger>
      <MenuContent>
        {/* Use MenuItem that acts as a Link for Edit */}
        <MenuItem asChild style={{ cursor: 'pointer' }}>
            <Link to={`/admin/tenants/${tenant.id}/edit`}>
                 Edit Tenant
            </Link>
        </MenuItem>
        {/* Use MenuItem with onClick for Delete */}
        <MenuItem
            onClick={handleDelete}
            color="red.500" // Style as destructive action
            style={{ cursor: 'pointer' }}
            disabled={deleteTenantMutation.isPending && deleteTenantMutation.variables === tenant.id}
        >
            {deleteTenantMutation.isPending && deleteTenantMutation.variables === tenant.id ? 'Deleting...' : 'Delete Tenant'}
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  );
};