/* eslint-disable @typescript-eslint/no-var-requires */
import { EOL } from "os";
import { join } from "path";
import { promises } from "fs";
import cliProgress from "cli-progress";
import fetch from "node-fetch";
import validatePackageNameSyntax from "validate-npm-package-name";
import { readJSON, fileExpired, readFileSafe } from "./helper";
import getRegExp from "./get-regexp";

const FetchProgress = require("node-fetch-progress");
const changes = require("concurrent-couch-follower");
const endOfStream = require("end-of-stream");

const { writeFile } = promises;

const URL_ALL = "https://replicate.npmjs.com/_all_docs";
const INFO_URL = "https://replicate.npmjs.com/";
const TICK = process.platform === "win32" ? "√" : "✔";
const CROSS = process.platform === "win32" ? "×" : "✖";

/**
 * Validator class to validate npm module names availability. Upon first use module downlaods all data.
 * For subsequent uses, it downloads only updates. npm stores updates with sequence numberss (similar to Primary Key in a DB).
 * It is possible to fetch updates from npm after specific sequence number. Same module may be updated several times,
 * so module names are stored in a set to prevent duplicate names. Updates are fetched using a mechanism called "follower".
 * npm provides `concurrent-couch-follower` utility module to follow updates. This utility module handles update downloads
 * and stores sequence number in a file to let further downloads continute where previous left off.
 */
export default class Validator {
  // Private cache attributes are used by accessor methods. Do not use them directly even in this class' methods outside of accessors.
  #cacheLocalSequence?: number;
  #cacheRemoteSequence?: number;
  #cacheData: Set<string> = new Set();
  #cacheIsExpired?: boolean;
  #cacheRemotePackageCount?: number;

  #maxAge: number;
  #approximateFullDownloadSize?: number;
  #downloadsDir: string;

  readonly #SEQUENCE_FILE: string;
  readonly #REGISTRY_FILE: string;

  constructor(options: { maxAge: number; downloadsDir: string }) {
    this.#maxAge = options.maxAge;
    this.#downloadsDir = options.downloadsDir;

    this.#SEQUENCE_FILE = join(this.#downloadsDir, ".sequence");
    this.#REGISTRY_FILE = join(this.#downloadsDir, "npm-registry.json");
  }

  //
  // ─── HELPER METHODS ─────────────────────────────────────────────────────────────
  //

  /** Fetches small summary data. This data is used for decision process for further operations. */
  private async cacheRemoteInfo(): Promise<void> {
    Validator.log("Updating info from remote npm registry server.");
    const response = await fetch(INFO_URL);
    const data = await response.json();
    this.#cacheRemoteSequence = data.update_seq as number;
    this.#approximateFullDownloadSize = Math.round(data.doc_count / 9.3); // Very rough empiric download size (in KB), because no content-size header is available.
    this.#cacheRemotePackageCount = data.doc_count;
  }

  /** Fetches all module names and sequence number, then writes them to data and sequence file. */
  private async fetchAll(): Promise<void> {
    const [remoteSequence, response] = await Promise.all([this.getRemoteSequence(), fetch(URL_ALL)]);
    const progress = new FetchProgress(response, { throttle: 100 });
    const sizeKB = await this.getApproximateFullDownloadSize(response.headers.get("content-length"));
    const sizeMB = Math.round(sizeKB / 1024);
    let currentSize = 0;

    Validator.log(`Downloading all names from remote npm server. (apprx. ${sizeMB} MB). Subsequent downloads will contain only updates.`);

    const bar = new cliProgress.SingleBar(
      { format: "{bar} {percentage}% | {done}/{total}MB | Elapsed: {elapsed}s | Speed: {speed}" },
      cliProgress.Presets.shades_classic
    );

    bar.start(sizeMB, 0, { total: sizeMB });

    progress.on("progress", (p: any) => {
      currentSize = parseFloat((p.done / (1024 * 1024)).toFixed(2));

      if (currentSize > sizeMB) bar.setTotal(currentSize);

      bar.update(currentSize, {
        percentage: Math.round(sizeKB / p.done),
        done: p.doneh,
        elapsed: Math.floor(p.elapsed),
        speed: p.rateh,
      });
    });

    const data = await response.json();
    bar.setTotal(currentSize);
    bar.stop();

    Validator.log("Cleaning data.");
    const packageNames: Set<string> = new Set(data.rows.map((row: any) => row.id));
    await Promise.all([this.setLocalData(packageNames), this.setLocalSequence(remoteSequence)]);
  }

  /** Fetches only changes and updates local data and sequence file. */
  async fetchUpdates(): Promise<void> {
    const [remoteSequence, localSequence, localData] = await Promise.all([
      this.getRemoteSequence(),
      this.getLocalSequence(),
      this.getLocalData(),
    ]);

    Validator.log("Fetching updates from remote npm server. Please waits.");

    const result = await new Promise((resolve, reject) => {
      const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
      const total = remoteSequence - (localSequence || 0);
      let currentCount = 0;
      bar.start(total, 0);

      const dataHandler = (data: any, done: any): void => {
        localData.add(data.id);
        currentCount += 1;
        if (currentCount > total) bar.setTotal(currentCount);
        bar.update(currentCount);
        done();
      };

      const pressure = changes(dataHandler, {
        db: INFO_URL,
        include_docs: false,
        sequence: this.#SEQUENCE_FILE,
        now: false,
        concurrency: 5,
      });
      const interval = setInterval(() => {
        if (pressure.sequence() >= remoteSequence) {
          clearInterval(interval);
          bar.setTotal(currentCount);
          bar.stop();
          pressure.end();
        }
      }, 50);

      endOfStream(pressure, (error?: Error) => {
        if (error && !error.message.includes("premature close")) return reject(error);
        return resolve(this.setLocalData(localData));
      });
    });
    return result as any;
  }

