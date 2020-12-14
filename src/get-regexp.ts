/* eslint-disable no-param-reassign */
const CHARSET = "[_\\.\\-]*?";

/**
 * Return RegExp pattern for given package name.
 *
 * @param pkgName is the package name to get RegExp.
 * @returns RegExp for given package name.
 */
export default function getRegExp(pkgName: string): RegExp {
  return RegExp(
    pkgName
      .split("")
      .map((char, i, arr) => {
        // If last letter is `s` then add `?` qualifier (i.e. zero or one)
        // to test for non-plural instances.
        if (arr.length - 1 === i && char === "s") char += "?";

        // If character equals `-`, `_`, or `.` then add `*?` qualifier
        // (i.e. zero to unlimited) to test for names without `-`, `_`, or `.`
        return char === "-" || char === "_" || char === "." ? `${char}*?` : char;
      })

      // Insert $CHARSET between each letter
      .join(CHARSET)

      // Prefix string with $CHARSET
      .replace(/^/, CHARSET)

      // Suffix string with $CHARSET
      .replace(/$/, CHARSET)

      // Prefix string with ^
      .replace(/^/, "^")

      // Suffix string with `s` and `?` qualifier
      // (i.e. zero or one) to test for plural names.
      .concat("[s]?$"),
    "g"
  );
}
