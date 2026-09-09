import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Recharts (vía Tremor) es la mitad del bundle: en su propio chunk
        // para que no bloquee el primer render del login.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["@tremor/react", "recharts"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
})
