import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  getGuide,
  guideResultToJson,
  renderGuideResult,
  serializeGuideResult,
} from "../dist/help/guide.js";
import { getHelp } from "../dist/help/registry.js";
import { checkDocument } from "../dist/index.js";

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
  "syntax.temporal",
  "syntax.indentation",
  "syntax.string",
  "syntax.text",
  "syntax.tags",
  "syntax.comments",
  "syntax.top-level",
  "analysis",
  "analysis.resources",
  "analysis.temporal",
  "next",
  "editing",
  "editing.unit-migration",
  "mermaid",
  "workflows",
  "errors",
  "samples",
];

function helpProjection(result) {
  return {
    ok: result.ok,
    topicId: result.topicId,
    level: result.level,
    title: result.title,
    summary: result.summary,
    sections: result.sections,
    syntax: result.syntax,
    examples: result.examples,
    related: result.related,
    topics: result.topics,
    diagnostics: result.diagnostics,
  };
}

test("Contract 4 guide preserves every HelpNode topic and content level", () => {
  const queries = [
    { topicId: null, level: "index" },
    ...topicIds.flatMap((topicId) =>
      ["index", "quick", "detail"].map((level) => ({ topicId, level }))
    ),
    { topicId: "unknown-topic", level: "detail" },
  ];

  for (const { topicId, level } of queries) {
    const guide = getGuide(topicId, level);
    assert.equal(guide.schemaVersion, "Perttool.GuideResult.v1");
    assert.equal(guide.cliContractVersion, 4);
    assert.equal(guide.operation, "guide");
    assert.deepEqual(helpProjection(guide), getHelp(topicId, level));
  }

  const index = getGuide(null, "index");
  assert.deepEqual(
    index.topics.map(({ id }) => id),
    topicIds.filter((topicId) => !topicId.includes(".")),
  );
});

test("GuideResult text and JSON match canonical golden projections", async () => {
  const expectedJson = await readFile(
    path.join(
      testDirectory,
      "golden/help/contract3-guide-index.expected.json",
    ),
    "utf8",
  );
  const expectedText = await readFile(
    path.join(
      testDirectory,
      "golden/help/contract4-guide-syntax-quick.expected.txt",
    ),
    "utf8",
  );

  assert.equal(serializeGuideResult(getGuide(null, "index")), expectedJson);
  assert.equal(
    renderGuideResult(getGuide("syntax", "quick")),
    expectedText,
  );
});

test("GuideResult is a domain projection rather than a command contract", () => {
  const json = guideResultToJson(getGuide("editing", "detail"));
  assert.deepEqual(Object.keys(json), [
    "schema_version",
    "cli_contract_version",
    "tool_version",
    "operation",
    "ok",
    "diagnostics",
    "topic_id",
    "level",
    "title",
    "summary",
    "sections",
    "syntax",
    "examples",
    "related",
    "topics",
  ]);
  for (const commandField of [
    "commands",
    "resources",
    "query",
    "operands",
    "options",
    "help_target",
  ]) {
    assert.equal(Object.hasOwn(json, commandField), false, commandField);
  }
});

test("unknown guide topics retain PTHLP-001 with a distinct guide link", () => {
  const result = getGuide("missing", "detail");
  assert.equal(result.ok, false);
  const json = guideResultToJson(result);
  assert.equal(json.diagnostics[0].code, "PTHLP-001");
  assert.equal(json.diagnostics[0].help_topic, null);
  assert.equal(json.diagnostics[0].guide_topic, "syntax");
  assert.match(
    renderGuideResult(result),
    /^PTHLP-001 error: unknown help topic: missing\n  guide: perttool guide syntax --level quick\n$/,
  );
});

test("registered diagnostic links resolve through GuideResult", async () => {
  for (const relativeDirectory of [
    "fixtures/grammar/invalid",
    "fixtures/invalid",
  ]) {
    const directory = path.join(testDirectory, relativeDirectory);
    const names = (await readdir(directory))
      .filter((name) => name.endsWith(".pert"))
      .sort();
    for (const name of names) {
      const text = await readFile(path.join(directory, name), "utf8");
      const checked = checkDocument(text);
      for (const diagnostic of checked.diagnostics) {
        assert.ok(diagnostic.helpTopic, `${name}: ${diagnostic.code}`);
        assert.equal(
          getGuide(diagnostic.helpTopic, "quick").ok,
          true,
          `${name}: ${diagnostic.code} -> ${diagnostic.helpTopic}`,
        );
      }
    }
  }

  const explicitlyLinkedSources = [
    "src/application/analyze.ts",
    "src/cli.ts",
    "src/conversion/mermaid-import.ts",
    "src/help/registry.ts",
    "src/mutation/diagnostics.ts",
  ];
  const explicitTopics = new Set();
  for (const relativePath of explicitlyLinkedSources) {
    const source = await readFile(path.join(root, relativePath), "utf8");
    for (const match of source.matchAll(
      /helpTopic(?::\s*|\s*=\s*)"([^"]+)"/g,
    )) {
      explicitTopics.add(match[1]);
    }
  }
  assert.deepEqual([...explicitTopics].sort(), [
    "analysis.resources",
    "editing",
    "errors",
    "mermaid",
    "syntax",
  ]);
  for (const topicId of explicitTopics) {
    assert.equal(getGuide(topicId, "quick").ok, true, topicId);
  }
});

test("guide projection is byte deterministic and independent of command discovery", async () => {
  const queries = [
    { topicId: null, level: "index" },
    { topicId: "next", level: "detail" },
    { topicId: "missing", level: "quick" },
  ];
  for (const { topicId, level } of queries) {
    const first = getGuide(topicId, level);
    const second = getGuide(topicId, level);
    assert.equal(serializeGuideResult(first), serializeGuideResult(second));
    assert.equal(renderGuideResult(first), renderGuideResult(second));
  }

  const discoverySource = await readFile(
    path.join(root, "src", "command", "discovery.ts"),
    "utf8",
  );
  assert.doesNotMatch(discoverySource, /help\/(?:guide|registry)/);
});

test("guide projection runs outside a project without I/O or environment discovery", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "perttool-guide-"),
  );
  try {
    const moduleUrl = pathToFileURL(
      path.join(root, "dist", "help", "guide.js"),
    ).href;
    const script = [
      `import { getGuide, serializeGuideResult } from ${JSON.stringify(moduleUrl)};`,
      'process.stdout.write(serializeGuideResult(getGuide("next", "detail")));',
    ].join("\n");
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", script],
      {
        cwd: temporaryDirectory,
        encoding: "utf8",
        env: {},
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).operation, "guide");
    assert.deepEqual(await readdir(temporaryDirectory), []);

    const source = await readFile(
      path.join(root, "src", "help", "guide.ts"),
      "utf8",
    );
    const imports = [...source.matchAll(/from "([^"]+)"/g)]
      .map((match) => match[1]);
    assert.deepEqual(
      [...new Set(imports)].sort(),
      ["../model/diagnostics.js", "../version.js", "./registry.js"],
    );
    assert.doesNotMatch(source, /\b(?:fetch|process\.env|node:)/);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});
