import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const baselinePath = join(repositoryRoot, "config", "static-analysis-baseline.json");
const baseline = JSON.parse(readFileSync(baselinePath, "utf8")).jscpd;
const jscpdEntrypoint = join(repositoryRoot, "node_modules", "jscpd", "run-jscpd.js");

function invokeJscpd(arguments_) {
  const result = spawnSync(process.execPath, [jscpdEntrypoint, ...arguments_], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (result.error) {
    throw new Error(`Unable to execute jscpd: ${result.error.message}`);
  }
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`jscpd exited with status ${result.status}`);
  }
  return result.stdout.trim();
}

const version = invokeJscpd(["--version"]).match(/\d+\.\d+\.\d+/u)?.[0];
if (version !== baseline.version) {
  throw new Error(`Expected jscpd ${baseline.version}, received ${version ?? "unknown"}`);
}

const reportDirectory = mkdtempSync(join(tmpdir(), "perttool-jscpd-"));
try {
  invokeJscpd([
    "--config",
    ".jscpd.json",
    "--reporters",
    "json",
    "--output",
    reportDirectory,
    "--threshold",
    "100",
    "--no-colors",
    "--no-tips",
  ]);
  const report = JSON.parse(
    readFileSync(join(reportDirectory, "jscpd-report.json"), "utf8"),
  );
  const total = report.statistics?.total;
  if (!total) {
    throw new Error("jscpd did not return total statistics");
  }

  const limits = [
    ["clones", total.clones, baseline.maxClones],
    ["duplicated lines", total.duplicatedLines, baseline.maxDuplicatedLines],
    ["duplicated tokens", total.duplicatedTokens, baseline.maxDuplicatedTokens],
    ["duplication percentage", total.percentage, baseline.maxPercentage],
  ];
  const violations = limits.filter(([, actual, maximum]) => actual > maximum);
  if (violations.length > 0) {
    for (const [label, actual, maximum] of violations) {
      console.error(`Duplication regression: ${label} ${actual} exceeds ${maximum}`);
    }
    process.exitCode = 1;
  } else {
    console.log(
      `duplication gate passed (${total.clones} clones; ${total.duplicatedLines} lines; ${total.percentage.toFixed(3)}%; jscpd ${version})`,
    );
  }
} finally {
  rmSync(reportDirectory, { recursive: true, force: true });
}
