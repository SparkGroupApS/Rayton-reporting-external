// src/routes/login.tsx
import {
  Container,
  Image,
  Input,
  Text,
  Box,
  Flex,
  Heading,
  Tabs,
  VStack,
} from "@chakra-ui/react";
import { createFileRoute, Link as RouterLink, redirect } from "@tanstack/react-router";
import { type SubmitHandler, useForm } from "react-hook-form";
import { FiLock, FiMail } from "react-icons/fi";

import {
  type Body_login_login_access_token as AccessToken,
  ApiError,
} from "@/client";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { InputGroup } from "@/components/ui/input-group";
import { PasswordInput } from "@/components/ui/password-input";
import useAuth, { isLoggedIn } from "@/hooks/useAuth";
import Logo from "/assets/images/rayton_black.png";
import { emailPattern, passwordRules } from "../utils";

export const Route = createFileRoute("/login")({
  component: Login,
  beforeLoad: async () => {
    if (isLoggedIn()) {
      throw redirect({
        to: "/",
      });
    }
  },
});

function Login() {
  const { loginMutation } = useAuth();
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
  });

  const onSubmit: SubmitHandler<AccessToken> = async (data) => {
    if (isSubmitting) return;

    try {
      await loginMutation.mutateAsync(data);
    } catch (e) {
      console.error("Error during login:", e);
    }
  };

  return (
    <Flex
      h="100vh"
      w="100%"
      alignItems="center"
      justifyContent="center"
      position="relative"
      overflow="hidden"
      _before={{
        content: '""',
        position: "absolute",
        inset: 0,
        backgroundImage: "url('/assets/images/solar_plant.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        filter: "blur(8px)",
        opacity: 0.6, // прозрачность фона
        zIndex: 0,
      }}
    >
      <Box
        position="relative"
        zIndex={1}
        bg="whiteAlpha.800"
        _dark={{
          bg: "blackAlpha.600",
          shadow: "xl",
        }}
        shadow="md"
        rounded="lg"
        p={{ base: 6, md: 8 }}
        w="full"
        maxW="md"
        backdropFilter="blur(10px)"
      >
        {/* Logo */}
        <Image src={Logo} alt="FastAPI logo" height="auto" w="150px" mx="auto" mb={6} />

        <VStack as="form" onSubmit={handleSubmit(onSubmit)} gap={4} align="stretch">
          {/* Error Message */}
          {loginMutation.error && (
            <Text color="red.500" fontSize="sm" textAlign="center">
              {loginMutation.error instanceof ApiError &&
              typeof loginMutation.error.body === "object" &&
              loginMutation.error.body !== null &&
              "detail" in loginMutation.error.body
                ? String(loginMutation.error.body.detail)
                : loginMutation.error.message}
            </Text>
          )}

          {/* Username Field */}
          <Field invalid={!!errors.username} errorText={errors.username?.message}>
            <InputGroup w="100%" startElement={<FiMail />}>
              <Input
                {...register("username", {
                  required: "Username is required",
                  pattern: emailPattern,
                })}
                placeholder="Email"
                type="email"
                _placeholder={{ color: "gray.400", opacity: 0.7 }}
                bg="white"
                color="gray.800"
                borderRadius="md"
              />
            </InputGroup>
          </Field>

          {/* Password Field */}
          <PasswordInput
            type="password"
            startElement={<FiLock />}
            {...register("password", passwordRules())}
            placeholder="Password"
            errors={errors}
            _placeholder={{ color: "gray.400", opacity: 0.7 }}
            bg="white"
            color="gray.800"
          />

          {/* Forgot Password Link */}
          <Box textAlign="right" fontSize="sm">
            <RouterLink to="/recover-password" className="main-link">
              Forgot Password?
            </RouterLink>
          </Box>

          {/* Log In Button */}
          <Button variant="solid" type="submit" loading={isSubmitting} size="md">
            Log In
          </Button>

          {/* Optional Sign Up Link */}
          {/* 
          <Text textAlign="center" fontSize="sm">
            Don't have an account?{" "}
            <RouterLink to="/signup" className="main-link">
              Sign Up
            </RouterLink>
          </Text>
          */}
        </VStack>
      </Box>
    </Flex>
  );
}

export default Login;
