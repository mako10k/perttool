#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const allowlistPath =
  "test/fixtures/english-baseline/japanese-script-allowlist.v1.json";
const japaneseScriptPattern =
  /[\u3041-\u3093\u30a1-\u30f3\u4e00-\u9fa0]/u;
const schema = "Perttool.EnglishBaselineJapaneseScriptAllowlist.v1";

function entryKey(entry) {
  return `${entry.path}\u0000${entry.line}`;
}

function compareText(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function validateAllowlist(allowlist) {
  const errors = [];
  if (
    typeof allowlist !== "object" ||
    allowlist === null ||
    Array.isArray(allowlist)
  ) {
    return ["allowlist: expected an object"];
  }
  if (allowlist.schema !== schema) {
    errors.push(`allowlist: expected schema ${schema}`);
  }
  if (!Array.isArray(allowlist.entries)) {
    errors.push("allowlist: entries must be an array");
    return errors;
  }

  let previousKey = null;
  const keys = new Set();
  for (const [index, entry] of allowlist.entries.entries()) {
    const location = `allowlist.entries[${index}]`;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      errors.push(`${location}: expected an object`);
      continue;
    }
    if (
      typeof entry.path !== "string" ||
      entry.path.length === 0 ||
      path.posix.isAbsolute(entry.path) ||
      entry.path.includes("\\") ||
      entry.path.split("/").includes("..")
    ) {
      errors.push(`${location}.path: expected a safe repository-relative path`);
    }
    if (
      typeof entry.line !== "string" ||
      !japaneseScriptPattern.test(entry.line)
    ) {
      errors.push(`${location}.line: expected an exact Japanese-script line`);
    }
    if (!Number.isSafeInteger(entry.occurrences) || entry.occurrences < 1) {
      errors.push(`${location}.occurrences: expected a positive integer`);
    }
    if (typeof entry.reason !== "string" || entry.reason.trim().length === 0) {
      errors.push(`${location}.reason: expected a non-empty reason`);
    }

    if (typeof entry.path === "string" && typeof entry.line === "string") {
      const key = entryKey(entry);
      if (keys.has(key)) {
        errors.push(`${location}: duplicate path and line`);
      }
      if (previousKey !== null && compareText(key, previousKey) < 0) {
        errors.push(`${location}: entries must be sorted by path and line`);
      }
      keys.add(key);
      previousKey = key;
    }
  }
  return errors;
}

export function auditJapaneseScriptFiles(files, allowlist) {
  const errors = validateAllowlist(allowlist);
  if (errors.length > 0) {
    return { errors, matchCount: 0 };
  }

  const entries = new Map(
    allowlist.entries.map((entry) => [
      entryKey(entry),
      { ...entry, observed: 0 },
    ]),
  );
  let matchCount = 0;

  for (const file of [...files].sort((left, right) =>
    compareText(left.path, right.path),
  )) {
    const lines = file.text.split("\n");
    for (const [index, rawLine] of lines.entries()) {
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
      if (!japaneseScriptPattern.test(line)) continue;

      matchCount += 1;
      const entry = entries.get(entryKey({ path: file.path, line }));
      if (entry === undefined || entry.observed >= entry.occurrences) {
        errors.push(
          `${file.path}:${index + 1}: Japanese-script content is not allowlisted`,
        );
        continue;
      }
      entry.observed += 1;
    }
  }

  for (const entry of entries.values()) {
    if (entry.observed !== entry.occurrences) {
      errors.push(
        `${entry.path}: allowlisted line expected ${entry.occurrences} occurrence(s), observed ${entry.observed}`,
      );
    }
  }
  return { errors, matchCount };
}

export async function auditEnglishBaseline(repositoryRoot) {
  const parsedAllowlist = JSON.parse(
    await readFile(path.join(repositoryRoot, allowlistPath), "utf8"),
  );
  const { stdout } = await execFileAsync(
    "git",
    ["ls-files", "-co", "--exclude-standard", "-z"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  const repositoryPaths = stdout
    .split("\u0000")
    .filter(Boolean)
    .sort(compareText);
  const files = [];
  for (const repositoryPath of repositoryPaths) {
    const content = await readFile(path.join(repositoryRoot, repositoryPath));
    if (content.includes(0)) continue;
    files.push({ path: repositoryPath, text: content.toString("utf8") });
  }

  return {
    ...auditJapaneseScriptFiles(files, parsedAllowlist),
    fileCount: files.length,
  };
}

async function main() {
  const { stdout } = await execFileAsync(
    "git",
    ["rev-parse", "--show-toplevel"],
    { encoding: "utf8" },
  );
  const result = await auditEnglishBaseline(stdout.trim());
  if (result.errors.length > 0) {
    for (const error of result.errors) {
      process.stderr.write(`${error}\n`);
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `English baseline language check passed (${result.fileCount} text files, ${result.matchCount} allowlisted lines)\n`,
  );
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
