module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/tests/unit"],
  testMatch: ["**/*.test.ts"],
  clearMocks: true,
  restoreMocks: true,
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
  "^.+\\.ts$": ["ts-jest", { tsconfig: "<rootDir>/tests/tsconfig.json" }]
},
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  collectCoverageFrom: [
    "src/queries/login.ts",
    "src/queries/signup.ts",
    "src/queries/emailVerification.ts",
    "src/middleware/auth.ts",
  ],
};
