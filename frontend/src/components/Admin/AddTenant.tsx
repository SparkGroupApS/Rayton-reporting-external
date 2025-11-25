// src/components/Admin/AddTenant.tsx
import {
  Button,
  DialogActionTrigger,
  DialogTitle,
  Field,
  Input,
  Text,
  Textarea,
  VStack,
} from "@chakra-ui/react"
import { useState } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"
import { FaPlus } from "react-icons/fa"

import { ApiError, type TenantCreate } from "@/client"
import useCustomToast from "@/hooks/useCustomToast"
import { useCreateTenant } from "@/hooks/useTenantQueries"
import { handleError } from "@/utils"
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTrigger,
} from "../ui/dialog" // Adjust path if needed

// Form data type
type TenantFormData = {
  name: string
  description?: string | null
  plant_id?: number | null
}

const AddTenant = () => {
  const [isOpen, setIsOpen] = useState(false)
  const { showSuccessToast } = useCustomToast()
  // Use the hook from useTenantQueries.ts
  const createTenantMutation = useCreateTenant()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid, isSubmitting },
  } = useForm<TenantFormData>({
    mode: "onBlur",
    defaultValues: { name: "", description: "", plant_id: undefined },
  })

  const onSubmit: SubmitHandler<TenantFormData> = (data) => {
    const tenantData: TenantCreate = {
      name: data.name,
      description: data.description === "" ? null : data.description,
      plant_id: data.plant_id ? Number(data.plant_id) : null,
    }

    // The useCreateTenant hook already handles invalidation on success
    createTenantMutation.mutate(tenantData, {
      onSuccess: () => {
        showSuccessToast("Tenant created successfully.")
        reset()
        setIsOpen(false)
      },
      onError: (err: ApiError) => {
        handleError(err)
      },
    })
  }

  const handleOpenChange = ({ open }: { open: boolean }) => {
    setIsOpen(open)
    if (!open) {
      reset({ name: "", description: "", plant_id: undefined })
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
        <Button size="sm" value="add-tenant" colorScheme="rayton_orange">
          <FaPlus fontSize="16px" />
          Add Tenant
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Add Tenant</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text mb={4}>Fill in the form below to add a new tenant.</Text>
            <VStack gap={4}>
              <Field.Root id="tenant-name-add" required invalid={!!errors.name}>
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

              <Field.Root id="tenant-desc-add" invalid={!!errors.description}>
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

              <Field.Root id="plant-id-add" invalid={!!errors.plant_id}>
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

            {createTenantMutation.isError && (
              <Text color="red.500" fontSize="sm" mt={2}>
                Error:
                {createTenantMutation.error instanceof ApiError &&
                typeof createTenantMutation.error.body === "object" &&
                createTenantMutation.error.body !== null &&
                "detail" in createTenantMutation.error.body
                  ? String(createTenantMutation.error.body.detail)
                  : createTenantMutation.error?.message}
              </Text>
            )}
          </DialogBody>

          <DialogFooter gap={2}>
            <DialogActionTrigger asChild>
              <Button
                variant="subtle"
                colorPalette="gray"
                disabled={isSubmitting}
                type="button"
                onClick={() => handleOpenChange({ open: false })}
              >
                Cancel
              </Button>
            </DialogActionTrigger>
            <Button
              variant="solid"
              colorScheme="rayton_orange"
              type="submit"
              disabled={!isValid || isSubmitting}
              loading={isSubmitting}
            >
              Save Tenant
            </Button>
          </DialogFooter>
        </form>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  )
}

export default AddTenant
