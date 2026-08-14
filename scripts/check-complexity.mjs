import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const baselinePath = join(repositoryRoot, "config", "static-analysis-baseline.json");
const baseline = JSON.parse(readFileSync(baselinePath, "utf8")).lizard;
const sourcePaths = [
  "src",
  "adapters/lsp/src",
  "adapters/lsp/runtime",
  "adapters/mcp/src",
  "adapters/vscode/src",
  "scripts",
];

function invokeLizard(arguments_) {
  const result = spawnSync("lizard", arguments_, {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
  if (result.error) {
    throw new Error(
      `Unable to execute lizard ${baseline.version}; install requirements-static-analysis.txt`,
    );
  }
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`lizard exited with status ${result.status}`);
  }
  return result.stdout.trim();
}

function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }
  fields.push(field);
  return fields;
}

const version = invokeLizard(["--version"]).match(/\d+\.\d+\.\d+/u)?.[0];
if (version !== baseline.version) {
  throw new Error(`Expected lizard ${baseline.version}, received ${version ?? "unknown"}`);
}

const csv = invokeLizard([
  "--languages",
  "typescript",
  "--languages",
  "javascript",
  "--csv",
  ...sourcePaths,
]);
const currentViolations = new Map();
let functionCount = 0;
for (const line of csv.split("\n")) {
  if (line.length === 0) continue;
  const fields = parseCsvLine(line);
  if (fields.length < 8) throw new Error(`Unexpected lizard CSV row: ${line}`);
  functionCount += 1;
  const metrics = {
    cyclomaticComplexity: Number(fields[1]),
    length: Number(fields[4]),
    parameters: Number(fields[3]),
  };
  const exceedsThreshold =
    metrics.cyclomaticComplexity > baseline.thresholds.cyclomaticComplexity ||
    metrics.length > baseline.thresholds.length ||
    metrics.parameters > baseline.thresholds.parameters;
  if (!exceedsThreshold) continue;

  const key = `${fields[6]}:${fields[7]}`;
  const previous = currentViolations.get(key) ?? {
    cyclomaticComplexity: 0,
    length: 0,
    parameters: 0,
  };
  currentViolations.set(key, {
    cyclomaticComplexity: Math.max(
      previous.cyclomaticComplexity,
      metrics.cyclomaticComplexity,
    ),
    length: Math.max(previous.length, metrics.length),
    parameters: Math.max(previous.parameters, metrics.parameters),
  });
}

const errors = [];
for (const [key, metrics] of currentViolations) {
  const allowed = baseline.functions[key];
  if (!allowed) {
    errors.push(`New complexity violation: ${key} ${JSON.stringify(metrics)}`);
    continue;
  }
  for (const metric of Object.keys(metrics)) {
    if (metrics[metric] > allowed[metric]) {
      errors.push(
        `Complexity regression: ${key} ${metric} ${metrics[metric]} exceeds ${allowed[metric]}`,
      );
    }
  }
}
for (const key of Object.keys(baseline.functions)) {
  if (!currentViolations.has(key)) {
    errors.push(`Stale complexity baseline: ${key}`);
  }
}

if (errors.length > 0) {
  for (const error of errors.sort()) console.error(error);
  process.exitCode = 1;
} else {
  console.log(
    `complexity gate passed (${functionCount} functions; ${currentViolations.size} legacy entries; lizard ${version})`,
  );
}
