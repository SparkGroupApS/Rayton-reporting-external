import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
// Removed useState as error handling is done via mutation/query states
// import { useState } from "react";

import {
  type Body_login_login_access_token as AccessToken,
  type ApiError,
  LoginService,
  type UserPublic,
  //type UserRegister,
  UsersService,
} from "@/client" // Adjust path if needed
import { handleError } from "@/utils" // Assuming handleError shows toast or similar

// Keep isLoggedIn function
const isLoggedIn = () => {
  return localStorage.getItem("access_token") !== null
}

const useAuth = () => {
  // Removed local error state, rely on mutation.error or query.error
  // const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // --- Updated useQuery for currentUser ---
  // --- Updated useQuery for currentUser ---
  const {
    data: user,
    isLoading,
    error: userError,
  } = useQuery<UserPublic | null, ApiError | Error>({
    queryKey: ["currentUser"],
    queryFn: async () => {
      // --- FIX: Check for token INSIDE the query function ---
      if (!isLoggedIn()) {
        // If no token, don't try to fetch
        return null // Return null (or undefined)
      }
      try {
        // If token exists, try to fetch the user
        return await UsersService.readUserMe()
      } catch (error) {
        // If token is invalid/expired, handle the error
        console.error("Failed to fetch user, token might be invalid:", error)
        localStorage.removeItem("access_token") // Clear bad token
        return null // Return null on auth error
      }
    },
    // --- FIX: Remove the 'enabled' flag ---
    // enabled: isLoggedIn(), // REMOVE THIS LINE

    // staleTime and retry are good
    staleTime: 60 * 60 * 1000,
    retry: 1,
  })
  // --- END FIX ---

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
      const response = await LoginService.loginAccessToken({ formData: data })
      localStorage.setItem("access_token", response.access_token)

      // --- This is now the correct way to trigger the refetch ---
      // Invalidate the query. The query will re-run, see the new token,
      // and execute the UsersService.readUserMe() call.
      await queryClient.invalidateQueries({ queryKey: ["currentUser"] })

      // fetchQuery is okay, but invalidation is cleaner and respects
      // the hook's own logic. Let's rely on invalidation.
      // We can get the user data from the cache after invalidation.
      return queryClient.getQueryData<UserPublic>(["currentUser"])
    },
    onSuccess: (_loggedInUser) => {
      // loggedInUser might be null here, just navigate
      navigate({ to: "/", replace: true })
    },
    onError: (err: ApiError) => {
      queryClient.setQueryData(["currentUser"], null)
      handleError(err)
    },
  })

  // --- Updated Logout Function ---
  const logout = () => {
    localStorage.removeItem("access_token")
    // Add cache clearing: Remove the currentUser data immediately
    queryClient.setQueryData(["currentUser"], null)
    // Optional: You might want to remove other cached data specific to the logged-out user
    // queryClient.removeQueries(); // Clears everything - use with caution

    // Redirect to login, use replace to prevent back button issues
    navigate({ to: "/login", replace: true })
  }

  // --- Return updated state and functions ---
  return {
    //signUpMutation,
    loginMutation,
    logout,
    user, // The fetched user data (UserPublic | undefined)
    isLoadingUser: isLoading, // Renamed for clarity
    userError, // Error object from the currentUser query
    //isLoggedIn: isLoggedIn(), // Function to check token presence
    isLoggedIn: !!user, // Better: isLoggedIn is true if the user object exists
  }
}

export { isLoggedIn }
export default useAuth
