import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as perttool from "../dist/index.js";
import {
  planTargetGovernanceProjectInit,
  GOVERNANCE_DIRECT_EDIT_WARNING,
} from "../dist/application/target-governance-init.js";
import {
  getTargetGovernanceProjectMetadata,
} from "../dist/application/target-governance-project.js";
import {
  planTargetGrammar4BatchMutation,
  planTargetGrammar4Mutation,
} from "../dist/application/target-mutate.js";
import {
  planTargetUnitMigrationResult,
} from "../dist/application/target-unit-migration-result.js";
import {
  formatTargetGrammar4Document,
} from "../dist/formatter/target-source-formatter.js";
import {
  governanceSourceSnapshot,
} from "../dist/governance/source.js";
import { digestDocumentBytes } from "../dist/io/document-file.js";
import {
  TARGET_GRAMMAR_4_CAPABILITY,
  parseTargetGrammar4Document,
} from "../dist/parser/document-parser.js";
import {
  validateTargetGrammar4Document,
} from "../dist/semantic/target-validator.js";

function source({
  version = 4,
  governance = [
    "  goal_owner user",
    "  goal_delegates [llm, codex]",
    "  dag_owner admin",
    "  dag_delegates []",
  ],
  extraProject = [],
} = {}) {
  return [
    "project GOVERNED:",
    `  version ${version}`,
    '  title "governed"',
    "  as_of 2026-07-26",
    "  duration_unit day",
    "  finish FINISH",
    ...governance,
    ...extraProject,
    "",
    "milestone START:",
    '  title "start"',
    "  state reached",
    "",
    "milestone FINISH:",
    '  title "finish"',
    "",
    "gate PATH START -> FINISH:",
    '  reason "path"',
    "",
  ].join("\n");
}

