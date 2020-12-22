/* eslint-disable no-param-reassign */
const CHARSET = "[_\\.\\-]*?";

/**
 * Return RegExp pattern for given package name.
 *
 * @author RobC <jsmith@example.com>
 * @see https://stackoverflow.com/users/1611459/robc
 *
 * @param pkgName is the package name to get RegExp.
 * @returns RegExp for given package name.
 */
export default function getRegExp(pkgName: string): RegExp {
  return RegExp(
    pkgName
      .split("")
      .map((char, i, arr) => {
        // 1. If the last letter is `s` then add `?` qualifier
        //    (i.e. zero or one) to test for non-plural instances.
        if (arr.length - 1 === i && char === "s") {
          char += "?";
        }

        // 2. Escape `.` character to handle it as a literal, then add `*?`
        //    qualifier (i.e. zero to unlimited) to test for names without `.`
        if (char === ".") return `\\${char}*?`;

        // 3. If character equals `-` or `_` then add `*?` qualifier
        //    (i.e. zero to unlimited) to test for names without `-` or `_`
        return char === "-" || char === "_" ? `${char}*?` : char;
      })

      // 4. Insert $CHARSET between each letter
      .join(CHARSET)

      // 5. Prefix string with $CHARSET
      .replace(/^/, CHARSET)

      // 6. Suffix string with $CHARSET
      .replace(/$/, CHARSET)

      // 7. Prefix string with ^
      .replace(/^/, "^")

      // 8. Suffix string with `s` and `?` qualifier
      //    (i.e. zero or one) to test for plural names.
      .concat("[s]?$"),
    "g"
  );
}
