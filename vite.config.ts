import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = env.API_PROXY_TARGET ?? `http://localhost:${env.PORT ?? 4174}`;

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": apiProxyTarget
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
  };
});
