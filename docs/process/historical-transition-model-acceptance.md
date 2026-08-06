# Historical Transition Model Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-06
- Implementation baseline: `2dfc752535195046f0dd1e9178743768246c69d2`
- Plan: [`plans/historical-dag.pert`](../../plans/historical-dag.pert)
- Plan task: `HISTORICAL_TRANSITION_MODEL`
- Normative contract: [Historical DAG Reconstruction Contract](../specs/historical-dag.md)
- Transition model: `Perttool.HistoricalTransitionModel.v1`
- Active public runtime: unchanged Grammar 6 and CLI Contract 7

## 1. Decision

Accept the internal historical transition model implementation. The pure
`src/history/historical-transition.ts` Core projects every validated Grammar 1
through 6 document into one closed whole-document semantic model, separates
source fidelity, classifies adjacent valid checkpoints, and derives
deterministic occurrence, value, and topology epochs.

This acceptance does not activate the future historical result, a command,
schema, package-root export, LSP request, VSIX view, semantic patch, three-way
merge, Git probe, or persistence operation. The current 44 Contract 7 commands,
20 root schemas, root/Core/Node export catalogs, `project history`, and
`Perttool.GraphViewResult.v1` remain unchanged.

The one new internal TypeScript source advances the current closed source-file
inventory from 158 to 159. The Node Host boundary fixture records that exact
inventory change while its ports, builtin owners, public exports, dependencies,
commands, and schemas remain byte-semantically unchanged.

## 2. Implemented semantic boundary

`projectHistoricalTransitionModel` consumes an already validated document and
returns immutable model-1 data with these separately bound identities:

- one complete semantic digest over project identity and effective defaults,
  resources, milestones, tasks, gates, events, planning relations, seals,
  outcomes, and receipts;
- planning, lifecycle, actual-evidence, governance, assurance, and topology
  axis digests;
- exact reduced numerator and denominator strings with an explicit unit for
  every Duration, estimate, velocity component, active-time value, and effort;
- exact calendar values without lexical `sourceText` identity; and
- a source-fidelity digest plus declaration, field, nested-field, and UTF-16
  ownership ranges outside the semantic digest.

Declaration order, field order, comments, whitespace, line endings, BOM,
equivalent Decimal/Fraction spellings, and JSON string escaping therefore do
not create semantic changes. Source-fidelity identity still changes when the
raw source changes.

The model uses the existing Grammar 6 canonical JSON and pure SHA-256
implementation. It does not create a second exact-value, governance,
actual-event, or assurance hash system and never uses binary floating point as
semantic identity.

## 3. Transition classification

`classifyHistoricalTransition` returns exactly one accepted class:

```text
initial
representation_only
evidence_extension
lifecycle_projection
future_plan_edit
canonical_advance
ambiguous_edit
conflict
```

The merge-commit flag remains separate. Representation-only classification
requires complete semantic equality. Additive consistent evidence and
lifecycle projection remain separate from future planning changes. A changed
payload under one work-event ID, changed immutable outcome or receipt, changed
project identity, or changed already-frozen task plan fails closed as a
conflict. Removal without one exact compatible canonical-advance candidate is
an ambiguous noncanonical removal.

Canonical advance is recognized only when the caller supplies a complete pure
planner candidate bound to the previous semantic digest and exactly equal to
the current semantic digest. The candidate is rejected for force, owner
assertion, repository-proof, or persistence assumptions. The later linear Core
still owns invoking the compatible planner and binding its exact removal and
retention summary; this module grants no advance or write authority.

## 4. Occurrences and epochs

`historicalOccurrenceId` hashes the exact structured
project/kind/source-ID/introduction-commit tuple and returns the full
lowercase `HDGE-*` identity. The chronological projection orders occurrences
by milestone, task, gate, resource, then Unicode-scalar source ID. A value
change increments one consecutive one-based ordinal without changing its
occurrence. A representation-only change increments neither value nor
topology identity.

`historicalTopologyEpochId` hashes the canonical ordered task/gate occurrence
and milestone-endpoint set and returns a full lowercase `HDGT-*` identity.
Project-identity discontinuity, an affecting continuity break, or ambiguous
source-ID reuse returns null occurrence/topology identity and a typed
`identity_ambiguous` cause; the reducer does not invent an introduction commit.