test("target Grammar 4 parses principal values and publishes a digest-bound snapshot", () => {
  assert.equal(Object.isFrozen(TARGET_GRAMMAR_4_CAPABILITY), true);
  const text = source();
  assert.throws(
    () =>
      parseTargetGrammar4Document(text, {
        ...TARGET_GRAMMAR_4_CAPABILITY,
      }),
    /target Grammar 4 governance source capability is required/,
  );
  const parsed = parseTargetGrammar4Document(
    text,
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(parsed.diagnosticCounts.errors, 0);
  const checked = validateTargetGrammar4Document(
    text,
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(checked.ok, true);
  assert.equal(checked.validatedDocument.grammarVersion, 4);

  const digest = digestDocumentBytes(Buffer.from(text));
  const snapshot = governanceSourceSnapshot(
    checked.validatedDocument,
    digest,
  );
  assert.equal(snapshot.originalDigest, digest);
  assert.equal(snapshot.grammarVersion, 4);
  assert.deepEqual(snapshot.declared, {
    goalOwner: "user",
    goalDelegates: ["llm", "codex"],
    dagOwner: "admin",
    dagDelegates: [],
  });
  assert.equal(snapshot.effective.goalOwner, "user");
  assert.deepEqual([...snapshot.effective.goalDelegates], ["llm", "codex"]);
  assert.equal(snapshot.effective.dagOwner, "admin");
  assert.deepEqual([...snapshot.effective.dagDelegates], []);
  assert.notEqual(snapshot.sourceSpans.goalOwner, null);
  assert.equal(
    text.slice(
      snapshot.sourceSpans.goalOwner.valueSpan.start.offset,
      snapshot.sourceSpans.goalOwner.valueSpan.end.offset,
    ),
    "user",
  );
});

test("omitted governance defaults do not alter Grammar 1/2/3 source", () => {
  for (const version of [1, 2, 3]) {
    const text = source({ version, governance: [] });
    const checked = validateTargetGrammar4Document(
      text,
      TARGET_GRAMMAR_4_CAPABILITY,
    );
    assert.equal(checked.ok, true, `version ${version}`);
    const metadata = getTargetGovernanceProjectMetadata(
      text,
      TARGET_GRAMMAR_4_CAPABILITY,
    );
    assert.equal(metadata.ok, true);
    assert.equal(metadata.project.governance.sourceContractVersion, 1);
    assert.deepEqual(metadata.project.governance.declared, {
      goalOwner: null,
      goalDelegates: null,
      dagOwner: null,
      dagDelegates: null,
    });
    assert.equal(metadata.project.governance.effective.goalOwner, "user");
    assert.equal(metadata.project.governance.effective.dagOwner, "user");
    assert.deepEqual(
      [...metadata.project.governance.effective.goalDelegates],
      [],
    );
    assert.equal(metadata.project.version, version);
    assert.equal(metadata.project.asOf.kind, "date");
  }

  const activeVersion4 = perttool.checkDocument(
    source({ governance: [] }),
  );
  assert.equal(activeVersion4.ok, true);
  assert.equal(activeVersion4.grammarVersion, 4);
  const activeGovernance = perttool.checkDocument(source());
  assert.equal(activeGovernance.ok, true);
  assert.equal(activeGovernance.grammarVersion, 4);
});

test("governance field names remain contextual rather than reserved entity IDs", () => {
  const text = source({ version: 1, governance: [] })
    .replaceAll("FINISH", "goal_owner")
    .replace("gate PATH START -> goal_owner:", "gate dag_owner START -> goal_owner:");
  const checked = validateTargetGrammar4Document(
    text,
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(checked.ok, true);
  assert.equal(
    checked.document.declarations.some(({ id }) => id === "goal_owner"),
    true,
  );
  assert.equal(
    checked.document.declarations.some(({ id }) => id === "dag_owner"),
    true,
  );
});

test("principal syntax and duplicate delegates fail closed", () => {
  const malformed = validateTargetGrammar4Document(
    source({ governance: ["  goal_owner \"user\""] }),
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(malformed.ok, false);
  assert.equal(
    malformed.diagnostics.some(({ code }) => code === "PTDSL-004"),
    true,
  );

  const duplicate = validateTargetGrammar4Document(
    source({ governance: ["  dag_delegates [codex, codex]"] }),
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(duplicate.ok, false);
  assert.equal(
    duplicate.diagnostics.some(({ code }) => code === "PTSEM-113"),
    true,
  );
});

test("Grammar 4 formatting canonicalizes only declared values", () => {
  const text = source({
    governance: [
      "  goal_owner user",
      "  goal_delegates [llm,codex]",
    ],
  });
  const formatted = formatTargetGrammar4Document(
    text,
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(formatted.ok, true);
  assert.match(formatted.formattedText, /goal_delegates \[llm, codex\]/);
  assert.equal(
    formatted.formattedText.startsWith(GOVERNANCE_DIRECT_EDIT_WARNING),
    false,
  );

  const omitted = source({ governance: [] });
  const omittedFormatted = formatTargetGrammar4Document(
    omitted,
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.doesNotMatch(omittedFormatted.formattedText, /goal_owner|dag_owner/);

  const activeFormatted = perttool.formatDocument(text);
  assert.equal(activeFormatted.ok, true);
  assert.equal(activeFormatted.formattedText, formatted.formattedText);
});

test("project mutation upgrades atomically, preserves order, and supports clear/downgrade", () => {
  const grammar1 = source({
    version: 1,
    governance: [],
    extraProject: ["  critical_epsilon 0d"],
  });
  const upgraded = planTargetGrammar4Mutation(
    grammar1,
    {
      kind: "project.set",
      set: {
        goalOwner: "llm",
        goalDelegates: ["codex", "user"],
        dagDelegates: [],
      },
    },
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(upgraded.ok, true);
  assert.match(upgraded.updatedText, /version 4/);
  assert.match(upgraded.updatedText, /goal_owner llm/);
  assert.match(upgraded.updatedText, /goal_delegates \[codex, user\]/);
  assert.match(upgraded.updatedText, /dag_delegates \[\]/);
  assert.ok(
    upgraded.updatedText.indexOf("dag_delegates") <
      upgraded.updatedText.indexOf("critical_epsilon"),
  );
  assert.equal(
    validateTargetGrammar4Document(
      upgraded.updatedText,
      TARGET_GRAMMAR_4_CAPABILITY,
    ).ok,
    true,
  );

  const cleared = planTargetGrammar4Mutation(
    upgraded.updatedText,
    {
      kind: "project.set",
      clear: ["goal_owner", "goal_delegates", "dag_delegates"],
    },
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(cleared.ok, true);
  assert.match(cleared.updatedText, /version 4/);
  assert.doesNotMatch(cleared.updatedText, /goal_owner|goal_delegates|dag_delegates/);

  const downgraded = planTargetGrammar4Mutation(
    cleared.updatedText,
    { kind: "project.set", set: { version: 3 } },
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(downgraded.ok, true);
  assert.match(downgraded.updatedText, /version 3/);

  const duplicate = planTargetGrammar4Mutation(
    grammar1,
    {
      kind: "project.set",
      set: { dagDelegates: ["codex", "codex"] },
    },
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.updatedText, null);
  assert.equal(
    duplicate.diagnostics.some(({ code }) => code === "PTSEM-113"),
    true,
  );
});

test("atomic batch accepts governance project fields through the target type", () => {
  const text = source({
    version: 1,
    governance: [],
  }).replace(
    "\nmilestone START:",
    '\nresource DEV:\n  title "developer"\n  capacity 1\n\nmilestone START:',
  );
  const result = planTargetGrammar4BatchMutation(
    text,
    {
      kind: "batch",
      mutations: [
        {
          kind: "project.set",
          set: { dagOwner: "llm" },
        },
        {
          kind: "resource.set",
          id: "DEV",
          set: { capacity: 2 },
        },
      ],
    },
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(result.ok, true);
  assert.match(result.updatedText, /version 4/);
  assert.match(result.updatedText, /dag_owner llm/);
  assert.match(result.updatedText, /capacity 2/);
});

test("target project init emits the exact warning and distinguishes explicit empty delegates", () => {
  const initialized = planTargetGovernanceProjectInit(
    {
      projectId: "NEW",
      title: "new",
      durationUnit: "day",
      initialMilestone: "START",
      initialMilestoneTitle: "start",
      finish: "START",
      dagDelegates: [],
    },
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(initialized.ok, true);
  assert.equal(initialized.grammarVersion, 4);
  assert.equal(
    initialized.candidateText.split("\n")[0],
    GOVERNANCE_DIRECT_EDIT_WARNING,
  );
  assert.match(initialized.candidateText, /dag_delegates \[\]/);
  const metadata = getTargetGovernanceProjectMetadata(
    initialized.candidateText,
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.deepEqual(metadata.project.governance.declared.dagDelegates, []);

  const defaultInit = planTargetGovernanceProjectInit(
    {
      projectId: "DEFAULT",
      title: "default",
      durationUnit: "day",
      initialMilestone: "START",
      initialMilestoneTitle: "start",
      finish: "START",
    },
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(defaultInit.ok, true);
  assert.equal(defaultInit.grammarVersion, 1);
  assert.equal(
    defaultInit.candidateText.startsWith(`${GOVERNANCE_DIRECT_EDIT_WARNING}\n`),
    true,
  );
});

test("exact unit migration retains Grammar 4 governance source", () => {
  const text = [
    "project MIGRATE:",
    "  version 4",
    '  title "migrate"',
    "  duration_unit point",
    "  velocity 2p/1d",
    "  finish FINISH",
    "  goal_owner llm",
    "  goal_delegates [codex,user]",
    "  dag_owner user",
    "  dag_delegates []",
    "",
    "milestone START:",
    '  title "start"',
    "  state reached",
    "",
    "milestone FINISH:",
    '  title "finish"',
    "",
    "task WORK START -> FINISH:",
    '  title "work"',
    "  duration 2p",
    "",
  ].join("\n");
  const migrated = planTargetUnitMigrationResult(
    text,
    { targetUnit: "day" },
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(migrated.ok, true);
  assert.equal(migrated.sourceGrammarVersion, 4);
  assert.equal(migrated.targetGrammarVersion, 4);
  assert.match(migrated.updatedText, /version 4/);
  for (const line of [
    "  goal_owner llm",
    "  goal_delegates [codex,user]",
    "  dag_owner user",
    "  dag_delegates []",
  ]) {
    assert.equal(migrated.updatedText.includes(line), true, line);
  }

  const activeMigrated = perttool.planUnitMigration(text, {
    targetUnit: "day",
  });
  assert.equal(activeMigrated.ok, true);
  assert.equal(activeMigrated.sourceGrammarVersion, 4);
  assert.equal(activeMigrated.targetGrammarVersion, 4);
  assert.match(activeMigrated.updatedText, /goal_owner llm/);
});

test("Contract 7 root exposes standard governance types without target helpers", async () => {
  for (const name of [
    "TARGET_GRAMMAR_4_CAPABILITY",
    "parseTargetGrammar4Document",
    "validateTargetGrammar4Document",
    "governanceSourceSnapshot",
    "normalizeGovernanceRequest",
    "evaluateGovernanceAuthority",
    "planTargetGrammar4Mutation",
  ]) {
    assert.equal(name in perttool, false, name);
  }
  const declarations = await readFile(
    new URL("../dist/index.d.ts", import.meta.url),
    "utf8",
  );
  assert.match(declarations, /GovernanceDecisionV2/);
  assert.match(declarations, /GovernanceRequestInput/);
  assert.doesNotMatch(declarations, /parseTargetGrammar4Document/);
  const activeInit = perttool.planProjectInit({
    projectId: "ACTIVE",
    title: "active",
    durationUnit: "day",
    initialMilestone: "START",
    initialMilestoneTitle: "start",
    finish: "START",
  });
  assert.equal(activeInit.ok, true);
  assert.equal(
    activeInit.candidateText.startsWith(GOVERNANCE_DIRECT_EDIT_WARNING),
    true,
  );

  const activeMetadata = perttool.getProjectMetadata(source());
  assert.equal(activeMetadata.ok, true);
  assert.equal(activeMetadata.project.version, 4);
  assert.equal(activeMetadata.project.governance.effective.goalOwner, "user");
  assert.equal(activeMetadata.project.governance.effective.dagOwner, "admin");

  const profileExport = perttool.exportMermaid(source());
  assert.equal(profileExport.ok, false);
  assert.equal(profileExport.artifact, null);
  assert.equal(profileExport.lossReport.lossless, false);
  assert.equal(
    profileExport.diagnostics.some(({ code }) => code === "PTCNV-102"),
    true,
  );
});
