import { join } from "path";
import { promises } from "fs";
import proload from "proload";

const { stat, readFile, mkdir, unlink } = promises;

/**
 * Gets last modification time of given file.
 *
 * @param file is the file to get last modification time.
 * @returns last modification time of given file.
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
 * Reads given JSON file and converts into plain object.
 *
 * @param file is the file to read.
 * @returns plain object.
 */
async function getFileData<T>(file: string): Promise<T | undefined | void> {
  try {
    return JSON.parse(await readFile(file, { encoding: "utf8" }));
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    if (error.message.includes("Unexpected end of JSON")) return unlink(file);

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
async function isExpired(file: string, maxAge: number): Promise<boolean> {
  const modificationTime = await getFileModificationTime(file);
  if (modificationTime === undefined) return false;
  const ageInMinutes = Math.round((new Date().getTime() - modificationTime.getTime()) / 60000);
  return maxAge < ageInMinutes;
}

/**
 * Fetches JSON from given URL and returns it after storing to a file. Subsequent requests use saved file
 * if file is not expired based on given max-age (in minutes).
 *
 * @param saveAs is the path of the file to save results for subsequent calls.
 * @param url is the URL to get JSON data.
 * @param __namedParameters are options.
 * @param maxAge is the maximum time in minutes before saved file is expired.
 * @param size is the size size in MB to report approximate file size for URL's which does not report download size.
 * @returns plain object of JSON data from given URL.
 */
export default async function fetchUrl<T = any>(
  saveAs: string,
  url: string,
  { maxAge, size }: { maxAge: number; size?: number }
): Promise<T> {
  const dirPath = join(__dirname, "../downloads");
  const filePath = join(dirPath, saveAs);
  const [data, expired] = await Promise.all([getFileData<T>(filePath), isExpired(filePath, maxAge), mkdir(dirPath, { recursive: true })]);

  if (!expired && data !== undefined) return data as T;
  const sizeMessage = size ? ` It could take time depending on your connection speed. File size is approximately ${size} MB.` : "";

  console.info(`Please wait while downloading.${sizeMessage}`);
  await proload(url, filePath as any);
  return fetchUrl(saveAs, url, { maxAge: 999999 });
}
