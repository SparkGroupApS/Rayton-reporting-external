import { createSystem, defaultConfig } from "@chakra-ui/react"
import { buttonRecipe } from "./theme/button.recipe"

export const system = createSystem(defaultConfig, {
  globalCss: {
    html: {
      fontSize: "18px",
    },
    body: {
      fontSize: "0.75rem",
      margin: 0,
      padding: 0,
      fontFamily: "Montserrat, sans-serif",
      fontWeight: 500, // Default weight
    },
    ".main-link": {
      color: "ui.main",
      fontWeight: "bold",
    },
  },
  theme: {
    tokens: {
      fonts: {
        body: { value: "Montserrat, sans-serif" },
        heading: { value: "Montserrat, sans-serif" },
      },
      fontWeights: {
        thin: { value: 250 },
        semibold: { value: 600 },
        extrabold: { value: 800 },
      },
      colors: {
        ui: {
          main: { value: "#ffbe50" },
        },
        // Primary brand color palette (based on #ffbe50)
        rayton_orange: {
          50: { value: "#fffbf0" },
          100: { value: "#fff4d6" },
          200: { value: "#ffe9ad" },
          300: { value: "#ffde84" },
          400: { value: "#ffd35b" },
          500: { value: "#ffbe50" }, // Main customer color
          600: { value: "#e6a333" },
          700: { value: "#b38028" },
          800: { value: "#805c1d" },
          900: { value: "#4d3712" },
          950: { value: "#331f0a" },
        },
        // Neutral/Gray palette (based on #bfbebd)
        rayton_neutral: {
          50: { value: "#fafafa" },
          100: { value: "#f5f5f5" },
          200: { value: "#e5e5e5" },
          300: { value: "#d4d4d4" },
          400: { value: "#bfbebd" }, // Customer color
          500: { value: "#a3a2a1" },
          600: { value: "#737372" },
          700: { value: "#525251" },
          800: { value: "#3a3a39" },
          900: { value: "#1a1a1a" },
          950: { value: "#0a0a0a" },
        },
        // Black palette (based on #000000)
        rayton_black: {
          50: { value: "#f7f7f7" },
          100: { value: "#e3e3e3" },
          200: { value: "#c8c8c8" },
          300: { value: "#a4a4a4" },
          400: { value: "#717171" },
          500: { value: "#4a4a4a" },
          600: { value: "#2d2d2d" },
          700: { value: "#1f1f1f" },
          800: { value: "#141414" },
          900: { value: "#000000" }, // Customer color
          950: { value: "#000000" },
        },
      },
    },
    recipes: {
      button: buttonRecipe,
    },
    slotRecipes: {},
  },
})




  // main: { value: "#E89B3C" },
  //       },
  //       rayton_orange: {
  //         50: { value: "#FEF6EC" },
  //         100: { value: "#FCE7C9" },
  //         200: { value: "#FAD8A6" },
  //         300: { value: "#F7C983" },
  //         400: { value: "#F5BA60" },
  //         500: { value: "#E89B3C" },
  //         600: { value: "#D17E25" },
  //         700: { value: "#A8641D" },
  //         800: { value: "#7F4B16" },
  //         900: { value: "#56320E" },
  //         950: { value: "#3A2109" },
  // Extra-Bold (800)
{/* <Text fontWeight="extrabold">Heading Text</Text>

// Semi-Bold (600)
<Text fontWeight="semibold">Subheading Text</Text>

// Thin (250)
<Text fontWeight="thin">Body Text</Text>

// Or using numeric values directly
<Text fontWeight={800}>Heading</Text>
<Text fontWeight={600}>Subheading</Text>
<Text fontWeight={250}>Body</Text> */}