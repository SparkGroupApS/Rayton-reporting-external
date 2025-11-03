// src/routes/login.tsx
import {
  Container,
  Image,
  Input,
  Text,
  // --- Add new layout components ---
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
  ApiError, // <-- ADD THIS
} from "@/client"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { InputGroup } from "@/components/ui/input-group"
import { PasswordInput } from "@/components/ui/password-input"
import useAuth, { isLoggedIn } from "@/hooks/useAuth"
import Logo from "/assets/images/rayton_black.png"
import { emailPattern, passwordRules } from "../utils"

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
      // API errors are handled by loginMutation.onError
      console.error("Error during login:", e);
    }
  };

  return (
    // 1. Outer Flex container to center the login card on the page
    <Flex
      h="100vh"
      w="100%"
      alignItems="center"
      justifyContent="center"
      backgroundImage="url('/assets/images/background_big.png')"
      backgroundSize="cover"
      backgroundPosition="center"
      backgroundRepeat="no-repeat">
      {/* 2. The main login card/panel */}
      <Box
        bg="whiamberpha.700"
        _dark={{
          bg: "gray.700",
          shadow: "xl",
        }}
        shadow="md"
        //shadow="2xl var(--shadow-color)"
        //shadowColor="red"
        rounded="lg"
        p={{ base: 6, md: 8 }} // Responsive padding
        w="full"
        maxW="md" // Set a max width for the card
        backdropFilter="blur(10px)" // Add blur effect to make the form stand out against the background
      >
        {/* Logo */}
        <Image src={Logo} alt="FastAPI logo" height="auto" w="150px" mx="auto" mb={6} />
        {/* <Heading as="h1" size="lg" textAlign="center" mb={6}>
          Log In
        </Heading> */}

        {/* 3. Tabbed interface */}
        {/* <Tabs.Root variant="enclosed" colorScheme="blue" defaultValue="email">
          <Tabs.List>
            <Tabs.Trigger value="email">E-mail</Tabs.Trigger>
            {/* We disable the other tabs since they aren't implemented */}
        {/*<Tabs.Trigger value="phone" disabled>
              Phone
            </Tabs.Trigger>
            <Tabs.Trigger value="username" disabled>
              Username
            </Tabs.Trigger>
          </Tabs.List>

          
          {/* 4. E-mail Panel */}
        {/*<Tabs.Content value="email" pt={6}> */}
        {/* 5. Your existing form, now as a VStack */}
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
            <InputGroup 
              w="100%" 
              startElement={<FiMail />}
            >
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

          {/* Sign Up Link (I've kept it commented out as in your file) */}
          {/*
              <Text textAlign="center" fontSize="sm">
                Don't have an account?{" "}
                <RouterLink to="/signup" className="main-link">
                  Sign Up
                </RouterLink>
              </Text>
              */}
        </VStack>
        {/* </Tabs.Content> */}

        {/* 6. Placeholders for the other panels */}
        {/* <Tabs.Content value="phone">
            <Box p={4} textAlign="center" color="gray.500">
              Phone login is not yet available.
            </Box>
          </Tabs.Content>
          <Tabs.Content value="username">
            <Box p={4} textAlign="center" color="gray.500">
              Username login is not yet available.
            </Box>
          </Tabs.Content>
          
        </Tabs.Root> */}
      </Box>
    </Flex>
  );
}
