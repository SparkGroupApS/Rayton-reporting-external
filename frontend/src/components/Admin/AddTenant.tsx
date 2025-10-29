// src/components/Admin/AddTenant.tsx
import {
  Button,
  DialogActionTrigger,
  DialogTitle,
  Input,
  Text,
  Textarea, // Use Textarea for description
  VStack,
  Field, // Use Chakra v3 Field
} from "@chakra-ui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import { FaPlus } from "react-icons/fa"; // Or a more relevant icon like FaBuilding
import React from 'react';

// Import Tenant types and hooks
import { type TenantCreate, TenantsService, ApiError } from "@/client"; // Adjust path
import { useCreateTenant } from "@/hooks/useTenantQueries"; // Adjust path
import useCustomToast from "@/hooks/useCustomToast";
import { handleError } from "@/utils"; // Assuming handleError exists
// Import Dialog components (adjust path)
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTrigger,
} from "../ui/dialog"; // Adjust path

// Form data type
type TenantFormData = {
  name: string;
  description?: string | null;
};

const AddTenant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { showSuccessToast } = useCustomToast();
  const createTenantMutation = useCreateTenant(); // Use the tenant mutation hook

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid, isSubmitting },
  } = useForm<TenantFormData>({
    mode: "onBlur",
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const onSubmit: SubmitHandler<TenantFormData> = (data) => {
    const tenantData: TenantCreate = {
      name: data.name,
      description: data.description === "" ? null : data.description,
    };
    createTenantMutation.mutate(tenantData, {
        onSuccess: () => {
            showSuccessToast("Tenant created successfully.");
            reset();
            setIsOpen(false);
            // Invalidate the tenants list query
            queryClient.invalidateQueries({ queryKey: ["tenants"] }); 
        },
        onError: (err: ApiError) => {
            handleError(err);
        }
        // onSettled handled by hook if needed
    });
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
        {/* Button to open the dialog */}
        <Button value="add-tenant" my={4} colorScheme="teal"> {/* Matched colorScheme */}
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
            <Text mb={4}>
              Fill in the form below to add a new tenant.
            </Text>
            <VStack gap={4}>
              {/* Name Field */}
              <Field.Root id="tenant-name-add" required invalid={!!errors.name}>
                <Field.Label>Tenant Name</Field.Label>
                <Input
                  id="name"
                  {...register("name", {
                    required: "Name is required",
                    maxLength: { value: 255, message: "Max 255 chars" },
                  })}
                  placeholder="Tenant Name"
                  type="text"
                />
                 <Field.ErrorText>
                    {errors.name && errors.name.message}
                 </Field.ErrorText>
              </Field.Root>

              {/* Description Field */}
               <Field.Root id="tenant-desc-add" invalid={!!errors.description}>
                <Field.Label>Description (Optional)</Field.Label>
                <Textarea
                  id="description"
                  {...register("description", {
                     maxLength: { value: 1024, message: "Max 1024 chars" },
                  })}
                  placeholder="Tenant Description"
                />
                 <Field.ErrorText>
                    {errors.description && errors.description.message}
                 </Field.ErrorText>
              </Field.Root>

            </VStack>
             {/* Display general mutation error */}
            {createTenantMutation.isError && (
                <Text color="red.500" fontSize="sm" mt={2}>
                    Error: 
                    {(createTenantMutation.error instanceof ApiError &&
                        typeof createTenantMutation.error.body === 'object' &&
                        createTenantMutation.error.body !== null &&
                        'detail' in createTenantMutation.error.body)
                        ? String(createTenantMutation.error.body.detail)
                        : createTenantMutation.error?.message
                    }
                </Text>
            )}
          </DialogBody>

          <DialogFooter gap={2}>
            <DialogActionTrigger asChild>
              <Button
                variant="subtle"
                colorPalette="gray" // Use colorPalette for Chakra v3 consistency
                disabled={isSubmitting}
                type="button"
                onClick={() => handleOpenChange({open: false})}
              >
                Cancel
              </Button>
            </DialogActionTrigger>
            <Button
              variant="solid"
              colorScheme="teal" // Use colorScheme
              type="submit"
              disabled={!isValid || isSubmitting}
              loading={isSubmitting} // Use isLoading
            >
              Save Tenant
            </Button>
          </DialogFooter>
        </form>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
};

export default AddTenant;