  /** Logs given message to console. May be developed in future to provide better logging. */
  private static log(message: string): void {
    console.log(message); // eslint-disable-line class-methods-use-this
  }

  //
  // ─── DATA ACCESSORS ─────────────────────────────────────────────────────────────
  //

  /** Gets all module names from cache or from file if cache is empty. */
  private async getLocalData(): Promise<Set<string>> {
    if (this.#cacheData.size === 0) this.#cacheData = new Set((await readJSON<string[]>(this.#REGISTRY_FILE)) || []);
    return this.#cacheData;
  }

  /** Updates cache of module names and writes to file. */
  private async setLocalData(packageNames: Set<string>): Promise<void> {
    await writeFile(this.#REGISTRY_FILE, JSON.stringify(Array.from(packageNames)));
    this.#cacheData = packageNames;
  }

  /** Gets sequence number from cache or from file if cache is empty. */
  private async getLocalSequence(): Promise<number | undefined> {
    if (this.#cacheLocalSequence === undefined) {
      const content = await readFileSafe(this.#SEQUENCE_FILE);
      this.#cacheLocalSequence = content ? parseInt(content, 10) : undefined;
    }
    return this.#cacheLocalSequence;
  }

  /** Updates cache of sequence number and writes to file. */
  private async setLocalSequence(sequence: number): Promise<void> {
    await writeFile(this.#SEQUENCE_FILE, sequence.toString(), { encoding: "utf8" });
    this.#cacheLocalSequence = sequence;
  }

  /** Gets latest sequence number from cache or from npm server. */
  private async getRemoteSequence(): Promise<number> {
    if (this.#cacheRemoteSequence === undefined) await this.cacheRemoteInfo();
    return this.#cacheRemoteSequence as number;
  }

  /** Updates cache of latest remote sequence number. */
  private async getRemotePackageCount(): Promise<number> {
    if (this.#cacheRemotePackageCount === undefined) await this.cacheRemoteInfo();
    return this.#cacheRemotePackageCount as number;
  }

  /**
   * Gets rough download size for download operation of all modules empirically,
   * because full download page of npm server does not return `content-length` header
   * and this makes impossible to use progress bar. Returns result from cache if possible.
   */
  private async getApproximateFullDownloadSize(size?: string | null): Promise<number> {
    if (size) return Math.ceil(parseInt(size, 10));
    if (this.#approximateFullDownloadSize === undefined) await this.cacheRemoteInfo();
    return this.#approximateFullDownloadSize as number;
  }

  /** Returns whether downloaded data is expired according to `maxAge` options provided to constructor. */
  private async isExpired(): Promise<boolean> {
    if (this.#cacheIsExpired === undefined) this.#cacheIsExpired = await fileExpired(this.#REGISTRY_FILE, this.#maxAge);
    return this.#cacheIsExpired as boolean;
  }

  /** Tries to guess whether downloading full list or following only updates could be faster. */
  private async shouldFetchAll(): Promise<boolean> {
    const [localSequence, remoteSequence] = await Promise.all([this.getLocalSequence(), this.getRemoteSequence()]);
    const remotePackageCount = await this.getRemotePackageCount();
    const missingSequences = remoteSequence - (localSequence || 0);
    return missingSequences / 6 > remotePackageCount; // Approximately downloading 6 sequence updates takes same time downloading 1 pacakge.
  }

  //
  // ─── OPERATIONS ─────────────────────────────────────────────────────────────────
  //

  /**
   * Validates given package name and returns result lines to be logged to console.
   *
   * @param pkgName is the package name to validate.
   * @returns lines to log.
   */
  private async validate(pkgName: string): Promise<string[]> {
    if (await this.isExpired()) {
      if (await this.shouldFetchAll()) await this.fetchAll();
      else await this.fetchUpdates();
    }

    const regexp = getRegExp(pkgName);
    const message: string[] = [];
    const result: string[] = [];
    const syntaxValidation = validatePackageNameSyntax(pkgName);

    if (!syntaxValidation.validForNewPackages) {
      message.push(`\x1b[31m${CROSS}\x1b[0m  "${pkgName}" is invalid:`);
      message.push((syntaxValidation.errors ?? []).join(EOL));
      return message;
    }

    const packageNames = await this.getLocalData();
    packageNames?.forEach((pkg) => {
      if (regexp.test(pkg)) result.push(pkg);
    });

    if (result.length) {
      message.push(`\x1b[31m${CROSS}\x1b[0m  "${pkgName}" is unavailable:`);
      message.push(...result.map((existingName: string) => `${existingName} is taken.`));
    } else {
      message.push(`\x1b[32m${TICK}\x1b[0m  "${pkgName}" is available.`);
    }
    return message;
  }

  //
  // ─── PUBLIC METHODS ─────────────────────────────────────────────────────────────
  //

  /**
   * Validates given package name and returns result lines to be logged to.
   *
   * @param pkgName is the package name to validate.
   * @param __namedParameters are options.
   * @param maxAge is the maximum age of downloaded file can be used before updating it.
   * @param downloadsDir is the directory to download files to.
   * @returns lines to log.
   */
  public static async validate(pkgName: string, { maxAge = 60, downloadsDir = join(__dirname, "../downloads") } = {}): Promise<string[]> {
    return new Validator({ maxAge, downloadsDir }).validate(pkgName);
  }
}
