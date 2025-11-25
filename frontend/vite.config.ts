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
// --- ADD THIS BLOCK ---
  server: {
    proxy: {
      // This proxies all requests starting with /api/v1
      '/api/v1': {
        // to your now-private backend
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true
      },
	// --- ADD THIS BLOCK ---
      '/webhook-pull-a8d9f': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
      // ----------------------
    }
  }
})
