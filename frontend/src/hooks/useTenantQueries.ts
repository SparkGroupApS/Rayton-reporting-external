import {
  type UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import {
  type ApiError,
  type TenantCreate,
  type TenantPublic,
  type TenantsPublic,
  TenantsService,
  type TenantUpdate,
} from "../client" // Adjust path as needed

// REMOVED THE IMPORT FROM "../client/sdk.gen"

type TenantListParams = Parameters<typeof TenantsService.readTenants>[0]

// Define the type for extra useQuery options, omitting ones set internally
type UseTenantsQueryOptions = Omit<
  UseQueryOptions<TenantsPublic, ApiError>,
  "queryKey" | "queryFn"
>

const tenantKeys = {
  all: ["tenants"] as const,
  // Ensure list key includes pagination params
  list: (params: TenantListParams) =>
    [...tenantKeys.all, "list", params] as const,
  detail: (id: string) => [...tenantKeys.all, "detail", id] as const,
}

// Hook to fetch a list of tenants (accepts pagination params)
// export const useTenants = (params: TenantListParams = {}) => { // Use the defined type
//   return useQuery<TenantsPublic, ApiError>({
//     queryKey: tenantKeys.list(params), // Use params in queryKey
//     queryFn: () => TenantsService.readTenants(params), // Pass params to API call
//     placeholderData: (prevData) => prevData, // Add placeholderData for smoother pagination
//   });
// };
// Update the hook signature to accept options
export const useTenants = (
  params: TenantListParams = {},
  options: UseTenantsQueryOptions = {}, // Add second argument for options
) => {
  return useQuery<TenantsPublic, ApiError>({
    // Spread the passed options here
    ...options,
    // Keep internal queryKey and queryFn
    queryKey: tenantKeys.list(params),
    queryFn: () => TenantsService.readTenants(params),
    placeholderData: (prevData) => prevData,
  })
}

// --- 1. Define a type for the custom options ---
type UseTenantQueryOptions = Omit<
  UseQueryOptions<TenantPublic, ApiError>,
  "queryKey" | "queryFn"
>

// Hook to fetch a single tenant by ID
export const useTenant = (
  tenantId: string | null,
  options: UseTenantQueryOptions = {}, // <-- Add options parameter
) => {
  const queryParams = { tenantId: tenantId! }
  return useQuery<TenantPublic, ApiError>({
    queryKey: tenantKeys.detail(tenantId!),
    queryFn: () => TenantsService.readTenantById(queryParams),
    // --- 3. Combine internal logic with passed-in options ---
    ...options, // Spread the passed-in options
    // The query is enabled only if a tenantId is provided AND
    // the enabled option from the component is not false.
    enabled: !!tenantId && (options.enabled ?? true),
  })
}

// export const useTenant = (tenantId: string | null) => {
//   // Type inference works for parameters here too
//   const queryParams = { tenantId: tenantId! }
//   return useQuery<TenantPublic, ApiError>({
//     queryKey: tenantKeys.detail(tenantId!),
//     queryFn: () => TenantsService.readTenantById(queryParams),
//     enabled: !!tenantId,
//   })
// }

// Hook to create a new tenant
export const useCreateTenant = () => {
  const queryClient = useQueryClient()
  // TenantCreate is correctly imported from '../client' (which re-exports types.gen.ts)
  return useMutation<TenantPublic, ApiError, TenantCreate>({
    mutationFn: (tenantData) =>
      TenantsService.createTenant({ requestBody: tenantData }),
    onSuccess: () => {
      //queryClient.invalidateQueries({ queryKey: tenantKeys.list({}) })
      // --- FIX: Invalidate the root 'tenants' key ---
      // This will refetch all lists (tenantKeys.list(...))
      queryClient.invalidateQueries({ queryKey: tenantKeys.all }); // Was tenantKeys.list({})
      // --- END FIX ---
    },
  })
}

// Hook to update a tenant
export const useUpdateTenant = () => {
  const queryClient = useQueryClient()
  // TenantUpdate is correctly imported from '../client'
  return useMutation<
    TenantPublic,
    ApiError,
    { tenantId: string; tenantData: TenantUpdate }
  >({
    mutationFn: ({ tenantId, tenantData }) =>
      TenantsService.updateTenant({ tenantId, requestBody: tenantData }),
    onSuccess: (updatedTenant) => {
      // --- THE FIX ---
      // Change this:
      // queryClient.invalidateQueries({ queryKey: tenantKeys.list({}) });

      // To this:
      queryClient.invalidateQueries({ queryKey: tenantKeys.all }) // Invalidates ["tenants"]
      // --- END FIX ---

      // This line is still correct and makes the edit page feel instant
      queryClient.setQueryData(
        tenantKeys.detail(updatedTenant.id),
        updatedTenant,
      )
    },
  })
}

// Hook to delete a tenant
export const useDeleteTenant = () => {
  const queryClient = useQueryClient()
  return useMutation<{}, ApiError, string>({
    mutationFn: (tenantId) => TenantsService.deleteTenant({ tenantId }),
    onSuccess: (_, tenantId) => {
      queryClient.invalidateQueries({ queryKey: tenantKeys.list({}) })
      queryClient.removeQueries({ queryKey: tenantKeys.detail(tenantId) })
    },
    onError: (error, tenantId) => {
      console.error(`Failed to delete tenant ${tenantId}:`, error)
    },
  })
}
