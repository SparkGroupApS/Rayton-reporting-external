import { defineRecipe } from "@chakra-ui/react"

export const buttonRecipe = defineRecipe({
  base: {
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  variants: {
    variant: {
      solid: {
        bg: "amber.500",
        color: "white",
        _hover: {
          bg: "amber.600",
        },
        _active: {
          bg: "amber.700",
        },
      },
      ghost: {
        bg: "transparent",
        color: "amber.500",
        _hover: {
          bg: "amber.50",
        },
      },
    },
  },
  defaultVariants: {
    variant: "solid",
  },
})
