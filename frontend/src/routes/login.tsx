import { Container, Image, Input, Text } from "@chakra-ui/react"
import {
  createFileRoute,
  Link as RouterLink,
  redirect,
} from "@tanstack/react-router"
import { type SubmitHandler, useForm } from "react-hook-form"
import { FiLock, FiMail } from "react-icons/fi"

import {
  type Body_login_login_access_token as AccessToken,
  ApiError, // <-- ADD THIS
} from "@/client"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { InputGroup } from "@/components/ui/input-group"
import { PasswordInput } from "@/components/ui/password-input"
import useAuth, { isLoggedIn } from "@/hooks/useAuth"
import Logo from "/assets/images/fastapi-logo.svg"
import { emailPattern, passwordRules } from "../utils"

export const Route = createFileRoute("/login")({
  component: Login,
  beforeLoad: async () => {
    if (isLoggedIn()) {
      throw redirect({
        to: "/",
      })
    }
  },
})

function Login() {
  // REMOVE error, resetError from here
  const { loginMutation } = useAuth()
  //const { loginMutation, error, resetError } = useAuth()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AccessToken>({
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      username: "",
      password: "",
    },
  })

  const onSubmit: SubmitHandler<AccessToken> = async (data) => {
    if (isSubmitting) return

    //resetError()

    try {
      await loginMutation.mutateAsync(data)
    } catch (e) {
      // This catch might handle errors thrown *before* the API call
      // API errors are handled by loginMutation.onError in useAuth
      console.error("Error during login mutation setup:", e)
    }
  }

  return (
    <Container
      as="form"
      onSubmit={handleSubmit(onSubmit)}
      h="100vh"
      maxW="sm"
      alignItems="stretch"
      justifyContent="center"
      gap={4}
      centerContent
    >
      <Image
        src={Logo}
        alt="FastAPI logo"
        height="auto"
        maxW="2xs"
        alignSelf="center"
        mb={4}
      />
      {loginMutation.error && (
        <Text color="red.500" fontSize="sm" textAlign="center">
          {/* Safely access error details */}
          {loginMutation.error instanceof ApiError &&
          typeof loginMutation.error.body === "object" &&
          loginMutation.error.body !== null &&
          "detail" in loginMutation.error.body
            ? String(loginMutation.error.body.detail)
            : loginMutation.error.message}
        </Text>
      )}

      <Field
        invalid={!!errors.username}
        // Update errorText to check mutation error OR form error
        errorText={
          errors.username
            ?.message /* || (loginMutation.error ? "Login failed" : undefined) */
        }
      >
        <InputGroup w="100%" startElement={<FiMail />}>
          <Input
            {...register("username", {
              required: "Username is required",
              pattern: emailPattern,
            })}
            placeholder="Email"
            type="email"
          />
        </InputGroup>
      </Field>
      <PasswordInput
        type="password"
        startElement={<FiLock />}
        {...register("password", passwordRules())}
        placeholder="Password"
        errors={errors}
      />
      <RouterLink to="/recover-password" className="main-link">
        Forgot Password?
      </RouterLink>
      <Button variant="solid" type="submit" loading={isSubmitting} size="md">
        Log In
      </Button>
      <Text>
        Don't have an account?{" "}
        <RouterLink to="/signup" className="main-link">
          Sign Up
        </RouterLink>
      </Text>
    </Container>
  )
}
