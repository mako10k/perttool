import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkDocument, parseDocument } from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

test("all normative examples parse and validate", async () => {
  const examplesDirectory = path.join(root, "docs/examples");
  const names = (await readdir(examplesDirectory)).filter((name) => name.endsWith(".pert"));
  assert.equal(names.length, 6);
  for (const name of names) {
    const text = await readFile(path.join(examplesDirectory, name), "utf8");
    const result = checkDocument(text);
    assert.equal(
      result.ok,
      true,
      `${name}: ${result.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; ")}`,
    );
  }
});

test("parallel example preserves AoA declarations and nested requirements", async () => {
  const text = await readFile(path.join(root, "docs/examples/parallel.pert"), "utf8");
  const parsed = parseDocument(text);
  assert.equal(parsed.diagnostics.length, 0);
  assert.equal(parsed.document.declarations.filter(({ kind }) => kind === "milestone").length, 8);
  assert.equal(parsed.document.declarations.filter(({ kind }) => kind === "task").length, 5);
  assert.equal(parsed.document.declarations.filter(({ kind }) => kind === "gate").length, 5);
  const core = parsed.document.declarations.find(({ id }) => id === "CORE");
  const requirements = core.fields.find(({ name }) => name === "requires");
  assert.deepEqual(
    requirements.value.map(({ resourceId, units }) => [resourceId, units]),
    [["DEVELOPERS", 1]],
  );
});

for (const [fixture, code] of [
  ["duplicate-id.pert", "PTSEM-201"],
  ["undefined-endpoint.pert", "PTSEM-204"],
  ["cycle.pert", "PTDAG-202"],
  ["estimate-order.pert", "PTSEM-104"],
]) {
  test(`${fixture} reports ${code}`, async () => {
    const text = await readFile(path.join(testDirectory, "fixtures/invalid", fixture), "utf8");
    const result = checkDocument(text);
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === code));
  });
}

test("resource requirements do not become precedence edges", () => {
  const text = `project RESOURCE_ONLY:\n  title "resource relation"\n  duration_unit day\n  finish DONE\n\nresource WORKERS:\n  title "workers"\n  capacity 2\n\nmilestone NOW:\n  title "now"\n  state reached\n\nmilestone A:\n  title "A"\n\nmilestone B:\n  title "B"\n\nmilestone DONE:\n  title "done"\n\ntask LEFT NOW -> A:\n  title "left"\n  duration 1d\n  requires:\n    WORKERS 1\n\ntask RIGHT NOW -> B:\n  title "right"\n  duration 1d\n  requires:\n    WORKERS 1\n\ngate A_DONE A -> DONE:\n  reason "left done"\n\ngate B_DONE B -> DONE:\n  reason "right done"\n`;
  const result = checkDocument(text);
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics.some(({ code }) => code === "PTDAG-202"), false);
});

test("source-backed CST records blank and comment trivia spans", () => {
  const text = `# plan comment\nproject TRIVIA:\n  title "trivia"\n  duration_unit day\n  finish DONE\n\n  # field comment\nmilestone DONE:\n  title "done"\n  state reached\n`;
  const parsed = parseDocument(text);
  assert.equal(parsed.diagnostics.length, 0);
  assert.equal(parsed.document.trivia.some(({ kind, text }) => kind === "comment" && text.includes("plan comment")), true);
  assert.equal(parsed.document.trivia.some(({ kind }) => kind === "blank"), true);
  for (const trivia of parsed.document.trivia) {
    assert.ok(trivia.span.end.offset >= trivia.span.start.offset);
  }
});

test("point duration and project velocity parse as exact structured values", async () => {
  const text = await readFile(path.join(root, "docs/examples/point-velocity.pert"), "utf8");
  const parsed = parseDocument(text);
  assert.equal(parsed.diagnostics.length, 0);
  const project = parsed.document.declarations.find(({ kind }) => kind === "project");
  const velocity = project.fields.find(({ name }) => name === "velocity").value;
  assert.deepEqual(
    [velocity.points.digits, velocity.points.scale, velocity.points.suffix],
    [20n, 0, "p"],
  );
  assert.deepEqual(
    [velocity.period.digits, velocity.period.scale, velocity.period.suffix],
    [10n, 0, "d"],
  );
});

