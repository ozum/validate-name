const baseConfig = require("./module-files/configs/jest.config.js"); // eslint-disable-line import/no-unresolved

module.exports = {
  ...baseConfig,
  coverageThreshold: { global: { branches: 0, functions: 0, lines: 0, statements: 0 } },
};
