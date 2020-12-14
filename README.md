# validate-name

Check npm package name validity and similarity, whether package name is

- similar to an existing package name in NPM registry.
- valid package name.

# Usage

## After Installation

```sh
validate-name my-package
```

## Without Installation

```sh
npx validate-name my-package
```

## Max Age

Use downloaded module list file for 1440 minutes (24 hours).

```sh
validate-name my-package --max-age 1440
```

# Installation

```sh
npm install -g validate-name
```

# Details

At first usage, this utility downloads list of all npm module names (apprx. 100-200 MB) and uses it to check whether your choosen name is syntacticly valid and not similar to name of an existing package.

File will be re-downloaded if it is older than `max-age` option (default 24 hours)

please wait until module names are downloaded. Downloaded file will be used for 24 hours to prevent re-download for every check.

# Note

This module is based on best effort. NPM's similarity algorithm is not open source, so this similarity check can not guarantee validity of your package name.
