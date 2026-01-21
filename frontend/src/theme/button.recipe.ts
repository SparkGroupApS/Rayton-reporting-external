import { defineRecipe } from "@chakra-ui/react";

export const buttonRecipe = defineRecipe({
  base: {
    fontWeight: "semibold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "md",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  variants: {
    variant: {
      solid: {
        bg: "rayton_neutral.600",
        color: "white",
        _hover: {
          bg: "rayton_neutral.500",
        },
        _active: {
          bg: "rayton_neutral.400",
        },
        "&[data-active=true]": {
          bg: "rayton_orange.500",
          color: "rayton_black.900",
          _hover: {
            bg: "rayton_orange.600",
          },
        },
      },
      outline: {
        borderWidth: "1px",
        borderColor: "rayton_neutral.600",
        color: "rayton_neutral.600",
        bg: "transparent",
        _hover: {
          bg: "rayton_neutral.50",
        },
        _active: {
          bg: "rayton_neutral.100",
        },
        "&[data-active=true]": {
          borderColor: "rayton_orange.500",
          color: "rayton_orange.500",
          bg: "rayton_orange.50",
        },
      },
      ghost: {
        bg: "transparent",
        color: "rayton_neutral.600",
        _hover: {
          bg: "rayton_neutral.100",
        },
        "&[data-active=true]": {
          bg: "rayton_orange.100",
          color: "rayton_orange.700",
        },
      },
    },
    size: {
      sm: {
        fontSize: "0.875rem",
        px: "3",
        py: "2",
        h: "8",
      },
      md: {
        fontSize: "1rem",
        px: "4",
        py: "2.5",
        h: "10",
      },
      lg: {
        fontSize: "1.125rem",
        px: "6",
        py: "3",
        h: "12",
      },
    },
  },
  defaultVariants: {
    variant: "solid",
    size: "md",
  },
});