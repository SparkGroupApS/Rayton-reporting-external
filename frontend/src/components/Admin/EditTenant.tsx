// src/components/Admin/EditTenant.tsx
import {
  Button,
  DialogActionTrigger,
  DialogTitle,
  Field,
  Input,
  Text,
  Textarea, // Import Textarea
  VStack,
} from "@chakra-ui/react"
import { useState } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"
import { FaExchangeAlt } from "react-icons/fa" // Using EditUser's icon

import { ApiError, type TenantPublic, type TenantUpdate } from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { useUpdateTenant } from "@/hooks/useTenantQueries"
import { handleError } from "@/utils"
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTrigger,
} from "../ui/dialog"

interface EditTenantProps {
  tenant: TenantPublic
}

// Form data type from AddTenant
type TenantFormData = {
  name: string
  description?: string | null
  plant_id?: number | null
}

const EditTenant = ({ tenant }: EditTenantProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const { showSuccessToast } = useCustomToast()
  const updateTenantMutation = useUpdateTenant()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid, isSubmitting },
  } = useForm<TenantFormData>({
    mode: "onBlur",
    defaultValues: {
      name: tenant.name,
      description: tenant.description,
      plant_id: tenant.plant_id,
    },
  })

  const onSubmit: SubmitHandler<TenantFormData> = (data) => {
    const tenantUpdateData: TenantUpdate = {
      name: data.name,
      description: data.description === "" ? null : data.description,
      plant_id: data.plant_id ? Number(data.plant_id) : null,
    }

    updateTenantMutation.mutate(
      { tenantId: tenant.id, tenantData: tenantUpdateData },
      {
        onSuccess: () => {
          showSuccessToast("Tenant updated successfully.")
          setIsOpen(false)
          // Invalidation is handled by the hook
        },
        onError: (err: ApiError) => {
          handleError(err)
        },
      },
    )
  }

  const handleOpenChange = ({ open }: { open: boolean }) => {
    setIsOpen(open)
    if (open) {
      // Reset form to tenant's current values when modal opens
      reset({
        name: tenant.name,
        description: tenant.description,
        plant_id: tenant.plant_id,
      })
    }
  }

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      open={isOpen}
      onOpenChange={handleOpenChange}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <FaExchangeAlt fontSize="16px" />
          Edit Tenant
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit Tenant</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text mb={4}>Update the tenant details below.</Text>
            <VStack gap={4}>
              <Field.Root
                id="tenant-name-edit"
                required
                invalid={!!errors.name}
              >
                <Field.Label>Tenant Name</Field.Label>
                <Input
                  id="name"
                  {...register("name", {
                    required: "Name is required",
                    maxLength: { value: 255, message: "Max 255 chars" },
                  })}
                  placeholder="Tenant Name"
                />
                <Field.ErrorText>{errors.name?.message}</Field.ErrorText>
              </Field.Root>

              <Field.Root id="tenant-desc-edit" invalid={!!errors.description}>
                <Field.Label>Description (Optional)</Field.Label>
                <Textarea
                  id="description"
                  {...register("description", {
                    maxLength: { value: 1024, message: "Max 1024 chars" },
                  })}
                  placeholder="Tenant Description"
                />
                <Field.ErrorText>{errors.description?.message}</Field.ErrorText>
              </Field.Root>

              <Field.Root id="plant-id-edit" invalid={!!errors.plant_id}>
                <Field.Label>Plant ID (Optional)</Field.Label>
                <Input
                  id="plant_id"
                  type="number"
                  {...register("plant_id", {
                    valueAsNumber: true,
                    min: { value: 1, message: "Must be a positive number" },
                  })}
                  placeholder="e.g., 2500"
                />
                <Field.ErrorText>{errors.plant_id?.message}</Field.ErrorText>
              </Field.Root>
            </VStack>

            {updateTenantMutation.isError && (
              <Text color="red.500" fontSize="sm" mt={2}>
                Error:
                {updateTenantMutation.error instanceof ApiError &&
                typeof updateTenantMutation.error.body === "object" &&
                updateTenantMutation.error.body !== null &&
                "detail" in updateTenantMutation.error.body
                  ? String(updateTenantMutation.error.body.detail)
                  : updateTenantMutation.error?.message}
              </Text>
            )}
          </DialogBody>

          <DialogFooter gap={2}>
            <DialogActionTrigger asChild>
              <Button
                variant="subtle"
                colorPalette="gray"
                disabled={isSubmitting}
                onClick={() => handleOpenChange({ open: false })}
                type="button"
              >
                Cancel
              </Button>
            </DialogActionTrigger>
            <Button
              variant="solid"
              colorScheme="amber"
              type="submit"
              disabled={!isValid || isSubmitting}
              loading={isSubmitting}
            >
              Save Changes
            </Button>
          </DialogFooter>
          <DialogCloseTrigger />
        </form>
      </DialogContent>
    </DialogRoot>
  )
}

export default EditTenant
