import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";

const RANGE_START = 0;
const RANGE_END = 4_102_444_800;
const ARCHIVE_SHA256 =
  "e4a178a4477f3d0ea77cc31828ff72aa38feff8d61aa13e7e99e142e9d902be4";

function counts(bytes, offset) {
  return {
    ttisgmtcnt: bytes.readUInt32BE(offset + 20),
    ttisstdcnt: bytes.readUInt32BE(offset + 24),
    leapcnt: bytes.readUInt32BE(offset + 28),
    timecnt: bytes.readUInt32BE(offset + 32),
    typecnt: bytes.readUInt32BE(offset + 36),
    charcnt: bytes.readUInt32BE(offset + 40),
  };
}

function blockSize(value, timeSize) {
  return (
    value.timecnt * timeSize +
    value.timecnt +
    value.typecnt * 6 +
    value.charcnt +
    value.leapcnt * (timeSize + 4) +
    value.ttisstdcnt +
    value.ttisgmtcnt
  );
}

function readTime(bytes, offset, size) {
  return size === 8
    ? Number(bytes.readBigInt64BE(offset))
    : bytes.readInt32BE(offset);
}

function dataHeader(bytes) {
  const first = counts(bytes, 0);
  const version = bytes.toString("ascii", 4, 5);
  const modern = version === "2" || version === "3" || version === "4";
  const offset = modern ? 44 + blockSize(first, 4) : 0;
  return { offset, timeSize: modern ? 8 : 4, counts: counts(bytes, offset) };
}

function initialOffset(types, times, indices) {
  const initialIndex = types.findIndex(({ isDst }) => !isDst);
  let offset = types[Math.max(0, initialIndex)]?.offset;
  for (let index = 0; index < times.length && times[index] <= RANGE_START; index += 1) {
    offset = types[indices[index]]?.offset ?? offset;
  }
  return offset;
}

function compactTransitions(types, times, indices, name) {
  const offset = initialOffset(types, times, indices);
  if (offset === undefined) throw new Error(`${name} has no local-time type`);
  const result = [[RANGE_START, offset]];
  for (let index = 0; index < times.length; index += 1) {
    const instant = times[index];
    if (instant <= RANGE_START || instant >= RANGE_END) continue;
    const nextOffset = types[indices[index]]?.offset;
    if (nextOffset === undefined) throw new Error(`${name} has an invalid type index`);
    if (nextOffset !== result.at(-1)[1]) result.push([instant, nextOffset]);
  }
  return result;
}

function tzifTransitions(bytes, name) {
  if (bytes.toString("ascii", 0, 4) !== "TZif") {
    throw new Error(`${name} is not a TZif file`);
  }
  const header = dataHeader(bytes);
  const blockOffset = header.offset + 44;
  const indicesOffset = blockOffset + header.counts.timecnt * header.timeSize;
  const typesOffset = indicesOffset + header.counts.timecnt;
  const types = Array.from({ length: header.counts.typecnt }, (_, index) => ({
    offset: bytes.readInt32BE(typesOffset + index * 6),
    isDst: bytes[typesOffset + index * 6 + 4] === 1,
  }));
  const times = Array.from({ length: header.counts.timecnt }, (_, index) =>
    readTime(bytes, blockOffset + index * header.timeSize, header.timeSize));
  const indices = Array.from(
    bytes.subarray(indicesOffset, indicesOffset + header.counts.timecnt),
  );
  return compactTransitions(types, times, indices, name);
}

async function zoneFiles(directory, relative = "") {
  const result = [];
  for (const entry of await readdir(path.join(directory, relative), {
    withFileTypes: true,
  })) {
    const name = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) {
      if (!["posix", "right"].includes(entry.name)) {
        result.push(...await zoneFiles(directory, name));
      }
      continue;
    }
    const metadata = await lstat(path.join(directory, name));
    if ((metadata.isFile() || metadata.isSymbolicLink()) && !name.includes(".")) {
      result.push(name);
    }
  }
  return result;
}

function generatedSource(zones) {
  const serialized = `\{\n${zones.map(([name, values]) =>
    `  ${JSON.stringify(name)}: ${JSON.stringify(values)}`).join(",\n")}\n\}`;
  return `// Generated from IANA tzdata2026c. Do not edit by hand.\n` +
    `// Archive SHA-256: ${ARCHIVE_SHA256}\n` +
    `export const TZDB_2026C_RANGE = Object.freeze({ start: ${RANGE_START}, end: ${RANGE_END} });\n` +
    `export const TZDB_2026C_ARCHIVE_SHA256 = "${ARCHIVE_SHA256}" as const;\n` +
    `const transitions: Record<string, [number, number][]> = ${serialized};\n` +
    `for (const values of Object.values(transitions)) {\n` +
    `  for (const value of values) Object.freeze(value);\n` +
    `  Object.freeze(values);\n` +
    `}\n` +
    `export const TZDB_2026C_TRANSITIONS: Readonly<Record<string, readonly (readonly [number, number])[]>> = Object.freeze(transitions);\n`;
}

async function main() {
  const [archive, directory, output] = process.argv.slice(2);
  if (archive === undefined || directory === undefined || output === undefined) {
    throw new Error("usage: generate-tzdb-2026c.mjs <archive> <compiled-zoneinfo> <output.ts>");
  }
  const digest = createHash("sha256").update(await readFile(archive)).digest("hex");
  if (digest !== ARCHIVE_SHA256) {
    throw new Error(`expected tzdata2026c archive SHA-256 ${ARCHIVE_SHA256}`);
  }
  const names = (await zoneFiles(directory)).sort();
  const zones = [];
  for (const name of names) {
    const bytes = await readFile(path.join(directory, name));
    if (bytes.toString("ascii", 0, 4) !== "TZif") continue;
    zones.push([name, tzifTransitions(bytes, name)]);
  }
  await writeFile(output, generatedSource(zones), "utf8");
  process.stdout.write(`generated ${zones.length} zones in ${output}\n`);
}

await main();
