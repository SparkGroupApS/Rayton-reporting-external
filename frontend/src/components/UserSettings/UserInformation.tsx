import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Input,
  Spinner, // Import Spinner for loading state
  Text,
} from "@chakra-ui/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { type SubmitHandler, useForm } from "react-hook-form"

import {
  type ApiError,
  type UserPublic,
  UsersService,
  type UserUpdateMe,
} from "@/client"
import useAuth from "@/hooks/useAuth" // Assuming useAuth provides the user object
import useCustomToast from "@/hooks/useCustomToast"
// Import the tenant hook
import { useTenant } from "@/hooks/useTenantQueries" // Adjust path if needed
import { emailPattern, handleError } from "@/utils"
import { Field } from "../ui/field"

const UserInformation = () => {
  const queryClient = useQueryClient()
  const { showSuccessToast } = useCustomToast()
  const [editMode, setEditMode] = useState(false)
  const { user: currentUser } = useAuth() // Contains user info including tenant_id

  // --- Fetch Tenant Information ---
  const {
    data: tenantData,
    isLoading: isLoadingTenant,
    error: tenantError,
  } = useTenant(currentUser?.tenant_id ?? null) // Pass tenant_id to the hook
  // --- End Fetch Tenant ---

  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { isSubmitting, errors, isDirty },
  } = useForm<UserPublic>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      full_name: currentUser?.full_name ?? "", // Use empty string as fallback
      email: currentUser?.email ?? "", // Use empty string as fallback
    },
    // Reset defaults when currentUser changes (e.g., after login)
    resetOptions: {
      keepDirtyValues: false,
    },
    values: currentUser
      ? {
          // Ensure form updates if currentUser reloads
          full_name: currentUser.full_name ?? "",
          email: currentUser.email ?? "",
          // Include other UserPublic fields if needed by useForm, matching defaultValues
          id: currentUser.id,
          is_active: currentUser.is_active,
          is_superuser: currentUser.is_superuser,
          tenant_id: currentUser.tenant_id,
        }
      : undefined,
  })

  const toggleEditMode = () => {
    setEditMode(!editMode)
    // Reset form to current values when exiting edit mode without saving
    if (editMode) {
      reset({
        full_name: currentUser?.full_name ?? "",
        email: currentUser?.email ?? "",
      })
    }
  }

  const mutation = useMutation({
    mutationFn: (data: UserUpdateMe) =>
      UsersService.updateUserMe({ requestBody: data }),
    onSuccess: (updatedUser) => {
      showSuccessToast("User updated successfully.")
      // Update the currentUser data in the query cache for immediate UI update
      queryClient.setQueryData(["currentUser"], updatedUser)
      setEditMode(false) // Exit edit mode on success
    },
    onError: (err: ApiError) => {
      handleError(err)
      // Optional: Reset form back to original values on error?
      // reset({ full_name: currentUser?.full_name ?? "", email: currentUser?.email ?? "" });
    },
    // No need for invalidateQueries if setQueryData is used effectively
    // onSettled: () => {
    //   queryClient.invalidateQueries({queryKey: ['currentUser']}); // Or just ['currentUser'] if that's your key
    // },
  })

  const onSubmit: SubmitHandler<UserUpdateMe> = async (data) => {
    // Only send fields that were intended to be updated
    const updatePayload: UserUpdateMe = {
      full_name: data.full_name,
      email: data.email,
    }
    mutation.mutate(updatePayload)
  }

  const onCancel = () => {
    reset({
      full_name: currentUser?.full_name ?? "",
      email: currentUser?.email ?? "",
    })
    toggleEditMode()
  }

  // Display loading or error state for user data
  if (!currentUser) {
    return (
      <Container maxW="full">
        <Spinner /> Loading user data...
      </Container>
    )
  }

  return (
    <Container maxW="full">
      <Heading size="sm" py={4}>
        User Information
      </Heading>
      <Box
        w={{ sm: "full", md: "sm" }}
        as="form"
        onSubmit={handleSubmit(onSubmit)}
      >
        {/* --- Tenant Field (Read-Only) --- */}
        <Field label="Tenant" mt={4}>
          {isLoadingTenant ? (
            <Spinner size="sm" />
          ) : tenantError ? (
            <Text fontSize="md" py={2} color="red.500">
              Error loading tenant
            </Text>
          ) : (
            <Text fontSize="md" py={2} truncate maxW="sm">
              {tenantData?.name ?? "N/A"}
              {/* Optionally show ID: {currentUser.tenant_id.substring(0,8)} */}
            </Text>
          )}
        </Field>
        {/* --- End Tenant Field --- */}

        <Field label="Full name" mt={4}>
          {" "}
          {/* Added mt={4} for spacing */}
          {editMode ? (
            <Input
              {...register("full_name", { maxLength: 255 })} // Match backend max_length
              type="text"
              size="md"
            />
          ) : (
            <Text
              fontSize="md"
              py={2}
              color={!currentUser?.full_name ? "gray.500" : "inherit"} // Use theme color
              truncate // Keep truncate
              maxW="sm"
            >
              {currentUser?.full_name || "N/A"}
            </Text>
          )}
        </Field>

        <Field
          mt={4}
          label="Email"
          invalid={!!errors.email}
          errorText={errors.email?.message}
        >
          {editMode ? (
            <Input
              {...register("email", {
                required: "Email is required",
                pattern: emailPattern,
                maxLength: 255, // Match backend max_length
              })}
              type="email"
              size="md"
            />
          ) : (
            <Text fontSize="md" py={2} truncate maxW="sm">
              {currentUser?.email}
            </Text>
          )}
        </Field>

        <Flex mt={4} gap={3}>
          {editMode ? (
            <>
              <Button
                variant="solid"
                type="submit" // Submit button when in edit mode
                loading={isSubmitting} // Use isLoading instead of loading
                disabled={!isDirty || !!errors.email || !!errors.full_name} // Disable if not dirty or has errors
              >
                Save
              </Button>
              <Button
                variant="subtle"
                colorPalette="gray"
                onClick={onCancel} // Use specific cancel handler
                disabled={isSubmitting}
                type="button" // Ensure it doesn't submit form
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant="solid"
              onClick={toggleEditMode} // Enters edit mode
              type="button" // Ensure it doesn't submit form
            >
              Edit
            </Button>
          )}
        </Flex>
      </Box>
    </Container>
  )
}

export default UserInformation
