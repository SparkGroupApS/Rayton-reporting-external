import {
  Button,
  DialogActionTrigger,
  DialogTitle,
  Field,
  Flex,
  Input,
  NativeSelect, // Import NativeSelect
  Text,
  VStack,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Controller, type SubmitHandler, useForm } from "react-hook-form"
import { FaExchangeAlt } from "react-icons/fa"

import {
  type TenantPublic,
  type UserPublic,
  UsersService,
  type UserUpdate,
} from "@/client" // Import TenantPublic
import type { ApiError } from "@/client/core/ApiError"
import useCustomToast from "@/hooks/useCustomToast"
import { useTenants } from "@/hooks/useTenantQueries" // Import useTenants
import { emailPattern, handleError } from "@/utils"
// Assuming Checkbox is compatible or using Chakra's v3 Checkbox directly
import { Checkbox } from "../ui/checkbox" // Check if this needs update to v3 Checkbox
// Assuming Dialog components are compatible or using Chakra's v3 Dialog/Modal directly
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTrigger,
} from "../ui/dialog" // Check if these need update to v3 Dialog/Modal

// Use Chakra's v3 Field directly

interface EditUserProps {
  user: UserPublic
}

interface UserUpdateForm extends UserUpdate {
  confirm_password?: string
}

const EditUser = ({ user }: EditUserProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const { data: tenantsData, isLoading: isLoadingTenants } = useTenants()

  const {
    control,
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<UserUpdateForm>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      ...user,
      password: "",
      confirm_password: "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: UserUpdate) =>
      UsersService.updateUser({ userId: user.id, requestBody: data }),
    onSuccess: (updatedUser) => {
      showSuccessToast("User updated successfully.")
      queryClient.setQueryData(["users", { id: user.id }], updatedUser)
      queryClient.invalidateQueries({ queryKey: ["users"] })
      setIsOpen(false)
    },
    onError: (err: ApiError) => {
      handleError(err)
    },
  })

  const onSubmit: SubmitHandler<UserUpdateForm> = async (data) => {
    const payload: UserUpdate = {
      email: data.email,
      full_name: data.full_name || null,
      is_active: data.is_active,
      is_superuser: data.is_superuser,
      password: data.password === "" ? null : data.password,
      tenant_id: data.tenant_id,
    }
    mutation.mutate(payload)
  }

  const handleOpenChange = ({ open }: { open: boolean }) => {
    setIsOpen(open)
    if (open) {
      reset({ ...user, password: "", confirm_password: "" })
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
          Edit User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text mb={4}>Update the user details below.</Text>
            <VStack gap={4}>
              {/* --- Tenant Selection (v3 Field) --- */}
              <Field.Root
                id="tenant-field"
                required
                invalid={!!errors.tenant_id}
                disabled={isLoadingTenants || !tenantsData}
              >
                <Field.Label>Tenant</Field.Label>
                <NativeSelect.Root maxWidth="full">
                  <NativeSelect.Field
                    id="tenant_id"
                    placeholder={
                      isLoadingTenants ? "Loading tenants..." : "Select Tenant"
                    }
                    {...register("tenant_id", {
                      required: "Tenant is required",
                    })}
                  >
                    {tenantsData?.data.map((tenant: TenantPublic) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name}
                      </option>
                    ))}
                  </NativeSelect.Field>
                  <NativeSelect.Indicator />
                </NativeSelect.Root>
                <Field.ErrorText>{errors.tenant_id?.message}</Field.ErrorText>
                {!isLoadingTenants && !tenantsData && (
                  <Text color="red.500" fontSize="sm">
                    Could not load tenants.
                  </Text>
                )}
              </Field.Root>

              {/* --- Email (v3 Field) --- */}
              <Field.Root id="email-field" required invalid={!!errors.email}>
                <Field.Label>Email</Field.Label>
                <Input
                  id="email"
                  {...register("email", {
                    required: "Email is required",
                    pattern: emailPattern,
                  })}
                  placeholder="Email"
                  type="email"
                />
                <Field.ErrorText>{errors.email?.message}</Field.ErrorText>
              </Field.Root>

              {/* --- Full Name (v3 Field) --- */}
              <Field.Root id="fullname-field" invalid={!!errors.full_name}>
                <Field.Label>Full Name</Field.Label>
                <Input
                  id="full_name"
                  {...register("full_name")}
                  placeholder="Full name"
                  type="text"
                />
                <Field.ErrorText>{errors.full_name?.message}</Field.ErrorText>
              </Field.Root>

              {/* --- Password (v3 Field) --- */}
              <Field.Root id="password-field" invalid={!!errors.password}>
                <Field.Label>Set New Password (Optional)</Field.Label>
                <Input
                  id="password"
                  {...register("password", {
                    minLength: {
                      value: 8,
                      message: "Password must be at least 8 characters",
                    },
                  })}
                  placeholder="Leave blank to keep current password"
                  type="password"
                />
                <Field.ErrorText>{errors.password?.message}</Field.ErrorText>
              </Field.Root>

              {/* --- Confirm Password (v3 Field) --- */}
              <Field.Root
                id="confirm-password-field"
                invalid={!!errors.confirm_password}
              >
                <Field.Label>Confirm New Password</Field.Label>
                <Input
                  id="confirm_password"
                  {...register("confirm_password", {
                    validate: (value) =>
                      getValues().password === "" ||
                      value === getValues().password ||
                      "The passwords do not match",
                  })}
                  placeholder="Confirm if new password entered"
                  type="password"
                  disabled={!getValues().password}
                />
                <Field.ErrorText>
                  {errors.confirm_password?.message}
                </Field.ErrorText>
              </Field.Root>
            </VStack>

            <Flex mt={4} direction="column" gap={4}>
              {/* --- Checkboxes (using v3 Field.Root for consistency) --- */}
              <Controller
                control={control}
                name="is_superuser"
                render={({ field }) => (
                  <Field.Root
                    id={`superuser-${user.id}`}
                    disabled={field.disabled}
                  >
                    <Checkbox
                      checked={Boolean(field.value)}
                      onCheckedChange={({ checked }) => field.onChange(checked)}
                    >
                      Is superuser?
                    </Checkbox>
                  </Field.Root>
                )}
              />
              <Controller
                control={control}
                name="is_active"
                render={({ field }) => (
                  <Field.Root
                    id={`active-${user.id}`}
                    disabled={field.disabled}
                  >
                    <Checkbox
                      checked={Boolean(field.value)}
                      onCheckedChange={({ checked }) => field.onChange(checked)}
                    >
                      Is active?
                    </Checkbox>
                  </Field.Root>
                )}
              />
            </Flex>
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
            <Button variant="solid" type="submit" loading={isSubmitting}>
              Save Changes
            </Button>
          </DialogFooter>
          <DialogCloseTrigger />
        </form>
      </DialogContent>
    </DialogRoot>
  )
}

export default EditUser
