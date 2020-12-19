import { promises } from "fs";

const { stat, readFile, unlink } = promises;

/**
 * Similar to readFile, but returns `undefined` if file can not be found.
 *
 * @param file is the path to file to read.
 * @returns file contents as string.
 */
export async function readFileSafe(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, { encoding: "utf8" });
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

/**
 * Gets last modification time of given file.
 *
 * @param file is the file to get last modification time.
 * @returns last modification time of given file or "ENOENT" string if file not found.
 */
async function getFileModificationTime(file: string): Promise<Date | undefined> {
  try {
    return (await stat(file)).mtime;
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

/**
 * Reads given JSON file and converts into plain object. If file is corrupted or cannot be parsed, deletes file.
 *
 * @param file is the file to read.
 * @returns plain object or undefined if file does not exist or deleted by this function.
 */
export async function readJSON<T>(file: string): Promise<T | undefined> {
  try {
    const content = await readFileSafe(file);
    return content !== undefined ? JSON.parse(content) : undefined;
  } catch (error) {
    if (error.message.includes("Unexpected end of JSON")) return unlink(file) as Promise<undefined>;
    throw error;
  }
}

/**
 * Tests whether given file's modification date is older than given max age in minutes.
 *
 * @param file is the file to test for maximum age.
 * @param maxAge is the maximum age in minutes.
 * @returns whether given file is older than given maximum age.
 */
export async function fileExpired(file: string, maxAge: number): Promise<boolean> {
  const modificationTime = await getFileModificationTime(file);
  if (modificationTime === undefined) return true;
  const ageInMinutes = Math.round((new Date().getTime() - modificationTime.getTime()) / 60000);
  return maxAge < ageInMinutes;
}
