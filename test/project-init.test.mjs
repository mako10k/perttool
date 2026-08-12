import assert from "node:assert/strict";
import {
  lstatSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  checkDocument,
  createDocumentFile,
  GOVERNANCE_DIRECT_EDIT_WARNING,
  planProjectInit,
  projectInitResultToJson,
  readDocumentFile,
  renderProjectInitResult,
  SafeWriteConflictError,
  serializeProjectInitResult,
  withProjectInitOutput,
} from "../dist/index.js";

const pointRequest = {
  projectId: "SAMPLE",
  title: "Sample project",
  initialMilestone: "START",
  initialMilestoneTitle: "Project started",
  finish: "START",
};

const pointCandidate = `${GOVERNANCE_DIRECT_EDIT_WARNING}
project SAMPLE:
  version 1
  title "Sample project"
  duration_unit point
  finish START

milestone START:
  title "Project started"
  state reached
`;

function workspace(t) {
  const directory = mkdtempSync(path.join(tmpdir(), "perttool-project-init-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test("project init returns the deterministic smallest valid document", () => {
  const result = planProjectInit(pointRequest);

  assert.equal(result.ok, true);
  assert.equal(result.schemaVersion, "Perttool.InitResult.v1");
  assert.equal(result.cliContractVersion, 7);
  assert.equal(result.operation, "project.init");
  assert.equal(result.documentId, "SAMPLE");
  assert.equal(result.source, null);
  assert.equal(result.sourceDigest, null);
  assert.equal(result.candidateText, pointCandidate);
  assert.match(result.candidateDigest, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(result.edits, [{
    startOffset: 0,
    endOffset: 0,
    replacement: pointCandidate,
  }]);
  assert.deepEqual(result.write, {
    mode: "preview",
    target: null,
    written: false,
  });
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.diagnosticsTruncated, false);
  assert.equal(renderProjectInitResult(result), pointCandidate);

  const checked = checkDocument(pointCandidate);
  assert.equal(checked.ok, true);
  assert.deepEqual(checked.summary, {
    resources: 0,
    milestones: 1,
    tasks: 0,
    gates: 0,
    errors: 0,
    warnings: 0,
  });
});

test("project init emits optional fields in grammar order and preserves string meaning", () => {
  const result = planProjectInit({
    ...pointRequest,
    title: "Quoted \"project\"\nnext",
    version: 1,
    asOf: "2026-07-24T09:30:00+09:00",
    velocity: "10p/2d",
  });

  assert.equal(result.ok, true);
  assert.equal(
    result.candidateText,
    `${GOVERNANCE_DIRECT_EDIT_WARNING}
project SAMPLE:
  version 1
  title "Quoted \\"project\\"\\nnext"
  as_of 2026-07-24T09:30:00+09:00
  duration_unit point
  velocity 10p/2d
  finish START

milestone START:
  title "Project started"
  state reached
`,
  );
  assert.equal(checkDocument(result.candidateText).ok, true);
});

test("project init retains deprecated time units with point migration guidance", () => {
  for (const durationUnit of ["day", "hour"]) {
    const result = planProjectInit({ ...pointRequest, durationUnit });
    assert.equal(result.ok, true);
    assert.equal(result.diagnostics.length, 1);
    assert.deepEqual(
      {
        code: result.diagnostics[0]?.code,
        severity: result.diagnostics[0]?.severity,
        helpTopic: result.diagnostics[0]?.helpTopic,
        data: result.diagnostics[0]?.data,
      },
      {
        code: "PTSEM-114",
        severity: "warning",
        helpTopic: "editing.unit-migration",
        data: {
          deprecated_unit: durationUnit,
          replacement_unit: "point",
          migration_command:
            "perttool project migrate-unit <file> --to-unit point --replacement-velocity <points>p/<period>d|h",
        },
      },
    );
    assert.match(result.diagnostics[0]?.message ?? "", /is deprecated/);
  }
});

test("project init fails closed for invalid requests and invalid candidates", () => {
  const cases = [
    {
      request: { ...pointRequest, durationUnit: "week" },
      message: /durationUnit must be day, hour, or point/,
    },
    {
      request: { ...pointRequest, finish: "END" },
      message: /finish must equal initialMilestone/,
    },
    {
      request: { ...pointRequest, template: "kanban" },
      message: /unsupported fields/,
    },
    {
      request: { ...pointRequest, projectId: "not valid" },
      message: undefined,
    },
  ];

  for (const { request, message } of cases) {
    const result = planProjectInit(request);
    assert.equal(result.ok, false);
    assert.equal(result.documentId, null);
    assert.equal(result.candidateText, null);
    assert.equal(result.candidateDigest, null);
    assert.deepEqual(result.edits, []);
    assert.ok(result.diagnostics.length > 0);
    if (message !== undefined) {
      assert.equal(result.diagnostics[0]?.code, "PTMUT-301");
      assert.match(result.diagnostics[0]?.message ?? "", message);
    }
  }
});

test("project init JSON projection is complete and byte deterministic", () => {
  const result = planProjectInit(pointRequest);
  const json = projectInitResultToJson(result);

  assert.deepEqual(Object.keys(json), [
    "schema_version",
    "cli_contract_version",
    "tool_version",
    "operation",
    "ok",
    "document_id",
    "source",
    "source_digest",
    "candidate_text",
    "candidate_digest",
    "edits",
    "write",
    "diagnostics",
    "diagnostics_truncated",
  ]);
  assert.deepEqual(json.edits, [{
    start_offset: 0,
    end_offset: 0,
    replacement: pointCandidate,
  }]);
  assert.deepEqual(json.write, {
    mode: "preview",
    target: null,
    written: false,
  });
  assert.equal(
    serializeProjectInitResult(result),
    serializeProjectInitResult(planProjectInit(pointRequest)),
  );
  assert.ok(serializeProjectInitResult(result).endsWith("\n"));
});

test("project init composes with exclusive safe output and records the write", async (t) => {
  const directory = workspace(t);
  const output = path.join(directory, "plan.pert");
  const result = planProjectInit(pointRequest);
  assert.equal(result.ok, true);

  const write = await createDocumentFile(output, result.candidateText);
  const writtenResult = withProjectInitOutput(result, write);
  assert.deepEqual(writtenResult.write, {
    mode: "out",
    target: output,
    written: true,
  });
  assert.equal(readFileSync(output, "utf8"), pointCandidate);
  assert.equal((await readDocumentFile(output)).digest, result.candidateDigest);
  assert.throws(
    () => withProjectInitOutput(result, {
      ...write,
      digest: `sha256:${"0".repeat(64)}`,
    }),
    /output does not match the candidate/,
  );

  await assert.rejects(
    createDocumentFile(output, result.candidateText),
    (error) =>
      error instanceof SafeWriteConflictError &&
      error.reason === "target_exists",
  );

  const symlink = path.join(directory, "link.pert");
  symlinkSync(path.basename(output), symlink);
  await assert.rejects(
    createDocumentFile(symlink, result.candidateText),
    (error) =>
      error instanceof SafeWriteConflictError &&
      error.reason === "symlink",
  );
  assert.equal(lstatSync(symlink).isSymbolicLink(), true);
});