test("point projects and time projects enforce velocity constraints", () => {
  const document = (durationUnit, velocity, duration) =>
    `project VELOCITY_RULE:\n  title "velocity"\n  duration_unit ${durationUnit}\n${velocity === null ? "" : `  velocity ${velocity}\n`}  finish DONE\n\nmilestone NOW:\n  title "now"\n  state reached\n\nmilestone DONE:\n  title "done"\n\ntask WORK NOW -> DONE:\n  title "work"\n  duration ${duration}\n`;

  for (const [text, code] of [
    [document("point", null, "1p"), "PTSEM-111"],
    [document("point", "0p/1d", "1p"), "PTSEM-111"],
    [document("day", "10p/8h", "1d"), "PTSEM-111"],
  ]) {
    const result = checkDocument(text);
    assert.equal(result.ok, false);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === code));
  }
});

test("parser recovers independent syntax errors and suppresses downstream phases", async () => {
  const text = await readFile(
    path.join(testDirectory, "fixtures/invalid/multiple-syntax-errors.pert"),
    "utf8",
  );
  const parsed = parseDocument(text);
  assert.equal(parsed.diagnosticsTruncated, false);
  assert.deepEqual(
    parsed.diagnostics.map(({ code }) => code),
    ["PTDSL-006", "PTDSL-003", "PTDSL-012", "PTDSL-005", "PTDSL-007", "PTDSL-002"],
  );
  assert.deepEqual(
    parsed.document.declarations.map(({ id }) => id),
    ["RECOVERY", "DEVELOPERS", "NOW", "DONE", "WORK"],
  );
  assert.equal(
    parsed.diagnostics.some(({ message }) => message.includes("still ignored")),
    false,
  );

  const checked = checkDocument(text);
  assert.deepEqual(checked.diagnostics, parsed.diagnostics);
  assert.equal(
    checked.diagnostics.some(({ code }) => code.startsWith("PTSEM-") || code.startsWith("PTDAG-")),
    false,
  );
});

test("parser and check callers can cap diagnostics with an explicit truncation flag", async () => {
  const text = await readFile(
    path.join(testDirectory, "fixtures/invalid/multiple-syntax-errors.pert"),
    "utf8",
  );
  const parsed = parseDocument(text, { maxDiagnostics: 3 });
  assert.equal(parsed.diagnostics.length, 3);
  assert.equal(parsed.diagnosticsTruncated, true);

  const checked = checkDocument(text, { maxDiagnostics: 2 });
  assert.equal(checked.diagnostics.length, 2);
  assert.equal(checked.diagnosticsTruncated, true);
  assert.equal(checked.summary.errors, 6);
  assert.equal(checked.ok, false);
  assert.throws(() => parseDocument(text, { maxDiagnostics: 0 }), /maxDiagnostics/);
});

test("empty block text reports one syntax cause without an empty-text semantic cascade", () => {
  const text = `project EMPTY_TEXT:\n  title "empty text"\n  description |\n  duration_unit day\n  finish DONE\n\nmilestone DONE:\n  title "done"\n  state reached\n`;
  const result = checkDocument(text);
  assert.deepEqual(result.diagnostics.map(({ code }) => code), ["PTDSL-010"]);
});

test("invalid block text indentation is one recovered error region", () => {
  const text = `project BAD_TEXT_INDENT:\n  title "bad text"\n  description |\n   bad indent\n   second line in same region\n  duration_unit day\n  finish DONE\n\nmilestone DONE:\n  title "done"\n  state reached\n`;
  const result = checkDocument(text);
  assert.deepEqual(result.diagnostics.map(({ code }) => code), ["PTDSL-010"]);
});
