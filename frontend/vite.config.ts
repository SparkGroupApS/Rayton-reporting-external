import path from "node:path"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
  ],

  // Build optimization
  build: {
    // Suppress the warning for now (or increase if needed)
    //chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        manualChunks: {
          // Split Recharts into its own chunk (likely the biggest dependency)
          'recharts': ['recharts'],

          // Split React libraries
          //'react-vendor': ['react', 'react-dom'],

          // Split Chakra UI
          'chakra-vendor': ['@chakra-ui/react'],

          // Split TanStack libraries (Router + Query)
          'tanstack-vendor': ['@tanstack/react-router', '@tanstack/react-query'],
        },
      },
    },
  },

  server: {
    proxy: {
      // This proxies all requests starting with /api/v1
      '/api/v1': {
        // to your now-private backend
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true
      },
      '/webhook-pull-a8d9f': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  }
})
