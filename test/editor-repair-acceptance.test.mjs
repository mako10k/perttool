import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as core from "../dist/core/index.js";
import {
  planEditorRepair,
} from "../dist/application/editor-repair.js";
import {
  EDITOR_REPAIR_FIX_ALL_KIND,
  EDITOR_REPAIR_ID,
  EDITOR_REPAIR_REGISTRY,
} from "../dist/editor/repair.js";
import { sha256DigestUtf8 } from "../dist/model/sha256.js";
import { applyTextEdits } from "../dist/mutation/text-edits.js";
import {
  PerttoolProtocolError,
  createPerttoolLanguageServer,
} from "../adapters/lsp/dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");
const uri = "untitled:editor-repair";

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function digestText(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function eligibleSource({ version = 6, unit = "day", velocity = true } = {}) {
  const suffix = unit === "day" ? "d" : "h";
  return [
    "project E1_REPAIR:",
    `  version ${version}`,
    '  title "Eligible editor repair"',
    "  as_of 2026-08-14",
    `  duration_unit ${unit}`,
    ...(velocity ? [`  velocity 4p/2${suffix}`] : []),
    `  critical_epsilon 0.5${suffix}`,
    `  target_duration 6${suffix}`,
    "  finish DONE",
    "  plan_assurance_model 1",
    "  plan_assurance_hash_model 1",
    "",
    "milestone START:",
    '  title "Start"',
    "  state reached",
    "",
    "milestone MID:",
    '  title "Middle"',
    "  deadline 2026-08-15",
    "",
    "milestone DONE:",
    '  title "Done"',
    "  deadline 2026-08-16",
    "",
    "task FIRST START -> MID:",
    '  title "First"',
    `  duration 1${suffix}`,
    "  deadline 2026-08-15",
    "",
    "task SECOND MID -> DONE:",
    '  title "Second"',
    "  estimate:",
    `    optimistic 1${suffix}`,
    `    most_likely 2${suffix}`,
    `    pessimistic 3${suffix}`,
    "  deadline 2026-08-16",
    "",
  ].join("\n");
}

function request(text, values = {}) {
  return {
    binding: {
      documentUri: values.documentUri ?? uri,
      documentGeneration: values.documentGeneration ?? "g1",
      documentVersion: values.documentVersion ?? 1,
      sourceDigest: values.sourceDigest ?? sha256DigestUtf8(text),
    },
    interaction: values.interaction ?? "quickfix",
    automatic: values.automatic ?? false,
    matchingDiagnosticCount: values.matchingDiagnosticCount ?? 1,
    requestedRangeIntersectsDiagnostic:
      values.requestedRangeIntersectsDiagnostic ?? true,
  };
}

function initializeParams(versions = [2, 1]) {
  return {
    processId: null,
    rootUri: null,
    capabilities: { general: { positionEncodings: ["utf-16"] } },
    initializationOptions: {
      perttool: {
        editorProtocolModelVersions: versions,
        graphViewResultSchemaVersions: ["Perttool.GraphViewResult.v1"],
        editorHelpResultSchemaVersions: ["Perttool.EditorHelpResult.v1"],
      },
    },
  };
}

function createServer({ versions = [2, 1], application = { plan: planEditorRepair } } = {}) {
  const published = [];
  const server = createPerttoolLanguageServer({
    digestText,
    publishDiagnostics: (params) => published.push(params),
    editorRepairApplication: application,
  });
  const initialized = server.initialize(initializeParams(versions));
  return { server, initialized, published };
}

function open(server, text, version = 1) {
  server.didOpen({
    textDocument: { uri, languageId: "pert", version, text },
  });
}

function currentUnitDiagnostic(published) {
  const value = published.at(-1)?.diagnostics.find(
    ({ code }) => code === "PTSEM-114",
  );
  assert.notEqual(value, undefined);
  return value;
}

function actionParams(diagnostic, values = {}) {
  return {
    textDocument: { uri },
    range: values.range ?? diagnostic.range,
    context: {
      diagnostics: values.diagnostics ?? [diagnostic],
      ...(values.only === undefined ? {} : { only: values.only }),
      ...(values.triggerKind === undefined
        ? { triggerKind: 1 }
        : { triggerKind: values.triggerKind }),
    },
  };
}

function repairActions(actions) {
  return actions.filter(({ edit }) => edit !== undefined);
}

function applyWorkspaceEdit(text, action) {
  const change = action.edit.documentChanges[0];
  const edits = change.edits.map((edit) => ({
    startOffset: core.documentPositionToOffset(text, edit.range.start),
    endOffset: core.documentPositionToOffset(text, edit.range.end),
    replacement: edit.newText,
  }));
  assert.equal(edits.every(({ startOffset, endOffset }) =>
    startOffset !== null && endOffset !== null), true);
  return applyTextEdits(text, edits);
}

test("twenty-four E1 implementation cases are complete and ordered", async () => {
  const fixture = JSON.parse(await repositoryText(
    "test/fixtures/editor-repair-acceptance-v1.json",
  ));
  assert.equal(
    fixture.schema_version,
    "Perttool.EditorRepairAcceptanceCases.v1",
  );
  assert.deepEqual(EDITOR_REPAIR_REGISTRY, {
    id: fixture.registry_id,
    version: fixture.registry_version,
  });
  assert.equal(EDITOR_REPAIR_ID, fixture.repair_id);
  assert.equal(EDITOR_REPAIR_FIX_ALL_KIND, fixture.source_fix_all_kind);
  const accepted = new Set();
  for (const item of fixture.cases) {
    assert.equal(item.depends_on.every((id) => accepted.has(id)), true, item.id);
    accepted.add(item.id);
  }
  assert.deepEqual(
    [...accepted],
    Array.from(
      { length: 24 },
      (_, index) => `ERA-${String(index + 1).padStart(3, "0")}`,
    ),
  );
});

test("Grammar 6 day and Grammar 7 hour candidates prove E1 and exact recovery", () => {
  for (const [version, unit] of [[6, "day"], [7, "hour"]]) {
    const source = eligibleSource({ version, unit });
    const result = planEditorRepair(source, request(source));
    assert.equal(result.status, "applicable");
    assert.equal(result.complete, true);
    assert.equal(result.strictClass, "E1");
    assert.equal(result.binding.sourceDigest, sha256DigestUtf8(source));
    const candidate = applyTextEdits(source, result.forwardEdits);
    assert.equal(sha256DigestUtf8(candidate), result.candidateSourceDigest);
    assert.equal(applyTextEdits(candidate, result.inverseEdits), source);
    assert.match(candidate, /  duration_unit point\n/u);
    assert.match(candidate, /  velocity 4p\/2[dh]\n/u);
    assert.doesNotMatch(candidate, /PTSEM-114/u);
    assert.equal(result.affectedTasks.length, 2);
    assert.deepEqual(
      result.affectedTasks.map(({ taskId, sourceStatus, candidateStatus }) =>
        [taskId, sourceStatus, candidateStatus]),
      [["FIRST", "unsealed", "unsealed"], ["SECOND", "unsealed", "unsealed"]],
    );
    assert.equal(result.planningRelations.length, 1);
    assert.deepEqual(result.governanceScopes, []);
    assert.deepEqual(result.destructiveRecordRanges, []);
  }
});

test("inventory, velocity, protected evidence, work events, and binding fail closed", async () => {
  const source = eligibleSource();
  const eligible = planEditorRepair(source, request(source));
  assert.deepEqual(
    eligible.convertedFields.map(({ fieldPath }) => fieldPath),
    [
      "project.critical_epsilon",
      "project.target_duration",
      "task.FIRST.duration",
      "task.SECOND.estimate.optimistic",
      "task.SECOND.estimate.most_likely",
      "task.SECOND.estimate.pessimistic",
    ],
  );

  const missingVelocity = eligibleSource({ velocity: false });
  assert.equal(
    planEditorRepair(missingVelocity, request(missingVelocity)).status,
    "unavailable",
  );
  const stale = planEditorRepair(source, request(source, {
    sourceDigest: `sha256:${"0".repeat(64)}`,
  }));
  assert.equal(stale.status, "unavailable");
  assert.equal(stale.unavailableCauses.some(
    ({ diagnosticCode }) => diagnosticCode === "PTEDM-104"), true);

  const protectedSource = `${source}\nplan_seal FIRST:\n` +
    `  accepted_contract sha256:${"1".repeat(64)}\n` +
    `  accepted_basis sha256:${"2".repeat(64)}\n` +
    '  reason "Existing accepted basis"\n';
  const protectedResult = planEditorRepair(
    protectedSource,
    request(protectedSource),
  );
  assert.equal(protectedResult.status, "unavailable");
  assert.equal(protectedResult.unavailableCauses.some(({ reason }) =>
    /protected evidence/u.test(reason)), true);

  const acceptedPlan = await repositoryText("plans/editor-mutations.pert");
  const acceptedResult = planEditorRepair(acceptedPlan, request(acceptedPlan));
  assert.equal(acceptedResult.status, "unavailable");
  assert.equal(acceptedResult.unavailableCauses.some(({ reason }) =>
    /protected evidence/u.test(reason)), true);

  const withEvent = eligibleSource().replace(
    'task FIRST START -> MID:\n  title "First"\n  duration 1d\n' +
      "  deadline 2026-08-15\n\n",
    'task FIRST START -> MID:\n  title "First"\n  duration 1d\n' +
      "  deadline 2026-08-15\n  status active\n\n",
  ) + [
    "work_event WE-1:",
    "  model 1",
    "  task FIRST",
    "  kind start",
    "  occurred_at 2026-08-14T09:00:00+09:00",
    "  planned_value 1d",
    "",
  ].join("\n");
  const eventResult = planEditorRepair(withEvent, request(withEvent));
  assert.equal(eventResult.status, "unavailable");
  assert.equal(eventResult.unavailableCauses.some(({ reason }) =>
    /work-event/u.test(reason)), true);
});

test("model 2 exposes one versioned Quick Fix and one atomic Fix All", async () => {
  const source = eligibleSource();
  const { server, initialized, published } = createServer();
  assert.deepEqual(
    initialized.capabilities.codeActionProvider.codeActionKinds,
    ["quickfix", "source.fixAll.perttool"],
  );
  open(server, source);
  const diagnostic = currentUnitDiagnostic(published);

  const quick = repairActions(await server.codeAction(
    actionParams(diagnostic, { only: ["quickfix"] }),
  ));
  assert.equal(quick.length, 1);
  assert.equal(quick[0].title, "Migrate duration unit to point");
  assert.equal(quick[0].kind, "quickfix");
  assert.equal(quick[0].isPreferred, true);
  assert.equal(quick[0].command, undefined);
  assert.deepEqual(quick[0].edit.documentChanges[0].textDocument, {
    uri,
    version: 1,
  });
  const candidate = applyWorkspaceEdit(source, quick[0]);
  assert.match(candidate, /duration_unit point/u);
  assert.equal(
    quick[0].data.candidateDigest,
    sha256DigestUtf8(candidate),
  );

  const fixAll = repairActions(await server.codeAction(
    actionParams(diagnostic, {
      only: ["source.fixAll.perttool"],
      diagnostics: [diagnostic, diagnostic],
    }),
  ));
  assert.equal(fixAll.length, 1);
  assert.equal(fixAll[0].kind, "source.fixAll.perttool");
  assert.equal(applyWorkspaceEdit(source, fixAll[0]), candidate);
});

test("automatic, mixed, malformed, model-1, cancellation, and staleness are fail-closed", async () => {
  const source = eligibleSource();
  const active = createServer();
  open(active.server, source);
  const diagnostic = currentUnitDiagnostic(active.published);
  assert.equal(repairActions(await active.server.codeAction(actionParams(
    diagnostic,
    { only: ["source.fixAll.perttool"], triggerKind: 2 },
  ))).length, 1);
  for (const values of [
    { only: ["quickfix"], triggerKind: 2 },
    { triggerKind: 2 },
    { only: ["quickfix", "source.fixAll.perttool"], triggerKind: 1 },
    {
      only: ["quickfix"],
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
    },
  ]) {
    assert.equal(repairActions(await active.server.codeAction(
      actionParams(diagnostic, values),
    )).length, 0);
  }

  const malformed = createServer({
    application: {
      plan: () => ({
        registry: EDITOR_REPAIR_REGISTRY,
        repairId: EDITOR_REPAIR_ID,
        interaction: "quickfix",
        automatic: false,
        status: "applicable",
        complete: true,
        strictClass: "E1",
        candidateSourceDigest: sha256DigestUtf8(source),
        forwardEdits: [{ startOffset: -1, endOffset: 1, replacement: "x" }],
      }),
    },
  });
  open(malformed.server, source);
  assert.equal(repairActions(await malformed.server.codeAction(
    actionParams(currentUnitDiagnostic(malformed.published), {
      only: ["quickfix"],
    }),
  )).length, 0);

  for (const corrupt of [
    (result) => ({
      ...result,
      candidateSourceDigest: `sha256:${"0".repeat(64)}`,
    }),
    (result) => ({
      ...result,
      interaction: "source.fixAll.perttool",
    }),
    (result) => ({
      ...result,
      binding: { ...result.binding, documentVersion: 2 },
    }),
  ]) {
    const corrupted = createServer({
      application: {
        plan: (text, input) => corrupt(planEditorRepair(text, input)),
      },
    });
    open(corrupted.server, source);
    assert.equal(repairActions(await corrupted.server.codeAction(
      actionParams(currentUnitDiagnostic(corrupted.published), {
        only: ["quickfix"],
      }),
    )).length, 0);
  }

  const model1 = createServer({ versions: [1] });
  open(model1.server, source);
  const model1Actions = await model1.server.codeAction(actionParams(
    currentUnitDiagnostic(model1.published),
    { only: ["quickfix"] },
  ));
  assert.equal(repairActions(model1Actions).length, 0);
  assert.equal(model1Actions.some(({ command }) =>
    command?.command === "perttool.openHelp"), true);
  assert.deepEqual(
    model1.initialized.capabilities.codeActionProvider.codeActionKinds,
    ["quickfix"],
  );

  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(
    active.server.codeAction(
      actionParams(diagnostic, { only: ["quickfix"] }),
      cancelled.signal,
    ),
    (error) => error instanceof PerttoolProtocolError && error.code === -32800,
  );

  let staleServer;
  const staleApplication = {
    plan: (text, input) => {
      staleServer.didChange({
        textDocument: { uri, version: 2 },
        contentChanges: [{
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
          text: "# concurrent\n",
        }],
      });
      return planEditorRepair(text, input);
    },
  };
  const stale = createServer({ application: staleApplication });
  staleServer = stale.server;
  open(stale.server, source);
  await assert.rejects(
    stale.server.codeAction(actionParams(
      currentUnitDiagnostic(stale.published),
      { only: ["quickfix"] },
    )),
    (error) => error instanceof PerttoolProtocolError && error.code === -32801,
  );
});

function jsonRpcHarness(input, output) {
  let buffer = Buffer.alloc(0);
  const messages = [];
  const waiters = [];
  function dispatch(message) {
    messages.push(message);
    for (const waiter of [...waiters]) {
      if (!waiter.predicate(message)) continue;
      waiters.splice(waiters.indexOf(waiter), 1);
      waiter.resolve(message);
    }
  }
  output.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const header = buffer.subarray(0, headerEnd).toString("ascii");
      const match = /Content-Length: (\d+)/iu.exec(header);
      assert.notEqual(match, null);
      const length = Number(match[1]);
      const bodyStart = headerEnd + 4;
      if (buffer.length < bodyStart + length) return;
      dispatch(JSON.parse(buffer.subarray(
        bodyStart,
        bodyStart + length,
      ).toString("utf8")));
      buffer = buffer.subarray(bodyStart + length);
    }
  });
  return {
    send(message) {
      const body = Buffer.from(JSON.stringify(message), "utf8");
      input.write(`Content-Length: ${body.length}\r\n\r\n`);
      input.write(body);
    },
    waitFor(predicate) {
      const existing = messages.find(predicate);
      if (existing !== undefined) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const waiter = { predicate, resolve };
        waiters.push(waiter);
        setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) waiters.splice(index, 1);
          reject(new Error("JSON-RPC response timed out"));
        }, 5000).unref();
      });
    },
  };
}

