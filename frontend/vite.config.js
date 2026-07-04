import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // CRUD → Express backend
      "/api": { target: "http://localhost:5000", changeOrigin: true },
      // AI agent (chat + predictive insights) → Python FastAPI agent
      "/agent": { target: "http://localhost:8000", changeOrigin: true },
      "/insights": { target: "http://localhost:8000", changeOrigin: true },
      "/health": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
