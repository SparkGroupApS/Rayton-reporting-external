// src/components/Admin/DeleteTenant.tsx
import { Button, DialogTitle, Text } from "@chakra-ui/react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { FiTrash2 } from "react-icons/fi"

// --- CHANGE: Import Tenant types and hooks ---
import type { ApiError, TenantPublic } from "@/client"
import { useDeleteTenant } from "@/hooks/useTenantQueries"
// --- END CHANGE ---

import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTrigger,
} from "@/components/ui/dialog"
import useCustomToast from "@/hooks/useCustomToast"

// --- CHANGE: Accept the full tenant object for the confirmation message ---
interface DeleteTenantProps {
  tenant: TenantPublic
}

const DeleteTenant = ({ tenant }: DeleteTenantProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const {
    handleSubmit,
    formState: { isSubmitting }, // Use isSubmitting from useForm for the form
  } = useForm()

  // --- CHANGE: Use the dedicated hook ---
  const deleteTenantMutation = useDeleteTenant()
  // --- END CHANGE ---

  const onSubmit = async () => {
    // Mutate using the hook
    deleteTenantMutation.mutate(tenant.id, {
      onSuccess: () => {
        showSuccessToast(`Tenant "${tenant.name}" was deleted successfully.`)
        setIsOpen(false)
        // Invalidation is already handled by the useDeleteTenant hook
      },
      onError: (_err: ApiError) => {
        // Use the handleError utility
        showErrorToast("An error occurred while deleting the tenant")
        //handleError(err, "An error occurred while deleting the tenant");
      },
    })
  }

  // Get loading state directly from the mutation hook
  const isLoading = deleteTenantMutation.isPending

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      role="alertdialog"
      open={isOpen}
      onOpenChange={({ open }) => setIsOpen(open)}
    >
      <DialogTrigger asChild>
        {/* --- CHANGE: Update text --- */}
        <Button variant="ghost" size="sm" colorPalette="red">
          <FiTrash2 fontSize="16px" />
          Delete Tenant
        </Button>
        {/* --- END CHANGE --- */}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            {/* --- CHANGE: Update text --- */}
            <DialogTitle>Delete Tenant</DialogTitle>
            {/* --- END CHANGE --- */}
          </DialogHeader>
          <DialogBody>
            {/* --- CHANGE: Update warning text --- */}
            <Text mb={4}>
              All **users and items** associated with the tenant{" "}
              <strong>{tenant.name}</strong> will also be{" "}
              <strong>permanently deleted.</strong>
            </Text>
            <Text>Are you sure? You will not be able to undo this action.</Text>
            {/* --- END CHANGE --- */}
          </DialogBody>

          <DialogFooter gap={2}>
            <DialogActionTrigger asChild>
              <Button
                variant="subtle"
                colorPalette="gray"
                disabled={isLoading} // Use mutation loading state
              >
                Cancel
              </Button>
            </DialogActionTrigger>
            <Button
              variant="solid"
              colorPalette="red"
              type="submit"
              loading={isLoading} // Use mutation loading state
            >
              Delete
            </Button>
          </DialogFooter>
          <DialogCloseTrigger />
        </form>
      </DialogContent>
    </DialogRoot>
  )
}

export default DeleteTenant
