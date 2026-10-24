import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// Minimal typing so API_TARGET can override the dev/preview proxy without pulling in @types/node.
declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: { output: { manualChunks: { recharts: ["recharts"] } } },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: process.env.API_TARGET ?? "http://localhost:8000", changeOrigin: true },
    },
  },
});
