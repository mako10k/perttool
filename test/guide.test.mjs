import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  checkDocument,
  getGuide,
  getHelp,
  guideResultToJson,
  renderGuideResult,
  serializeGuideResult,
} from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".ts") ? [entryPath] : [];
  }));
  return nested.flat();
}

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
  "syntax.work-event",
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
  "actuals",
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

test("Contract 8 guide preserves every HelpNode topic and adds plan assurance", () => {
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
    assert.equal(guide.cliContractVersion, 8);
    assert.equal(guide.operation, "guide");
    const help = getHelp(topicId, level);
    assert.equal(guide.ok, help.ok);
    assert.equal(guide.topicId, help.topicId);
    assert.equal(guide.level, help.level);
    assert.equal(guide.title, help.title);
  }

  const index = getGuide(null, "index");
  assert.deepEqual(
    index.topics.map(({ id }) => id),
    [
      ...topicIds.filter((topicId) => !topicId.includes(".")),
      "plan-assurance",
      "historical-dag",
      "milestone-acceptance",
    ],
  );
});

test("GuideResult text and JSON match canonical golden projections", async () => {
  const expectedJson = await readFile(
    path.join(
      testDirectory,
      "golden/help/contract8-guide-index.expected.json",
    ),
    "utf8",
  );
  const expectedText = await readFile(
    path.join(
      testDirectory,
      "golden/help/contract8-guide-syntax-quick.expected.txt",
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

test("active Contract 8 Guide states exact additive identities and authority", async () => {
  const syntax = getGuide("syntax", "detail");
  assert.match(syntax.summary, /Grammar versions 1 through 7/);
  assert.match(
    getGuide("syntax.project", "detail").sections
      .map(({ body }) => body).join("\n"),
    /version 6 adds conditional plan-assurance records; and version 7 adds milestone acceptance records/,
  );
  assert.match(
    getGuide("syntax.duration", "detail").summary,
    /Grammar 3 through 7/,
  );
  assert.match(
    getGuide("syntax.temporal", "detail").syntax.join("\n"),
    /version 2\|3\|4\|5\|6\|7/,
  );
  assert.match(
    getGuide("syntax.temporal", "detail").summary,
    /retained through Grammar 7/,
  );
  assert.match(
    getGuide("syntax.work-event", "detail").summary,
    /Grammars 6 and 7 retain it unchanged/,
  );

  const temporal = getGuide("analysis.temporal", "detail");
  const temporalBody = temporal.sections.map(({ body }) => body).join("\n");
  assert.match(temporalBody, /AnalysisResult v6/);
  assert.match(temporalBody, /NextResult v7/);

  const next = getGuide("next", "detail");
  const nextBody = next.sections.map(({ body }) => body).join("\n");
  assert.match(next.summary, /NextResult\.v7/);
  assert.match(
    nextBody,
    /recommendation_v1_plus_release_gate_plus_plan_assurance_v1/,
  );
  assert.match(nextBody, /assurance-withheld authority/);
  assert.match(nextBody, /safe-stop reasons/);

  const actualsBody = getGuide("actuals", "detail").sections
    .map(({ body }) => body).join("\n");
  assert.match(actualsBody, /Grammar 5 introduces task-owned work events/);
  assert.match(actualsBody, /Grammars 6 and 7 retain them unchanged/);
  assert.match(actualsBody, /Grammar 5 through 7/);

  const editingBody = getGuide("editing", "detail").sections
    .map(({ body }) => body).join("\n");
  assert.match(editingBody, /current Contract 8 candidate/);

  const assurance = getGuide("plan-assurance", "detail");
  assert.equal(assurance.examples.length, 3);
  for (const peer of ["syntax", "analysis", "next", "editing"]) {
    assert.ok(assurance.related.includes(peer), `plan-assurance -> ${peer}`);
    assert.ok(
      getGuide(peer, "detail").related.includes("plan-assurance"),
      `${peer} -> plan-assurance`,
    );
  }

  const source = await readFile(
    path.join(root, "src/help/assurance-guide.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /\.replaceAll\(/);
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

  const explicitTopics = new Set();
  for (const sourcePath of await sourceFiles(path.join(root, "src"))) {
    const source = await readFile(sourcePath, "utf8");
    for (const match of source.matchAll(
      /helpTopic(?::\s*|\s*=\s*)"([^"]+)"/g,
    )) {
      explicitTopics.add(match[1]);
    }
  }
  for (const topicId of explicitTopics) {
    assert.equal(getGuide(topicId, "quick").ok, true, topicId);
  }
  for (const expected of [
    "actuals",
    "editing.unit-migration",
    "plan-assurance",
  ]) {
    assert.ok(explicitTopics.has(expected), expected);
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
