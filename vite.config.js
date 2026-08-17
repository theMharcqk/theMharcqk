import { defineConfig } from "vite";
import netlify from "@netlify/vite-plugin";

export default defineConfig({
  plugins: [netlify()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
  },
  server: {
    host: true,
    port: 5173,
  },
});
