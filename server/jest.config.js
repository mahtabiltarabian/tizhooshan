// e2e tests against the real PostgreSQL in Docker (database tizhooshan_test).
/** @type {import('jest').Config} */
module.exports = {
  rootDir: ".",
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.e2e-spec.ts", "<rootDir>/test/**/*.spec.ts"],
  transform: { "^.+\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }] },
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  // The app's "@/..." alias, as in its tsconfig.json.
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/../src/$1" },
  setupFiles: ["<rootDir>/test/env.ts"],
  globalSetup: "<rootDir>/test/global-setup.ts",
  testTimeout: 30000,
};
