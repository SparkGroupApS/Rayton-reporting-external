import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
    TenantsService, 
    TenantPublic, 
    TenantsPublic, 
    TenantCreate, 
    TenantUpdate,
    ApiError 
} from "../client"; // Adjust path as needed
// REMOVED THE IMPORT FROM "../client/sdk.gen"

type TenantListParams = Parameters<typeof TenantsService.readTenants>[0]; 

const tenantKeys = {
  all: ["tenants"] as const,
  // Ensure list key includes pagination params
  list: (params: TenantListParams) => [...tenantKeys.all, "list", params] as const, 
  detail: (id: string) => [...tenantKeys.all, "detail", id] as const,
};

// Hook to fetch a list of tenants (accepts pagination params)
export const useTenants = (params: TenantListParams = {}) => { // Use the defined type
  return useQuery<TenantsPublic, ApiError>({
    queryKey: tenantKeys.list(params), // Use params in queryKey
    queryFn: () => TenantsService.readTenants(params), // Pass params to API call
    placeholderData: (prevData) => prevData, // Add placeholderData for smoother pagination
  });
};

// Hook to fetch a single tenant by ID
export const useTenant = (tenantId: string | null) => {
  // Type inference works for parameters here too
  const queryParams = { tenantId: tenantId! }; 
  return useQuery<TenantPublic, ApiError>({
    queryKey: tenantKeys.detail(tenantId!), 
    queryFn: () => TenantsService.readTenantById(queryParams), 
    enabled: !!tenantId, 
  });
};

// Hook to create a new tenant
export const useCreateTenant = () => {
  const queryClient = useQueryClient();
  // TenantCreate is correctly imported from '../client' (which re-exports types.gen.ts)
  return useMutation<TenantPublic, ApiError, TenantCreate>({ 
    mutationFn: (tenantData) => TenantsService.createTenant({ requestBody: tenantData }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.list({}) }); 
    },
  });
};

// Hook to update a tenant
export const useUpdateTenant = () => {
  const queryClient = useQueryClient();
  // TenantUpdate is correctly imported from '../client'
  return useMutation<TenantPublic, ApiError, { tenantId: string; tenantData: TenantUpdate }>({ 
    mutationFn: ({ tenantId, tenantData }) => 
        TenantsService.updateTenant({ tenantId, requestBody: tenantData }),
    onSuccess: (updatedTenant) => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.list({}) }); 
      queryClient.setQueryData(tenantKeys.detail(updatedTenant.id), updatedTenant);
    },
  });
};

// Hook to delete a tenant
export const useDeleteTenant = () => {
  const queryClient = useQueryClient();
  return useMutation<{}, ApiError, string>({ 
    mutationFn: (tenantId) => TenantsService.deleteTenant({ tenantId }), 
    onSuccess: (_, tenantId) => { 
      queryClient.invalidateQueries({ queryKey: tenantKeys.list({}) }); 
      queryClient.removeQueries({ queryKey: tenantKeys.detail(tenantId) });
    },
    onError: (error, tenantId) => {
        console.error(`Failed to delete tenant ${tenantId}:`, error);
    }
  });
};