test("bundled stdio activates repair without a CLI subprocess", async () => {
  const source = eligibleSource({ version: 7, unit: "hour" });
  const child = spawn(
    process.execPath,
    [path.join(root, "adapters/lsp/dist/main.js")],
    { cwd: root, stdio: ["pipe", "pipe", "pipe"] },
  );
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const harness = jsonRpcHarness(child.stdin, child.stdout);
  harness.send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: initializeParams(),
  });
  const initialized = await harness.waitFor(({ id }) => id === 1);
  assert.deepEqual(
    initialized.result.capabilities.codeActionProvider.codeActionKinds,
    ["quickfix", "source.fixAll.perttool"],
  );
  harness.send({ jsonrpc: "2.0", method: "initialized", params: {} });
  harness.send({
    jsonrpc: "2.0",
    method: "textDocument/didOpen",
    params: { textDocument: { uri, languageId: "pert", version: 1, text: source } },
  });
  const diagnostics = await harness.waitFor(({ method, params }) =>
    method === "textDocument/publishDiagnostics" &&
      params?.uri === uri &&
      params.diagnostics.some(({ code }) => code === "PTSEM-114"));
  const diagnostic = diagnostics.params.diagnostics.find(
    ({ code }) => code === "PTSEM-114",
  );
  harness.send({
    jsonrpc: "2.0",
    id: 2,
    method: "textDocument/codeAction",
    params: actionParams(diagnostic, { only: ["quickfix"] }),
  });
  const response = await harness.waitFor(({ id }) => id === 2);
  const repair = response.result.find(({ edit }) => edit !== undefined);
  assert.equal(repair.kind, "quickfix");
  assert.match(applyWorkspaceEdit(source, repair), /duration_unit point/u);
  harness.send({ jsonrpc: "2.0", id: 3, method: "shutdown", params: null });
  await harness.waitFor(({ id }) => id === 3);
  harness.send({ jsonrpc: "2.0", method: "exit", params: null });
  await new Promise((resolve) => child.once("exit", resolve));
  assert.equal(stderr, "");
});

