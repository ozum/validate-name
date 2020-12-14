import validatePackageNameSyntax from "validate-npm-package-name";
import { EOL } from "os";
import getRegExp from "./get-regexp";
import fetchUrl from "./fetch-url";

/**
 * Interface for downloaded NPM registry data.
 */
export interface Registry {
  total_rows: number; // eslint-disable-line camelcase
  offset: number;
  rows: Array<{
    id: string;
    key: string;
    value: { rev: string };
  }>;
}

const URL = "https://replicate.npmjs.com/_all_docs";
const TICK = process.platform === "win32" ? "√" : "✔";
const CROSS = process.platform === "win32" ? "×" : "✖";

/**
 * Validates given package name and logs results to console.
 *
 * @param pkgName is the package name to validate.
 * @param __namedParameters are options.
 * @param maxAge is the maximum time in minutes before saved file is expired.
 * @returns lines to log.
 */
export async function validatePackage(pkgName: string, { maxAge = 1440, file = "npm-registry.json" } = {}): Promise<string[]> {
  const syntaxValidation = validatePackageNameSyntax(pkgName);
  const message: string[] = [];

  if (!syntaxValidation.validForNewPackages) {
    message.push(`\x1b[31m${CROSS}\x1b[0m  "${pkgName}" is invalid:`);
    message.push((syntaxValidation.errors ?? []).join(EOL));
    return message;
  }

  const npmRegistry = await fetchUrl<Registry>(file, URL, { maxAge, size: 140 });
  const regexp = getRegExp(pkgName);
  const result = npmRegistry.rows.filter((pkg) => regexp.test(pkg.id)).map((pkg) => pkg.id);

  if (result.length) {
    message.push(`\x1b[31m${CROSS}\x1b[0m  "${pkgName}" is unavailable:`);
    message.push(...result);
  } else {
    message.push(`\x1b[32m${TICK}\x1b[0m  "${pkgName}" is available.`);
  }
  return message;
}
