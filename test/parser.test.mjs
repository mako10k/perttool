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

test("all declaration fields parse from the grammar acceptance fixture", async () => {
  const text = await readFile(path.join(testDirectory, "fixtures/grammar/all-fields.pert"), "utf8");
  const checked = checkDocument(text);
  assert.equal(
    checked.ok,
    true,
    checked.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
  );
  assert.deepEqual(checked.summary, {
    resources: 1,
    milestones: 3,
    tasks: 2,
    gates: 1,
    errors: 0,
    warnings: 0,
  });

  const parsed = parseDocument(text);
  const expectedFields = {
    project: [
      "as_of",
      "critical_epsilon",
      "description",
      "duration_unit",
      "finish",
      "target_duration",
      "title",
      "velocity",
      "version",
    ],
    resource: ["capacity", "description", "tags", "title"],
    milestone: ["description", "state", "tags", "title"],
    task: [
      "blocked_reason",
      "description",
      "duration",
      "estimate",
      "owner",
      "priority",
      "requires",
      "source",
      "status",
      "tags",
      "title",
    ],
    gate: ["reason"],
  };
  for (const [kind, expected] of Object.entries(expectedFields)) {
    const actual = [
      ...new Set(
        parsed.document.declarations
          .filter((declaration) => declaration.kind === kind)
          .flatMap((declaration) => declaration.fields.map(({ name }) => name)),
      ),
    ].sort();
    assert.deepEqual(actual, expected, kind);
  }

  const project = parsed.document.declarations.find(({ kind }) => kind === "project");
  const velocity = project.fields.find(({ name }) => name === "velocity").value;
  assert.deepEqual([velocity.points.text, velocity.period.text], ["10p", "5d"]);
  const review = parsed.document.declarations.find(({ id }) => id === "REVIEW");
  const estimate = review.fields.find(({ name }) => name === "estimate");
  assert.deepEqual(
    estimate.children.map(({ name, value }) => [name, value.text]),
    [
      ["optimistic", "1p"],
      ["most_likely", "2p"],
      ["pessimistic", "3p"],
    ],
  );
  const requirements = review.fields.find(({ name }) => name === "requires").value;
  assert.deepEqual(
    requirements.map(({ resourceId, units }) => [resourceId, units]),
    [["REVIEWERS", 1]],
  );
});

for (const [fixture, code] of [
  ["declaration-header.pert", "PTDSL-004"],
  ["unknown-field.pert", "PTDSL-005"],
  ["string-token.pert", "PTDSL-006"],
  ["duration-token.pert", "PTDSL-007"],
  ["velocity-token.pert", "PTDSL-007"],
  ["date-token.pert", "PTDSL-008"],
  ["list-token.pert", "PTDSL-009"],
  ["inline-comment.pert", "PTDSL-011"],
  ["inline-comment-header.pert", "PTDSL-011"],
  ["inline-comment-estimate.pert", "PTDSL-011"],
  ["inline-comment-requires.pert", "PTDSL-011"],
  ["enum-token.pert", "PTDSL-012"],
  ["integer-token.pert", "PTDSL-012"],
  ["missing-field.pert", "PTSEM-101"],
  ["duplicate-field.pert", "PTSEM-102"],
  ["field-combination.pert", "PTSEM-103"],
]) {
  test(`grammar fixture ${fixture} reports only ${code}`, async () => {
    const text = await readFile(
      path.join(testDirectory, "fixtures/grammar/invalid", fixture),
      "utf8",
    );
    const result = checkDocument(text);
    assert.equal(result.ok, false);
    assert.deepEqual(result.diagnostics.map(({ code: actual }) => actual), [code]);
  });
}

test("inline comment diagnostic selects the unsupported suffix", async () => {
  const text = await readFile(
    path.join(testDirectory, "fixtures/grammar/invalid/inline-comment.pert"),
    "utf8",
  );
  const result = checkDocument(text);
  const [diagnostic] = result.diagnostics;
  assert.equal(diagnostic.helpTopic, "syntax.comments");
  assert.equal(text.slice(diagnostic.span.start.offset, diagnostic.span.end.offset), "# unsupported");
});

test("duplicate field diagnostic points from the later field to the first", async () => {
  const text = await readFile(
    path.join(testDirectory, "fixtures/grammar/invalid/duplicate-field.pert"),
    "utf8",
  );
  const result = checkDocument(text);
  const [diagnostic] = result.diagnostics;
  assert.equal(diagnostic.span.start.line, 2);
  assert.equal(diagnostic.related.length, 1);
  assert.equal(diagnostic.related[0].span.start.line, 1);
});

test("hash characters in strings, lists, and block text are content", () => {
  const text = `project HASH_CONTENT:\n  title "# is string content"\n  description |\n    # is block text content\n  duration_unit day\n  finish DONE\n\nmilestone NOW:\n  title "now"\n  state reached\n  tags ["#tag"]\n\nmilestone DONE:\n  title "done"\n\ntask WORK NOW -> DONE:\n  title "work"\n  duration 1d\n`;
  const result = checkDocument(text);
  assert.equal(
    result.ok,
    true,
    result.diagnostics.map(({ code, message }) => `${code} ${message}`).join("; "),
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
