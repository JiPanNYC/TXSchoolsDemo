import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4174"
    }
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: true
  },
  test: {
    environment: "jsdom",
    setupFiles: "./tests/setup.ts"
  }
});
