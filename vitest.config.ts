import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["src/routes/__tests__/**/*.test.ts"],
    },
});

