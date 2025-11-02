import { createSystem, defaultConfig } from "@chakra-ui/react"
import { buttonRecipe } from "./theme/button.recipe"

export const system = createSystem(defaultConfig, {
  globalCss: {
    html: {
      fontSize: "16px",
    },
    body: {
      fontSize: "0.875rem",
      margin: 0,
      padding: 0,
    },
    ".main-link": {
      color: "ui.main",
      fontWeight: "bold",
    },
  },
  theme: {
    tokens: {
      colors: {
        ui: {
          //main: { value: "#009688" },
          main: { value: "#E89B3C" },
        },
        amber: {
          50: { value: "#FEF6EC" },
          100: { value: "#FCE7C9" },
          200: { value: "#FAD8A6" },
          300: { value: "#F7C983" },
          400: { value: "#F5BA60" },
          500: { value: "#E89B3C" },
          600: { value: "#D17E25" },
          700: { value: "#A8641D" },
          800: { value: "#7F4B16" },
          900: { value: "#56320E" },
          950: { value: "#3A2109" },
        },
      },
    },
    recipes: {
      button: buttonRecipe,
    },
  },
})
