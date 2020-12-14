module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/node_modules/", "/test-helper/", "/__test__/", "<rootDir>/.eslintrc.js"],
};
