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
  // Sin manualChunks a proposito: forzar Tremor/Recharts a un chunk fijo lo
  // metia en el grafo estatico del entry y Vite lo precargaba en el login.
  // Dejando que Rollup siga los lazy() de las rutas, cada pantalla se lleva
  // sus dependencias y el login no descarga la libreria de graficos.
  server: {
    port: 5173,
  },
})
