import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { checkDocument, getHelp } from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

const topicIds = [
  "syntax",
  "syntax.project",
  "syntax.resource",
  "syntax.milestone",
  "syntax.task",
  "syntax.gate",
  "syntax.estimate",
  "syntax.duration",
  "syntax.velocity",
  "syntax.indentation",
  "syntax.string",
  "syntax.text",
  "syntax.tags",
  "syntax.comments",
  "syntax.top-level",
  "analysis",
  "analysis.resources",
  "next",
  "editing",
  "mermaid",
  "workflows",
  "errors",
  "samples",
];

test("help registry topics and related links resolve", () => {
  for (const topicId of topicIds) {
    const help = getHelp(topicId, "detail");
    assert.equal(help.ok, true, topicId);
    for (const relatedId of help.related) {
      assert.equal(getHelp(relatedId, "quick").ok, true, `${topicId} -> ${relatedId}`);
    }
  }
});

test("editing help exposes preview and explicit safe-write commands", () => {
  const help = getHelp("editing", "detail");
  assert.equal(help.ok, true);
  assert.match(help.summary, /dsl format/);
  assert.match(help.summary, /task\/milestone\/resource mutation/);
  assert.match(help.summary, /atomic batch/);
  assert.match(help.summary, /dag advance/);
  assert.match(help.sections.map(({ body }) => body).join("\n"), /planFormat/);
  assert.match(help.sections.map(({ body }) => body).join("\n"), /planMutation/);
  assert.match(help.sections.map(({ body }) => body).join("\n"), /planAdvance/);
  assert.ok(help.syntax.some((line) => line.includes("project show")));
  assert.ok(help.syntax.some((line) => line.includes("project set")));
  assert.ok(help.syntax.some((line) => line.includes("dsl format")));
  assert.ok(help.syntax.some((line) => line.includes("mutation apply")));
  assert.ok(help.syntax.some((line) => line.includes("dag advance")));
  assert.match(help.sections.map(({ body }) => body).join("\n"), /既定.*preview/);
  assert.match(help.sections.map(({ body }) => body).join("\n"), /--expect-digest/);
  assert.match(help.sections.map(({ body }) => body).join("\n"), /--out/);
  assert.ok(
    help.syntax
      .filter((line) => !line.includes("project show"))
      .every((line) => line.includes("--write")),
  );
});

test("mermaid help exposes lossless export and fail-closed import", () => {
  const help = getHelp("mermaid", "detail");
  assert.equal(help.ok, true);
  assert.match(help.summary, /dag render/);
  assert.match(help.summary, /dag import/);
  assert.ok(help.syntax.some((line) => line.includes("dag render")));
  assert.ok(help.syntax.some((line) => line.includes("dag import")));
  assert.ok(help.syntax.some((line) => line.includes("--strict-loss")));
  const body = help.sections.map(({ body }) => body).join("\n");
  assert.match(body, /%% perttool:/);
  assert.match(body, /正規化意味同値/);
  assert.match(body, /plain importへ黙って降格しません/);
  assert.match(body, /importMermaid/);
  assert.match(body, /PTCNV/);
  assert.deepEqual(help.examples, [
    {
      id: "mermaid-profile",
      title: "Normative profile",
      text: "docs/examples/mermaid-profile.md",
    },
  ]);
});

test("next help exposes the v3 recommendation authority and consumer safety", () => {
  const help = getHelp("next", "detail");
  assert.equal(help.ok, true);
  assert.match(help.summary, /NextResult\.v3/);
  const body = help.sections.map(({ body }) => body).join("\n");
  assert.match(body, /recommended、allowed、deferred、discouraged/);
  assert.match(body, /schema_version/);
  assert.match(body, /complete=false/);
  assert.match(body, /未知.*自動開始しません/);
  assert.ok(
    help.sections.some(
      ({ title }) => title === "AI task selection authority",
    ),
  );
  assert.match(body, /normal start authority/);
  assert.match(body, /Macro.*detail/);
  assert.match(body, /recommended subset/);
  assert.match(body, /allowedを1件/);
  assert.match(body, /Unknown version.*PTREC.*停止/);
  assert.match(body, /Task state.*capacity変更後.*再解析/);
  assert.match(body, /validateOverride/);
  assert.match(body, /Perttool\.OverrideDecision\.v1/);
  assert.match(body, /secret、credential、token/);
  assert.match(body, /Override apply.*未実装/);
  assert.ok(help.examples.some(({ text }) => text.endsWith("--format json")));
});

test("syntax help sample references stay synchronized with parser fixtures", async () => {
  const references = topicIds
    .filter((topicId) => topicId === "samples" || topicId.startsWith("syntax"))
    .flatMap((topicId) =>
      getHelp(topicId, "detail").examples
        .filter(({ text }) => /^docs\/examples\/[A-Za-z0-9-]+\.pert$/.test(text))
        .map(({ id, text }) => ({ topicId, id, text })),
    );
  assert.deepEqual(references, [
    { topicId: "syntax", id: "minimal", text: "docs/examples/minimal.pert" },
    { topicId: "syntax.project", id: "minimal", text: "docs/examples/minimal.pert" },
    { topicId: "syntax.resource", id: "parallel", text: "docs/examples/parallel.pert" },
    { topicId: "syntax.milestone", id: "minimal", text: "docs/examples/minimal.pert" },
    { topicId: "syntax.task", id: "minimal", text: "docs/examples/minimal.pert" },
    {
      topicId: "syntax.gate",
      id: "point-velocity",
      text: "docs/examples/point-velocity.pert",
    },
    {
      topicId: "syntax.estimate",
      id: "pert-estimate",
      text: "docs/examples/pert-estimate.pert",
    },
    {
      topicId: "syntax.velocity",
      id: "point-velocity",
      text: "docs/examples/point-velocity.pert",
    },
    { topicId: "syntax.top-level", id: "minimal", text: "docs/examples/minimal.pert" },
    { topicId: "samples", id: "minimal", text: "docs/examples/minimal.pert" },
    {
      topicId: "samples",
      id: "point-velocity",
      text: "docs/examples/point-velocity.pert",
    },
    { topicId: "samples", id: "parallel", text: "docs/examples/parallel.pert" },
  ]);

  for (const reference of references) {
    assert.equal(path.isAbsolute(reference.text), false, reference.text);
    assert.equal(path.basename(reference.text, ".pert"), reference.id, reference.text);
    const text = await readFile(path.join(root, reference.text), "utf8");
    const checked = checkDocument(text);
    assert.equal(
      checked.ok,
      true,
      `${reference.topicId}: ${checked.diagnostics
        .map(({ code, message }) => `${code} ${message}`)
        .join("; ")}`,
    );
  }
});

test("parser fixture diagnostics link to registered help topics", async () => {
  for (const relativeDirectory of ["fixtures/grammar/invalid", "fixtures/invalid"]) {
    const directory = path.join(testDirectory, relativeDirectory);
    const names = (await readdir(directory)).filter((name) => name.endsWith(".pert")).sort();
    for (const name of names) {
      const text = await readFile(path.join(directory, name), "utf8");
      const checked = checkDocument(text);
      assert.ok(checked.diagnostics.length > 0, `${relativeDirectory}/${name}`);
      for (const diagnostic of checked.diagnostics) {
        assert.ok(diagnostic.helpTopic, `${name}: ${diagnostic.code}`);
        assert.equal(
          getHelp(diagnostic.helpTopic, "quick").ok,
          true,
          `${name}: ${diagnostic.code} -> ${diagnostic.helpTopic}`,
        );
      }
    }
  }
});
