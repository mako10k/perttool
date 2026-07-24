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

test("bundled DSL help contains no Japanese-script prose", () => {
  const japaneseScript = /[\u3040-\u30ff\u4e00-\u9fff]/u;
  const results = [
    getHelp(null, "index"),
    ...topicIds.map((topicId) => getHelp(topicId, "detail")),
    getHelp("unknown-topic", "detail"),
  ];
  for (const result of results) {
    assert.doesNotMatch(JSON.stringify(result), japaneseScript);
  }
});

test("editing help exposes preview and explicit safe-write commands", () => {
  const help = getHelp("editing", "detail");
  assert.equal(help.ok, true);
  assert.match(help.summary, /document formatting/);
  assert.match(help.summary, /project\/task\/gate\/milestone\/resource mutations/);
  assert.match(help.summary, /atomic batch/);
  assert.match(help.summary, /DAG advancement/);
  assert.match(help.sections.map(({ body }) => body).join("\n"), /planFormat/);
  assert.match(help.sections.map(({ body }) => body).join("\n"), /planMutation/);
  assert.match(help.sections.map(({ body }) => body).join("\n"), /planAdvance/);
  assert.match(
    help.sections.map(({ body }) => body).join("\n"),
    /Direct gate add\/set\/remove commands.*connected atomic batches/,
  );
  assert.ok(help.syntax.some((line) => line.includes("project init")));
  assert.ok(help.syntax.some((line) => line.includes("project show")));
  assert.ok(help.syntax.some((line) => line.includes("project set")));
  assert.ok(help.syntax.some((line) => line.includes("document format")));
  assert.ok(help.syntax.some((line) => line.includes("gate add|set|remove")));
  assert.ok(help.syntax.some((line) => line.includes("batch apply")));
  assert.ok(help.syntax.some((line) => line.includes("dag advance")));
  assert.match(help.sections.map(({ body }) => body).join("\n"), /default.*preview/);
  assert.match(help.sections.map(({ body }) => body).join("\n"), /--expect-digest/);
  assert.match(help.sections.map(({ body }) => body).join("\n"), /--out/);
  assert.ok(
    help.syntax
      .filter(
        (line) =>
          !line.includes("project show") && !line.includes("project init"),
      )
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
  assert.match(body, /normalized semantic equivalence/);
  assert.match(body, /not silently downgraded to plain import/);
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
  assert.match(body, /recommended, allowed, deferred, or discouraged/);
  assert.match(body, /schema_version/);
  assert.match(body, /complete=false/);
  assert.match(body, /decisive semantics are unknown/);
  assert.ok(
    help.sections.some(
      ({ title }) => title === "AI task selection authority",
    ),
  );
  assert.match(body, /normal start authority/);
  assert.match(body, /macro recommended work package.*detail plan/);
  assert.match(body, /recommended subset/);
  assert.match(body, /exactly one allowed task/);
  assert.match(body, /unknown version.*PTREC.*stop instead/);
  assert.match(body, /task-state or capacity changes/);
  assert.match(body, /validateOverride/);
  assert.match(body, /Perttool\.OverrideDecision\.v1/);
  assert.match(body, /secrets, credentials, or tokens/);
  assert.match(body, /override apply and audit write is not implemented/);
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
