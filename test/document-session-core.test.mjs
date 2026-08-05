import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as core from "../dist/core/index.js";
import * as nodeApi from "../dist/node/index.js";
import * as packageRoot from "../dist/index.js";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..");

function repositoryText(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function digestText(text) {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

function position(text, offset) {
  const value = core.documentOffsetToPosition(text, offset);
  assert.notEqual(value, null);
  return value;
}

function rangeFor(text, value) {
  const start = text.indexOf(value);
  assert.notEqual(start, -1);
  return {
    start: position(text, start),
    end: position(text, start + value.length),
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function resolvedRuntimeTarget(source, specifier) {
  if (!specifier.startsWith(".")) return null;
  return path.normalize(path.join(path.dirname(source), specifier));
}

async function runtimeClosure(entry) {
  const pending = [entry];
  const modules = new Set();
  const externalSpecifiers = [];
  while (pending.length > 0) {
    const source = pending.pop();
    if (modules.has(source)) continue;
    modules.add(source);
    const text = await repositoryText(source);
    for (const match of text.matchAll(
      /(?:\bfrom\s+|\bimport\s+|\bimport\s*\(\s*)["']([^"']+)["']/g,
    )) {
      const specifier = match[1];
      assert.ok(specifier);
      const target = resolvedRuntimeTarget(source, specifier);
      if (target === null) {
        externalSpecifiers.push({ source, specifier });
      } else {
        pending.push(target);
      }
    }
  }
  return { modules: [...modules].sort(), externalSpecifiers };
}

async function sessionCases() {
  return JSON.parse(
    await repositoryText("test/fixtures/document-session-cases-v1.json"),
  );
}

test("stateless snapshots retain exact frozen Grammar 6 source identity", async () => {
  const text = await repositoryText("plans/adapter-platform.pert");
  const snapshot = core.createDocumentSnapshot(
    {
      uri: "file:///workspace/adapter-platform.pert",
      generation: "stateless-1",
      version: 7,
      text,
    },
    { digestText },
  );

  assert.deepEqual(snapshot.binding, {
    uri: "file:///workspace/adapter-platform.pert",
    generation: "stateless-1",
    version: 7,
    sourceDigest: digestText(text),
  });
  assert.equal(snapshot.text, text);
  const project = snapshot.parse.document.declarations.find(
    ({ kind }) => kind === "project",
  );
  assert.equal(
    project?.fields.find(({ name }) => name === "version")?.value,
    6,
  );
  assert.equal(snapshot.semantic.ok, true);
  assert.equal(snapshot.semantic.diagnosticsTruncated, false);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.binding), true);
  assert.equal(Object.isFrozen(snapshot.parse), true);
  assert.equal(Object.isFrozen(snapshot.parse.document.declarations), true);
  assert.equal(Object.isFrozen(snapshot.semantic.diagnostics), true);
});

test("position conversion is exact for UTF-16, CRLF, CR, LF, and invalid boundaries", () => {
  const text = "A😀B\r\nC\rD\n";
  assert.deepEqual(core.documentOffsetToPosition(text, 0), { line: 0, character: 0 });
  assert.deepEqual(core.documentOffsetToPosition(text, 3), { line: 0, character: 3 });
  assert.deepEqual(core.documentOffsetToPosition(text, 4), { line: 0, character: 4 });
  assert.deepEqual(core.documentOffsetToPosition(text, 6), { line: 1, character: 0 });
  assert.deepEqual(core.documentOffsetToPosition(text, 7), { line: 1, character: 1 });
  assert.deepEqual(core.documentOffsetToPosition(text, 8), { line: 2, character: 0 });
  assert.deepEqual(core.documentOffsetToPosition(text, 10), { line: 3, character: 0 });
  assert.equal(core.documentOffsetToPosition(text, 2), null);
  assert.equal(core.documentOffsetToPosition(text, 5), null);
  assert.equal(core.documentOffsetToPosition(text, 11), null);
  assert.equal(core.documentPositionToOffset(text, { line: 0, character: 2 }), null);
  assert.equal(core.documentPositionToOffset(text, { line: 0, character: 4 }), 4);
  assert.equal(core.documentPositionToOffset(text, { line: 1, character: 0 }), 6);
  assert.equal(core.documentPositionToOffset(text, { line: 3, character: 0 }), 10);
  assert.equal(core.documentPositionToOffset(text, { line: 4, character: 0 }), null);
  assert.equal(core.documentPositionToOffset(text, { line: 0.5, character: 0 }), null);
});

test("ordered incremental changes publish one new immutable snapshot", async () => {
  const original = await repositoryText("docs/examples/minimal.pert");
  const firstCandidate = original.replace("Do work", "Do planned work");
  const expected = firstCandidate.replace("planned", "verified");
  const session = core.createDocumentSession({ digestText });
  const opened = session.open({
    uri: "file:///workspace/minimal.pert",
    version: 1,
    text: original,
  });
  assert.equal(opened.status, "current");
  const originalSnapshot = opened.snapshot;
  assert.notEqual(originalSnapshot, null);

  const changed = session.change({
    uri: originalSnapshot.binding.uri,
    version: 2,
    changes: [
      { range: rangeFor(original, "Do work"), text: "Do planned work" },
      { range: rangeFor(firstCandidate, "planned"), text: "verified" },
    ],
  });
  assert.equal(changed.status, "current");
  assert.notEqual(changed.snapshot, null);
  assert.equal(changed.snapshot.text, expected);
  assert.equal(changed.snapshot.binding.version, 2);
  assert.equal(changed.snapshot.binding.generation, originalSnapshot.binding.generation);
  assert.equal(changed.snapshot.binding.sourceDigest, digestText(expected));
  assert.equal(originalSnapshot.text, original);
  assert.equal(session.resolve(originalSnapshot.binding), "stale");
  assert.equal(Object.isFrozen(changed.snapshot), true);
});

test("close and reopen create a distinct generation even at a repeated version", async () => {
  const text = await repositoryText("docs/examples/minimal.pert");
  const session = core.createDocumentSession({ digestText });
  const first = session.open({ uri: "file:///plan.pert", version: 4, text });
  assert.equal(first.status, "current");
  assert.notEqual(first.snapshot, null);
  assert.equal(session.close(first.snapshot.binding.uri), true);
  assert.equal(session.current(first.snapshot.binding.uri), null);
  assert.equal(session.resolve(first.snapshot.binding), "closed");
  assert.equal(session.close(first.snapshot.binding.uri), false);

  const second = session.open({ uri: first.snapshot.binding.uri, version: 4, text });
  assert.equal(second.status, "current");
  assert.notEqual(second.snapshot, null);
  assert.notEqual(second.snapshot.binding.generation, first.snapshot.binding.generation);
  assert.equal(session.resolve(first.snapshot.binding), "stale");
  assert.equal(session.resolve(second.snapshot.binding), "current");
});

test("lifecycle, version, range, and digest failures terminally desynchronize", async () => {
  const text = await repositoryText("docs/examples/minimal.pert");
  for (const violate of [
    (session, snapshot) => session.open({ uri: snapshot.binding.uri, version: 2, text }),
    (session) => session.change({
      uri: "file:///missing.pert",
      version: 2,
      changes: [{ range: rangeFor(text, "Do work"), text: "Missing" }],
    }),
    (session, snapshot) => session.change({
      uri: snapshot.binding.uri,
      version: snapshot.binding.version,
      changes: [{ range: rangeFor(text, "Do work"), text: "Repeat" }],
    }),
    (session, snapshot) => session.change({
      uri: snapshot.binding.uri,
      version: 2,
      changes: [],
    }),
    (session, snapshot) => session.change({
      uri: snapshot.binding.uri,
      version: 2,
      changes: [{ text: "missing range" }],
    }),
    (session, snapshot) => session.change({
      uri: snapshot.binding.uri,
      version: 2,
      changes: [{
        range: {
          start: { line: 100, character: 0 },
          end: { line: 100, character: 1 },
        },
        text: "invalid",
      }],
    }),
  ]) {
    const session = core.createDocumentSession({ digestText });
    const opened = session.open({ uri: "file:///plan.pert", version: 1, text });
    assert.notEqual(opened.snapshot, null);
    const failed = violate(session, opened.snapshot);
    assert.equal(failed.status, "desynchronized");
    assert.equal(session.state, "desynchronized");
    assert.equal(session.current(opened.snapshot.binding.uri), null);
    assert.equal(session.resolve(opened.snapshot.binding), "desynchronized");
    assert.equal(
      session.open({ uri: "file:///recovery.pert", version: 1, text }).status,
      "desynchronized",
    );
  }

  const digestFailure = core.createDocumentSession({ digestText: () => "invalid" });
  assert.equal(
    digestFailure.open({ uri: "file:///plan.pert", version: 1, text }).status,
    "desynchronized",
  );
  assert.equal(digestFailure.state, "desynchronized");

  let digestCalls = 0;
  const changeDigestFailure = core.createDocumentSession({
    digestText: (value) => {
      digestCalls += 1;
      return digestCalls === 1 ? digestText(value) : "invalid";
    },
  });
  const opened = changeDigestFailure.open({
    uri: "file:///plan.pert",
    version: 1,
    text,
  });
  assert.notEqual(opened.snapshot, null);
  assert.equal(
    changeDigestFailure.change({
      uri: opened.snapshot.binding.uri,
      version: 2,
      changes: [{ range: rangeFor(text, "1d"), text: "2d" }],
    }).status,
    "desynchronized",
  );
});

test("invalid and truncated snapshots fail closed without desynchronizing", async () => {
  const invalidText = "project BROKEN:\n  version nope\n";
  const invalidSession = core.createDocumentSession({ digestText });
  const invalid = invalidSession.open({
    uri: "file:///invalid.pert",
    version: 1,
    text: invalidText,
  });
  assert.equal(invalid.status, "current");
  assert.notEqual(invalid.snapshot, null);
  assert.equal(invalid.snapshot.semantic.ok, false);
  assert.equal(invalidSession.state, "active");
  const invalidAnalysis = await invalidSession.analyze(invalid.snapshot.binding);
  assert.equal(invalidAnalysis.status, "invalid");
  assert.equal(invalidAnalysis.complete, false);
  assert.equal(invalidAnalysis.analysis, null);

  const warningText = `project TRUNCATED:
  version 1
  title "Truncated diagnostics"
  duration_unit day
  finish C

milestone A:
  title "A"
  state reached

milestone B:
  title "B"

milestone C:
  title "C"

task AB A -> B:
  title "AB"
  duration 1d
  status done

task BC B -> C:
  title "BC"
  duration 1d
  status done
`;
  const truncatedSession = core.createDocumentSession({
    digestText,
    maxDiagnostics: 1,
  });
  const truncated = truncatedSession.open({
    uri: "file:///adapter-platform.pert",
    version: 1,
    text: warningText,
  });
  assert.notEqual(truncated.snapshot, null);
  assert.equal(truncated.snapshot.semantic.ok, true);
  assert.equal(truncated.snapshot.semantic.diagnosticsTruncated, true);
  assert.equal(truncated.snapshot.semantic.diagnostics.length, 1);
  const unavailable = await truncatedSession.analyze(truncated.snapshot.binding);
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.complete, false);
  assert.equal(unavailable.analysis, null);
});

test("analysis modes reuse one snapshot and snapshot mutable option inputs", async () => {
  const text = await repositoryText("docs/examples/minimal.pert");
  const snapshot = core.createDocumentSnapshot(
    { uri: "file:///minimal.pert", generation: "stateless", version: 1, text },
    { digestText },
  );
  const expectedViews = {
    none: [false, false],
    precedence: [true, false],
    resource: [false, true],
    both: [true, true],
  };
  for (const [mode, [hasPrecedence, hasResource]] of Object.entries(expectedViews)) {
    const projection = core.analyzeDocumentSnapshot(snapshot, { mode });
    assert.equal(projection.status, "current", mode);
    assert.equal(projection.complete, true, mode);
    assert.equal(projection.analysisMode, mode);
    assert.equal(
      projection.analysis !== null && projection.analysis.precedence !== null,
      hasPrecedence,
      mode,
    );
    assert.equal(
      projection.analysis !== null && projection.analysis.resource !== null,
      hasResource,
      mode,
    );
  }

  const session = core.createDocumentSession({ digestText });
  const opened = session.open({ uri: snapshot.binding.uri, version: 1, text });
  assert.notEqual(opened.snapshot, null);
  const callerOverrides = new Map();
  const firstPromise = session.analyze(opened.snapshot.binding, {
    mode: "both",
    capacityOverrides: callerOverrides,
  });
  callerOverrides.set("MUTATED_AFTER_CALL", 1);
  const first = await firstPromise;
  assert.equal(first.status, "current");
  assert.equal(first.cached, false);
  assert.equal(first.analysis?.capacityOverrides.size, 0);
  const second = await session.analyze(opened.snapshot.binding, {
    mode: "both",
    capacityOverrides: new Map(),
  });
  assert.equal(second.status, "current");
  assert.equal(second.cached, true);
  assert.equal(second.analysis, first.analysis);
});

test("generic projection cache is completed-value and snapshot scoped", async () => {
  const text = await repositoryText("docs/examples/minimal.pert");
  const session = core.createDocumentSession({ digestText });
  const opened = session.open({ uri: "file:///plan.pert", version: 1, text });
  assert.notEqual(opened.snapshot, null);
  let calls = 0;
  const request = {
    binding: opened.snapshot.binding,
    cacheKey: "test:projection:v1",
    compute: () => ({ call: ++calls }),
  };
  const first = await session.project(request);
  const second = await session.project(request);
  assert.equal(first.status, "current");
  assert.equal(first.cached, false);
  assert.equal(second.status, "current");
  assert.equal(second.cached, true);
  assert.equal(second.value, first.value);
  assert.equal(calls, 1);

  const changedText = text.replace("1d", "2d");
  const changed = session.change({
    uri: opened.snapshot.binding.uri,
    version: 2,
    changes: [{
      range: {
        start: { line: 0, character: 0 },
        end: position(text, text.length),
      },
      text: changedText,
    }],
  });
  assert.notEqual(changed.snapshot, null);
  const third = await session.project({
    ...request,
    binding: changed.snapshot.binding,
  });
  assert.equal(third.cached, false);
  assert.equal(calls, 2);
});

test("async work made stale returns no value and is never cached", async () => {
  const text = await repositoryText("docs/examples/minimal.pert");
  const session = core.createDocumentSession({ digestText });
  const opened = session.open({ uri: "file:///plan.pert", version: 1, text });
  assert.notEqual(opened.snapshot, null);
  const gate = deferred();
  let calls = 0;
  const pending = session.project({
    binding: opened.snapshot.binding,
    cacheKey: "test:stale:v1",
    compute: async () => {
      calls += 1;
      return await gate.promise;
    },
  });
  await Promise.resolve();
  const changed = session.change({
    uri: opened.snapshot.binding.uri,
    version: 2,
    changes: [{ range: rangeFor(text, "1d"), text: "2d" }],
  });
  assert.equal(changed.status, "current");
  gate.resolve("late-value");
  const stale = await pending;
  assert.equal(stale.status, "stale");
  assert.equal(stale.value, null);
  assert.equal(stale.cached, false);
  const repeated = await session.project({
    binding: opened.snapshot.binding,
    cacheKey: "test:stale:v1",
    compute: () => {
      calls += 1;
      return "unexpected";
    },
  });
  assert.equal(repeated.status, "stale");
  assert.equal(calls, 1);

  for (const lifecycle of ["close", "reopen"]) {
    const lifecycleSession = core.createDocumentSession({ digestText });
    const lifecycleOpen = lifecycleSession.open({
      uri: `file:///${lifecycle}.pert`,
      version: 1,
      text,
    });
    assert.notEqual(lifecycleOpen.snapshot, null);
    const lifecycleGate = deferred();
    const lifecyclePending = lifecycleSession.project({
      binding: lifecycleOpen.snapshot.binding,
      cacheKey: `test:${lifecycle}:v1`,
      compute: () => lifecycleGate.promise,
    });
    await Promise.resolve();
    assert.equal(lifecycleSession.close(lifecycleOpen.snapshot.binding.uri), true);
    if (lifecycle === "reopen") {
      assert.equal(
        lifecycleSession.open({
          uri: lifecycleOpen.snapshot.binding.uri,
          version: 1,
          text,
        }).status,
        "current",
      );
    }
    lifecycleGate.resolve("late-lifecycle-value");
    const lifecycleResult = await lifecyclePending;
    assert.equal(
      lifecycleResult.status,
      lifecycle === "close" ? "closed" : "stale",
    );
    assert.equal(lifecycleResult.value, null);
    assert.equal(lifecycleResult.cached, false);
  }
});

test("cancellation before completion returns no value and performs no cache write", async () => {
  const text = await repositoryText("docs/examples/minimal.pert");
  const session = core.createDocumentSession({ digestText });
  const opened = session.open({ uri: "file:///plan.pert", version: 1, text });
  assert.notEqual(opened.snapshot, null);
  const gate = deferred();
  let calls = 0;
  const preController = new AbortController();
  preController.abort();
  const preCancelled = await session.project({
    binding: opened.snapshot.binding,
    cacheKey: "test:pre-cancel:v1",
    signal: preController.signal,
    compute: () => {
      calls += 1;
      return "not-started";
    },
  });
  assert.equal(preCancelled.status, "cancelled");
  assert.equal(calls, 0);

  const controller = new AbortController();
  const pending = session.project({
    binding: opened.snapshot.binding,
    cacheKey: "test:cancel:v1",
    signal: controller.signal,
    compute: async () => {
      calls += 1;
      return await gate.promise;
    },
  });
  await Promise.resolve();
  controller.abort();
  const cancelled = await pending;
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.value, null);
  assert.equal(cancelled.cached, false);
  gate.resolve("late-value");
  await Promise.resolve();

  const repeated = await session.project({
    binding: opened.snapshot.binding,
    cacheKey: "test:cancel:v1",
    compute: () => {
      calls += 1;
      return "fresh-value";
    },
  });
  assert.equal(repeated.status, "current");
  assert.equal(repeated.cached, false);
  assert.equal(repeated.value, "fresh-value");
  assert.equal(calls, 2);

  const postController = new AbortController();
  const postCancelled = await session.project({
    binding: opened.snapshot.binding,
    cacheKey: "test:post-cancel:v1",
    signal: postController.signal,
    compute: () => {
      calls += 1;
      postController.abort();
      return "cancelled-after-work";
    },
  });
  assert.equal(postCancelled.status, "cancelled");
  assert.equal(postCancelled.value, null);
  const postRepeated = await session.project({
    binding: opened.snapshot.binding,
    cacheKey: "test:post-cancel:v1",
    compute: () => {
      calls += 1;
      return "fresh-after-post-cancel";
    },
  });
  assert.equal(postRepeated.cached, false);
  assert.equal(postRepeated.value, "fresh-after-post-cancel");
  assert.equal(calls, 4);
});

test("current Core catalog and runtime closure remain portable and additive", async () => {
  const cases = await sessionCases();
  assert.equal(cases.schema_version, "Perttool.DocumentSessionCases.v1");
  assert.equal(cases.session_model_version, 1);
  assert.deepEqual(Object.keys(core), cases.core.runtime_exports);
  assert.equal(Object.keys(core).length, cases.core.runtime_export_count);
  for (const name of cases.core.new_runtime_exports) {
    assert.equal(typeof core[name], "function", name);
    assert.equal(name in packageRoot, false, name);
    assert.equal(name in nodeApi, false, name);
  }
  assert.equal(Object.keys(packageRoot).length, 122);
  assert.equal(Object.keys(nodeApi).length, 122);
  assert.equal(typeof packageRoot.createNodeHost, "function");
  assert.equal(packageRoot.createNodeHost, nodeApi.createNodeHost);

  const closure = await runtimeClosure("dist/core/index.js");
  assert.equal(closure.modules.length, cases.core.runtime_module_count);
  assert.deepEqual(closure.externalSpecifiers, []);
  for (const source of closure.modules) {
    assert.equal(
      cases.core.forbidden_runtime_prefixes.some((prefix) => source.startsWith(prefix)),
      false,
      source,
    );
  }
});

test("document-session normative cases remain dependency ordered", async () => {
  const cases = await sessionCases();
  const accepted = new Set();
  for (const contractCase of cases.cases) {
    assert.equal(
      contractCase.depends_on.every((id) => accepted.has(id)),
      true,
      contractCase.id,
    );
    accepted.add(contractCase.id);
  }
  assert.deepEqual([...accepted], [
    "DSC-001",
    "DSC-002",
    "DSC-003",
    "DSC-004",
    "DSC-005",
    "DSC-006",
    "DSC-007",
    "DSC-008",
    "DSC-009",
    "DSC-010",
    "DSC-011",
    "DSC-012",
  ]);
});

test("document-session acceptance and completed task remain aligned", async () => {
  const [specification, acceptance, backlog, plan] = await Promise.all([
    repositoryText("docs/specs/document-session.md"),
    repositoryText("docs/process/adapter-document-session-acceptance.md"),
    repositoryText("docs/backlog.md"),
    repositoryText("plans/adapter-platform.pert"),
  ]);
  assert.match(specification, /- Document status: Accepted 1\.0/);
  assert.match(acceptance, /- Document status: Accepted 1\.0/);
  assert.match(
    acceptance,
    /sha256:1adc6eb1a054e5ae5919365ba4e96a81b01924a9ca01c0701e9326ca4b8ffe5e/,
  );
  assert.match(backlog, /adapter-document-session-acceptance\.md/);
  const checked = packageRoot.checkDocument(plan);
  const task = checked.document.declarations.find(
    ({ kind, id }) => kind === "task" && id === "DOCUMENT_SESSION_CORE",
  );
  assert.equal(task?.fields.find(({ name }) => name === "status")?.value, "done");
});
