const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  testMatch: [
    "**/__tests__/**/*.test.ts",
    "**/*.test.ts"
  ],
  collectCoverageFrom: [
    "services/**/*.ts",
    "repositories/**/*.ts",
    "core/**/*.ts",
    "!**/*.d.ts",
    "!**/node_modules/**"
  ],
  coverageDirectory: "coverage",
  verbose: true,
};