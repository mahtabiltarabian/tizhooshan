import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The server has its own tests (server/), against a real database.
  test: { exclude: ["**/node_modules/**", "server/**"] },
  resolve: {
    // Same "@/..." import alias as tsconfig.json.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
