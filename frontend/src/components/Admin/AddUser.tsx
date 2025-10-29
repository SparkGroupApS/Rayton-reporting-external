import {
  Button,
  DialogActionTrigger,
  DialogTitle,
  Flex,
  Input,
  NativeSelect, // Import NativeSelect
  Text,
  VStack,
  Textarea, // Import Textarea if used elsewhere, not needed for this component now
  Heading, // Import Heading if needed
  Container, // Import Container if needed
  Field, // Use Chakra's Field system
} from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, type SubmitHandler, useForm } from "react-hook-form";
import { FaPlus } from "react-icons/fa";
import React from 'react'; // Import React

// Import Tenant models and the hook to fetch tenants
import { type UserCreate, UsersService, TenantPublic } from "@/client";
import { useTenants } from "@/hooks/useTenantQueries"; // Adjust path if needed
import type { ApiError } from "@/client/core/ApiError";
import useCustomToast from "@/hooks/useCustomToast";
import { emailPattern, handleError } from "@/utils";
// Assuming Checkbox is compatible or imported correctly from Chakra v3
import { Checkbox } from "../ui/checkbox"; // Check path and v3 compatibility
// Assuming Dialog components are compatible or imported correctly from Chakra v3
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTrigger,
} from "../ui/dialog"; // Check paths and v3 compatibility

// Update form interface to include tenant_id
interface UserCreateForm extends Omit<UserCreate, 'tenant_id'> {
  confirm_password: string;
  tenant_id: string; // Add tenant_id as string (UUID)
}

const AddUser = () => {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { showSuccessToast } = useCustomToast();
  const { data: tenantsData, isLoading: isLoadingTenants } = useTenants();

  const {
    control,
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isValid, isSubmitting },
  } = useForm<UserCreateForm>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      email: "",
      full_name: "",
      password: "",
      confirm_password: "",
      is_superuser: false,
      is_active: true,
      tenant_id: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (data: UserCreate) =>
      UsersService.createUser({ requestBody: data }),
    onSuccess: () => {
      showSuccessToast("User created successfully.");
      reset();
      setIsOpen(false);
    },
    onError: (err: ApiError) => {
      handleError(err);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const onSubmit: SubmitHandler<UserCreateForm> = (data) => {
    const userCreateData: UserCreate = {
        email: data.email,
        password: data.password,
        full_name: data.full_name || null,
        is_active: data.is_active,
        is_superuser: data.is_superuser,
        tenant_id: data.tenant_id,
    };
    mutation.mutate(userCreateData);
  };

  const handleOpenChange = ({ open }: { open: boolean }) => {
    setIsOpen(open);
    if (!open) {
      reset();
    }
  };

  return (
    <DialogRoot
      size={{ base: "xs", md: "md" }}
      placement="center"
      open={isOpen}
      onOpenChange={handleOpenChange}
    >
      <DialogTrigger asChild>
        <Button value="add-user" my={4}>
          <FaPlus fontSize="16px" />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <Text mb={4}>
              Fill in the form below to add a new user to the system.
            </Text>
            <VStack gap={4}>

              {/* === Tenant Selection (v3 Field + NativeSelect) === */}
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
                    placeholder={isLoadingTenants ? "Loading tenants..." : "Select a tenant"}
                    {...register("tenant_id", {
                      required: "Tenant selection is required",
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
                <Field.ErrorText>
                  {errors.tenant_id && errors.tenant_id.message}
                </Field.ErrorText>
                {!isLoadingTenants && !tenantsData && (
                    <Text color="red.500" fontSize="sm">Could not load tenants.</Text>
                )}
              </Field.Root>

              {/* === Email (v3 Field) === */}
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
                 <Field.ErrorText>
                    {errors.email && errors.email.message}
                 </Field.ErrorText>
              </Field.Root>

              {/* === Full Name (v3 Field) === */}
              <Field.Root id="fullname-field" invalid={!!errors.full_name}>
                <Field.Label>Full Name</Field.Label>
                <Input
                  id="full_name"
                  {...register("full_name")}
                  placeholder="Full name"
                  type="text"
                />
                 <Field.ErrorText>
                    {errors.full_name && errors.full_name.message}
                 </Field.ErrorText>
              </Field.Root>

              {/* === Password (v3 Field) === */}
              <Field.Root id="password-field" required invalid={!!errors.password}>
                <Field.Label>Set Password</Field.Label>
                <Input
                  id="password"
                  {...register("password", {
                    required: "Password is required",
                    minLength: {
                      value: 8,
                      message: "Password must be at least 8 characters",
                    },
                  })}
                  placeholder="Password"
                  type="password"
                />
                 <Field.ErrorText>
                    {errors.password && errors.password.message}
                 </Field.ErrorText>
              </Field.Root>

              {/* === Confirm Password (v3 Field) === */}
              <Field.Root id="confirm-password-field" required invalid={!!errors.confirm_password}>
                <Field.Label>Confirm Password</Field.Label>
                <Input
                  id="confirm_password"
                  {...register("confirm_password", {
                    required: "Please confirm your password",
                    validate: (value) =>
                      value === getValues().password ||
                      "The passwords do not match",
                  })}
                  placeholder="Password"
                  type="password"
                />
                 <Field.ErrorText>
                    {errors.confirm_password && errors.confirm_password.message}
                 </Field.ErrorText>
              </Field.Root>
            </VStack>

            <Flex mt={4} direction="column" gap={4}>
              {/* === Checkboxes (using v3 Field.Root for consistency) === */}
               <Controller
                control={control}
                name="is_superuser"
                render={({ field }) => (
                  <Field.Root id="is_superuser-field" disabled={field.disabled}>
                    <Checkbox
                      checked={field.value}
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
                  <Field.Root id="is_active-field" disabled={field.disabled}>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={({ checked }) => field.onChange(checked)}
                    >
                      Is active? (Default: Yes)
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
                type="button" // Ensure it doesn't submit
                onClick={() => handleOpenChange({open: false})} // Close dialog on cancel
              >
                Cancel
              </Button>
            </DialogActionTrigger>
            <Button
              variant="solid"
              type="submit"
              disabled={!isValid || isLoadingTenants || !tenantsData || isSubmitting}
              loading={isSubmitting}
            >
              Save User
            </Button>
          </DialogFooter>
        </form>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
};

export default AddUser;