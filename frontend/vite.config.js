import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
    proxy: {
      // 开发期把 /api 代理到 Node.js 后端，避免 CORS 折腾
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
