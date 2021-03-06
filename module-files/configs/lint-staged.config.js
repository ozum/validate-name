// Eslint generates warning, which cannot be surpassed, if a staged file to be linted is in ignored files list.
// Git ignored files are not present in staged files already. So use `--no-ignore` instead of `--ignore-path .gitignore`
const lint = "eslint --no-ignore --cache --max-warnings 0 --fix";
const format = "prettier --write";
const test = "jest --bail --coverage --findRelatedTests --config jest.config.js";

module.exports = {
  "*.{jsx,tsx,vue}": [lint],
  "*.{js,ts}": [lint, test],
  "*.{json,less,css,md,gql,graphql,html,yaml}": [format],
};
