import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyGovernanceScopes,
  evaluateGovernanceAuthority,
  governanceDenialDiagnostic,
  normalizeGovernanceRequest,
} from "../dist/governance/authority.js";
import {
  governanceSourceSnapshot,
} from "../dist/governance/source.js";
import { digestDocumentBytes } from "../dist/io/document-file.js";
import {
  planTargetGrammar4BatchMutation,
  planTargetGrammar4Mutation,
} from "../dist/application/target-mutate.js";
import {
  formatTargetGrammar4Document,
} from "../dist/formatter/target-source-formatter.js";
import {
  TARGET_GRAMMAR_4_CAPABILITY,
} from "../dist/parser/document-parser.js";
import {
  validateTargetGrammar4Document,
} from "../dist/semantic/target-validator.js";

function source() {
  return [
    "project AUTHORITY:",
    "  version 4",
    '  title "authority"',
    "  duration_unit day",
    "  finish FINISH",
    "  goal_owner user",
    "  goal_delegates [llm]",
    "  dag_owner admin",
    "  dag_delegates [codex]",
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

function validated(text) {
  const result = validateTargetGrammar4Document(
    text,
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  return result.validatedDocument;
}

function snapshot(text) {
  return governanceSourceSnapshot(
    validated(text),
    digestDocumentBytes(Buffer.from(text)),
  );
}

function request(input) {
  const normalized = normalizeGovernanceRequest(input);
  assert.equal(normalized.ok, true, JSON.stringify(normalized.diagnostics));
  return normalized.request;
}

test("actual-change classification separates goal, DAG, and ordinary maintenance", () => {
  const originalText = source();
  const original = validated(originalText).document;

  const goal = planTargetGrammar4Mutation(
    originalText,
    { kind: "project.set", set: { goalOwner: "llm" } },
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(goal.ok, true);
  assert.deepEqual(
    classifyGovernanceScopes(original, validated(goal.updatedText).document),
    ["goal"],
  );

  const dag = planTargetGrammar4Mutation(
    originalText,
    {
      kind: "task.add",
      id: "WORK",
      from: "START",
      to: "FINISH",
      task: { title: "work", duration: "1d" },
    },
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(dag.ok, true);
  assert.deepEqual(
    classifyGovernanceScopes(original, validated(dag.updatedText).document),
    ["dag"],
  );

  const mixed = planTargetGrammar4BatchMutation(
    originalText,
    {
      kind: "batch",
      mutations: [
        { kind: "project.set", set: { goalDelegates: ["codex"] } },
        {
          kind: "task.add",
          id: "WORK",
          from: "START",
          to: "FINISH",
          task: { title: "work", duration: "1d" },
        },
      ],
    },
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(mixed.ok, true);
  assert.deepEqual(
    classifyGovernanceScopes(original, validated(mixed.updatedText).document),
    ["goal", "dag"],
  );

  const ordinary = planTargetGrammar4Mutation(
    originalText,
    { kind: "project.set", set: { title: "renamed" } },
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(ordinary.ok, true);
  assert.deepEqual(
    classifyGovernanceScopes(
      original,
      validated(ordinary.updatedText).document,
    ),
    [],
  );
  assert.deepEqual(classifyGovernanceScopes(original, original), []);
});

test("formatter-only source changes have no authority scope", () => {
  const noncanonical = source().replace(
    "goal_delegates [llm]",
    "goal_delegates [ llm ]",
  );
  const formatted = formatTargetGrammar4Document(
    noncanonical,
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(formatted.ok, true);
  assert.equal(formatted.changed, true);
  assert.deepEqual(
    classifyGovernanceScopes(
      validated(noncanonical).document,
      validated(formatted.formattedText).document,
    ),
    [],
  );
});

test("governance request normalization is deterministic and fail-closed", () => {
  const normalized = normalizeGovernanceRequest({
    actor: "codex",
    acceptedByOwner: ["user", "admin"],
  });
  assert.equal(normalized.ok, true);
  assert.deepEqual(normalized.request, {
    intent: "preview",
    actor: "codex",
    acceptedByOwner: ["admin", "user"],
  });

  for (const [input, cause] of [
    [{ intent: "write" }, "invalid_intent"],
    [{ actor: "two words" }, "invalid_actor"],
    [{ acceptedByOwner: "user" }, "invalid_accepted_by_owner"],
    [{ acceptedByOwner: ["user", "user"] }, "duplicate_accepted_by_owner"],
    [{ proof: "user" }, "unsupported_field"],
  ]) {
    const result = normalizeGovernanceRequest(input);
    assert.equal(result.ok, false);
    assert.equal(result.diagnostics[0].code, "PTGOV-102");
    assert.equal(result.diagnostics[0].data.cause, cause);
  }
});

test("preview reports owner, delegate, and confirmation facts without denial diagnostics", () => {
  const state = snapshot(source());
  const missing = evaluateGovernanceAuthority(
    state,
    ["goal"],
    request({}),
  );
  assert.equal(missing.intent, "preview");
  assert.equal(missing.applicable, true);
  assert.equal(missing.writeAuthorized, false);
  assert.deepEqual(missing.requiredOwnerConfirmations, ["user"]);
  assert.equal(missing.scopes[0].denialCause, "actor_required");
  assert.equal(governanceDenialDiagnostic(missing), null);

  const owner = evaluateGovernanceAuthority(
    state,
    ["goal"],
    request({ actor: "user" }),
  );
  assert.equal(owner.writeAuthorized, true);
  assert.equal(owner.scopes[0].actorDirect, true);
  assert.equal(owner.scopes[0].ownerConfirmationRequired, false);

  const delegate = evaluateGovernanceAuthority(
    state,
    ["goal"],
    request({ actor: "llm" }),
  );
  assert.equal(delegate.writeAuthorized, true);
  assert.equal(delegate.scopes[0].actorDirect, true);

  const crossScope = evaluateGovernanceAuthority(
    state,
    ["goal"],
    request({ actor: "codex" }),
  );
  assert.equal(crossScope.writeAuthorized, false);
  assert.equal(
    crossScope.scopes[0].denialCause,
    "owner_confirmation_required",
  );
});

test("mixed scopes require each distinct pre-change owner and authorize atomically", () => {
  const state = snapshot(source());
  const partial = evaluateGovernanceAuthority(
    state,
    ["dag", "goal"],
    request({
      intent: "persist",
      actor: "service",
      acceptedByOwner: ["user"],
    }),
  );
  assert.deepEqual(partial.affectedScopes, ["goal", "dag"]);
  assert.deepEqual(partial.requiredOwnerConfirmations, ["user", "admin"]);
  assert.equal(partial.scopes[0].scopeAuthorized, true);
  assert.equal(partial.scopes[1].scopeAuthorized, false);
  assert.equal(
    partial.scopes[1].denialCause,
    "owner_confirmation_mismatch",
  );
  assert.equal(partial.writeAuthorized, false);

  const diagnostic = governanceDenialDiagnostic(partial);
  assert.deepEqual(diagnostic, {
    code: "PTGOV-101",
    severity: "error",
    message:
      "required owner-aware write authority was not established against the pre-change document",
    helpTopic: "editing",
    data: {
      governance_semantics_version: 1,
      source_digest: state.originalDigest,
      actor: "service",
      accepted_by_owner: ["user"],
      denied_scopes: [
        {
          scope: "dag",
          required_owner: "admin",
          cause: "owner_confirmation_mismatch",
        },
      ],
    },
  });

  const complete = evaluateGovernanceAuthority(
    state,
    ["goal", "dag"],
    request({
      intent: "persist",
      actor: "service",
      acceptedByOwner: ["user", "admin"],
    }),
  );
  assert.equal(complete.writeAuthorized, true);
  assert.equal(governanceDenialDiagnostic(complete), null);
});

test("equal owners require one canonical confirmation and confirmations never replace an actor", () => {
  const text = source().replace("  dag_owner admin", "  dag_owner user");
  const state = snapshot(text);
  const actorless = evaluateGovernanceAuthority(
    state,
    ["goal", "dag"],
    request({
      intent: "persist",
      acceptedByOwner: ["user"],
    }),
  );
  assert.deepEqual(actorless.requiredOwnerConfirmations, ["user"]);
  assert.equal(actorless.writeAuthorized, false);
  assert.equal(actorless.scopes[0].denialCause, "actor_required");
  assert.equal(actorless.scopes[1].denialCause, "actor_required");

  const confirmed = evaluateGovernanceAuthority(
    state,
    ["goal", "dag"],
    request({
      intent: "persist",
      actor: "service",
      acceptedByOwner: ["user"],
    }),
  );
  assert.deepEqual(confirmed.requiredOwnerConfirmations, ["user"]);
  assert.equal(confirmed.writeAuthorized, true);
});

test("candidate delegation cannot authorize the mutation that introduces it", () => {
  const originalText = source().replace(
    "  dag_delegates [codex]\n",
    "  dag_delegates []\n",
  );
  const candidate = planTargetGrammar4BatchMutation(
    originalText,
    {
      kind: "batch",
      mutations: [
        { kind: "project.set", set: { dagDelegates: ["service"] } },
        {
          kind: "task.add",
          id: "WORK",
          from: "START",
          to: "FINISH",
          task: { title: "work", duration: "1d" },
        },
      ],
    },
    TARGET_GRAMMAR_4_CAPABILITY,
  );
  assert.equal(candidate.ok, true);
  const scopes = classifyGovernanceScopes(
    validated(originalText).document,
    validated(candidate.updatedText).document,
  );
  assert.deepEqual(scopes, ["dag"]);
  const decision = evaluateGovernanceAuthority(
    snapshot(originalText),
    scopes,
    request({ intent: "persist", actor: "service" }),
  );
  assert.equal(decision.scopes[0].actorDirect, false);
  assert.equal(decision.writeAuthorized, false);
  assert.equal(
    decision.scopes[0].denialCause,
    "owner_confirmation_required",
  );
});

test("ordinary candidates remain authorized without an actor", () => {
  const decision = evaluateGovernanceAuthority(
    snapshot(source()),
    [],
    request({ intent: "persist", acceptedByOwner: ["user"] }),
  );
  assert.deepEqual(decision, {
    schemaVersion: "Perttool.GovernanceDecision.v1",
    governanceInterfaceVersion: 1,
    governanceSourceContractVersion: 1,
    governanceSemanticsVersion: 1,
    sourceDigest: snapshot(source()).originalDigest,
    intent: "persist",
    applicable: false,
    actor: null,
    acceptedByOwner: ["user"],
    affectedScopes: [],
    requiredOwnerConfirmations: [],
    ownerConfirmationRequired: false,
    writeAuthorized: true,
    scopes: [],
  });
  assert.equal(governanceDenialDiagnostic(decision), null);
});
