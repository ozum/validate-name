#!/usr/bin/env node
import yargs from "yargs";
import { EOL } from "os";
import Validator from "../validator";

/**
 *  A utiliy to help identify whether your chosen package
 *  name already exists with a similar name in the npm registry. See:
 *  https://blog.npmjs.org/post/168978377570/new-package-moniker-rules)
 *
 *  @example
 *     validate-name <pkg-name> --max-age [max-age]
 *     validate-name "<pkg-name>" --max-age [max-age]
 */

// Source: https://paste.ee/p/DdxFJ

/** CLI interface */
const { argv } = yargs
  .command("$0 <package-name>", "Validate package name and check similarity to existing package names on NPM registry.", (args) =>
    args.positional("packageName", { type: "string", demandOption: true, describe: "Package name to validate." })
  )
  .option("maxAge", { type: "number", description: "Time in minutes before re-download list of all modules.", default: 60 })
  .option("url", { type: "string", description: "URL to get info for package names.", default: "https://replicate.npmjs.com/" })
  .option("urlAll", { type: "string", description: "URL to get all package names.", default: "https://replicate.npmjs.com/_all_docs" })
  .help()
  .strict();

Validator.validate(argv.packageName, { ...argv }).then((messages) => console.log(messages.join(EOL)));
