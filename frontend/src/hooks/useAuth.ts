import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
// Removed useState as error handling is done via mutation/query states
// import { useState } from "react";

import {
  type Body_login_login_access_token as AccessToken,
  type ApiError,
  LoginService,
  type UserPublic,
  //type UserRegister,
  UsersService,
} from "@/client"; // Adjust path if needed
import { handleError } from "@/utils"; // Assuming handleError shows toast or similar

// Keep isLoggedIn function
const isLoggedIn = () => {
  return localStorage.getItem("access_token") !== null;
};

const useAuth = () => {
  // Removed local error state, rely on mutation.error or query.error
  // const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // --- Updated useQuery for currentUser ---
  const { data: user, isLoading, error: userError } = useQuery<UserPublic, ApiError | Error>({ // Use ApiError
    queryKey: ["currentUser"],
    queryFn: UsersService.readUserMe,
    enabled: isLoggedIn(),
    // Add staleTime: Cache user data for 1 hour
    staleTime: 60 * 60 * 1000, 
    // Add retry: Only retry once on failure
    retry: 1, 
  });

  // --- Signup Mutation (Mostly unchanged) ---
  // const signUpMutation = useMutation({
  //   mutationFn: (data: UserRegister) =>
  //     UsersService.registerUser({ requestBody: data }),
  //   onSuccess: () => {
  //     // Redirect to login after successful registration
  //     navigate({ to: "/login" });
  //   },
  //   onError: (err: ApiError) => {
  //     handleError(err); // Display signup error
  //   },
  //   // Keep invalidation if needed for admin lists, but doesn't affect currentUser directly
  //   // onSettled: () => {
  //   //   queryClient.invalidateQueries({ queryKey: ["users"] });
  //   // },
  // });

  // --- Updated Login Mutation ---
  const loginMutation = useMutation({
    mutationFn: async (data: AccessToken) => {
      // Login and get token
      const response = await LoginService.loginAccessToken({ formData: data });
      localStorage.setItem("access_token", response.access_token);
      
      // Immediately fetch user data after setting token
      // This caches the user data and returns it
      return await queryClient.fetchQuery<UserPublic, Error>({
          queryKey: ['currentUser'],
          queryFn: () => UsersService.readUserMe(),
          staleTime: 10 * 1000 // Consider fresh for 10s after login
      });
    },
    onSuccess: (loggedInUser) => { // User data is passed here from mutationFn
      
      // Redirect based on role
      if (loggedInUser.is_superuser || loggedInUser.role === 'admin' || loggedInUser.role === 'manager') {
          navigate({ 
              to: "/admin", 
              search: { 
              page: 1, 
              filterAllTenants: false // <-- ADD THIS LINE
              // filterTenantId: undefined // Optional, not strictly needed
          },
              replace: true 
          });
      } else {
          navigate({ to: "/", replace: true });
      }
    },
    onError: (err: ApiError) => {
      // Use handleError for consistency, or set local error state if needed
      queryClient.setQueryData(['currentUser'], null); // Clear user data on login error
      handleError(err); 
      // Example using local state if you still want it:
      // setError(err.body?.detail || err.message || "Login failed"); 
    },
  });

  // --- Updated Logout Function ---
  const logout = () => {
    localStorage.removeItem("access_token");
    // Add cache clearing: Remove the currentUser data immediately
    queryClient.setQueryData(['currentUser'], null); 
    // Optional: You might want to remove other cached data specific to the logged-out user
    // queryClient.removeQueries(); // Clears everything - use with caution
    
    // Redirect to login, use replace to prevent back button issues
    navigate({ to: "/login", replace: true }); 
  };

  // --- Return updated state and functions ---
  return {
    //signUpMutation,
    loginMutation,
    logout,
    user, // The fetched user data (UserPublic | undefined)
    isLoadingUser: isLoading, // Renamed for clarity
    userError, // Error object from the currentUser query
    isLoggedIn: isLoggedIn(), // Function to check token presence
    // Removed local error state and resetError, use mutation/query error states instead
  };
};

export { isLoggedIn };
export default useAuth;