## 5. Accepted cases and fixed vectors

The machine-readable matrix is
[`historical-transition-model-v1.json`](../../test/fixtures/historical-transition-model-v1.json).
Its twelve cases cover:

| Case | Accepted boundary |
| --- | --- |
| `HTM-001` | Closed Grammar 1 through 6 whole-document projection and exact values |
| `HTM-002` | Source-fidelity separation and representation-only equivalence |
| `HTM-003` | Lifecycle projection and additive evidence axes |
| `HTM-004` | Stable work-event ID conflict with no winning payload |
| `HTM-005` | Unfrozen future-plan changes |
| `HTM-006` | Fail-closed frozen task meaning |
| `HTM-007` | Exact, complete, unforced canonical-advance candidate |
| `HTM-008` | Noncanonical removal refusal |
| `HTM-009` | Stable occurrence and consecutive value epochs |
| `HTM-010` | Ambiguous reintroduction after an unknown transition |
| `HTM-011` | Deterministic topology epoch and null ambiguous topology |
| `HTM-012` | Internal-only, read-only, unchanged public contract |

The fixture freezes one nonterminating Rational semantic digest, one
`HDGE-*` occurrence vector, and one `HDGT-*` topology vector. The focused test
also projects repository examples and plans under all six active Grammar
versions and exercises current Grammar 6 assurance records.

## 6. Safety and non-goals

The implementation imports no Node, Git, process, filesystem, Application,
CLI, schema-loader, adapter, or persistence module. It accepts no path or Git
revision, performs no I/O, and exposes no write candidate. The future
first-parent fold will inject validated immutable snapshots and a compatible
canonical-advance planner candidate. The Git probe remains the separately
ready `HISTORICAL_GIT_PROBE` task.

Semantic diff, patch application, base/ours/theirs merge, source-fidelity
merge, merge-driver installation, three-way historical ancestry, lineage and
timeline rendering, CLI/LSP/VSIX activation, release selection, publication,
remote writes, Issue mutation, and plan advance remain outside this task.

## 7. Verification

The required focused gate is:

```sh
npm run build
node --test test/historical-transition-model.test.mjs
npm run check
git diff --check
```

The focused test passes all six tests covering the twelve cases. The complete
repository gate passed with 919 tests, the English baseline over 746 text
files, documentation checks over 201 Markdown files and seven PERT examples,
read-only check/analyze/next validation for all 35 self-use plans, the isolated
LSP and MCP gates, the supported VS Code 1.101.0 VSIX host gate, the temporary
link workflow, and the isolated 661-file public package workflow. The package
retains Contract 7, all 20 root schemas, and the plan-assurance installed
workflow. `git diff --check` also passes.

After these gates, the status-only task candidate inserted exactly
`status done` and was written once with source digest
`sha256:0359bb7c88ef8a21c85ffbb8865feab2a11bbd801f65c98642830b82254cba20`
and candidate digest
`sha256:b830f0178b859d94acc6fa4bbfebe5b13ae288e36f6c6e9275feb00247b2ffee`.
Governance was not applicable to that candidate. The separate conformant
outcome candidate is bound to accepted basis
`sha256:7c782b2f9c36f44e6d8eda4c5b13b64bded3569a6c5ea497ab9854b640225b8b`.
Its assertion-free preview requires owner `user` for the `plan_assurance`
scope. After separate confirmation, the same candidate was written once with
actor `codex`, the scope-bound `user` assertion, and the expected source
digest. The resulting plan digest is
`sha256:0fbcdb6fb8da3dd9122395f54dd33b87e544b4f34db6028cefe79db10e79257c`;
readback shows complete assurance with no unavailable task, required action,
or assurance diagnostic.

No Git remote, GitHub, npm, Marketplace, Open VSX, editor-profile,
worktree-source, index, ref, or Git-configuration mutation belongs to this
acceptance.

## 8. Handoff

The later `HISTORICAL_LINEAR_CORE` task may consume the immutable projection,
classifier, occurrence/value epochs, and topology epochs only after the
independent bounded Git evidence task is also complete. It must retain invalid
source inputs as continuity gaps and must independently prove canonical advance
using the active compatible planner and its exact summary.

The next public-interface work remains gated. This acceptance does not add
`Perttool.HistoricalGraphResult.v1` or activate `PTHDG-*` diagnostics.