test("E0 formatting and current public identities remain unchanged", async () => {
  const source = eligibleSource().replace("duration 1d", "duration 1.0d");
  const { server } = createServer();
  open(server, source);
  const formatted = await server.documentFormatting({
    textDocument: { uri },
    options: { tabSize: 2, insertSpaces: true },
  });
  assert.equal(formatted.length > 0, true);

  const [packageJson, schemaRegistry, hostProbe, hostGate, rootIndex, coreIndex] =
    await Promise.all([
      repositoryText("package.json"),
      repositoryText("src/schema/registry.ts"),
      repositoryText("scripts/vsix-host-tests.cjs"),
      repositoryText("scripts/check-vsix-host.mjs"),
      import("../dist/index.js"),
      import("../dist/core/index.js"),
    ]);
  assert.equal(JSON.parse(packageJson).version, "0.9.4");
  assert.equal(rootIndex.COMMAND_REGISTRY.length, 53);
  assert.equal(rootIndex.getJsonSchemaCatalog().length, 23);
  assert.equal(Object.keys(rootIndex).length, 129);
  assert.equal(Object.keys(coreIndex).length, 45);
  assert.match(schemaRegistry, /Perttool\.NextResult\.v7/u);
  assert.match(hostProbe, /vscode\.executeCodeActionProvider/u);
  assert.match(hostProbe, /vscode\.workspace\.applyEdit/u);
  assert.match(hostProbe, /executeCommand\("undo"\)/u);
  assert.match(hostGate, /repair\.pert/u);
  assert.match(hostGate, /digest\(fixture\.repairBefore\)/u);
  assert.equal("planEditorRepair" in rootIndex, false);
  assert.equal("planEditorRepair" in coreIndex, false);
});
