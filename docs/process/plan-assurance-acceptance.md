# Conditional Plan Assurance Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-04
- Workstream: `ASSURE-001`
- Task: `ASSURE_ACCEPTANCE`
- Source grammar: Grammar 6
- CLI contract: Contract 7
- Release effect: none

## 1. Scope

This record traces the complete conditional plan-assurance contract through
the active source, Core, CLI, schema, help, temporary-link, and isolated
installed-package surfaces. It covers all fourteen semantic `PAS` cases and
all twelve interface `PAI` cases, including the three dependency modes,
fixed hash vectors, lifecycle exclusion, changed outcomes, explicit reseal,
partial-branch authority, assurance-preserving advance, the independent Git
history-force boundary, compatibility, and real CLI write races.

The acceptance does not change the published `perttool@0.6.0` artifact. It
does not select a release, advance `plans/plan-assurance.pert`, push Git
history, mutate GitHub, publish to npm, move a dist-tag, or close an Issue.

## 2. Reviewed authority

The acceptance uses the repository precedence order:

1. [Requirements](../requirements.md), especially Sections 2.7 and 7.9
2. [Conditional Plan Assurance Contract](../specs/plan-assurance.md)
3. [Plan Assurance Interface Contract](../specs/plan-assurance-interface.md)
4. [Graph Semantics](../specs/graph-semantics.md)
5. [Mutation Semantics](../specs/mutation.md)
6. [Interfaces](../specs/interfaces.md)
7. [Basic Design](../basic-design.md)
8. [Plan Assurance Examples](../examples/plan-assurance.md)
9. [Plan assurance workstream](../../plans/plan-assurance.pert)

The semantic and interface case authorities are
[`plan-assurance-contract-v1.json`](../../test/fixtures/plan-assurance-contract-v1.json)
and
[`plan-assurance-interface-v1.json`](../../test/fixtures/plan-assurance-interface-v1.json).
The executable evidence map is
[`plan-assurance-acceptance-v1.json`](../../test/fixtures/plan-assurance-acceptance-v1.json).
The repository test requires the trace to contain the same ordered `PAS` and
`PAI` IDs as the two contract fixtures and resolves every evidence entry to a
test declaration or verification-script token.

## 3. Semantic case trace

| Case | Acceptance evidence |
| --- | --- |
| `PAS-001` | Assurance-disabled Grammar 1 through 5 documents retain their existing start authority and report `not_enabled`. |
| `PAS-002` | An enabled but unsealed plan withholds new-start authority and requests one atomic initial seal; inspection does not fill hashes. |
| `PAS-003` | Initial seal upgrades to Grammar 6, projects default `both` dependencies, records complete component commitments, and rebuilds in topological order. |
| `PAS-004` | Status, work events, formatting, comments, and equivalent set ordering remain outside the task-plan contract hash. The public CLI workflow verifies a real Grammar 6 finish without changing the selected contract hash. |
| `PAS-005` | An upstream task-plan change produces one direct cause and propagates complete inherited cause paths through the planning closure. |
| `PAS-006` | `planning_only` adds plan dependence without execution readiness or a synthesized AoA edge and requires an explicit reason. |
| `PAS-007` | `execution_only` retains execution order while removing plan propagation and falls back to projected `both` after explicit-record removal. |
| `PAS-008` | A planning cycle fails before hashing and returns a deterministic witness; punctuation aliases remain rejected. |
| `PAS-009` | A conformant outcome is bound to the accepted execution basis and leaves the producer's exported commitment stable. |
| `PAS-010` | Changed outcomes create one versioned commitment and invalidate consumers; missing, stale, or damaged evidence fails closed as unavailable. |
| `PAS-011` | Relation, outcome, and reseal mutations are preview-first, source-preserving, governance-bound, and never silently update accepted hashes. |
| `PAS-012` | One changed root withholds only its affected closure; independent branches retain ordinary recommendation and assurance start authority. |
| `PAS-013` | Advance contracts removed producer commitments into deterministic, self-hashed frontier receipts while retaining every consumer basis exactly. |
| `PAS-014` | Missing crossing evidence and damaged receipt self-hashes fail closed; the model makes neither a malicious-tamper-resistance nor digital-signature claim. |

## 4. Interface case trace

| Case | Acceptance evidence |
| --- | --- |
| `PAI-001` | Historical Contract 6 remains a closed Grammar 5 boundary and is not retroactively activated. |
| `PAI-002` | Grammar 1 through 5 source meaning and assurance-disabled behavior remain compatible under the active Contract 7 implementation. |
| `PAI-003` | Initial seal is the only enablement migration and atomically creates the required Grammar 6 model pair and complete seal baseline. |
| `PAI-004` | The public CLI executes `plan-dependency add`, `set`, and `remove` for `both`, `execution-only`, and `planning-only` semantics. |
| `PAI-005` | The public CLI executes explicit, repeatable-task topological reseal with a required reason and no automatic descendant acceptance. |
| `PAI-006` | The public CLI executes basis-bound outcome add, set, and remove; changed status requires a semantic summary and accepts no caller hash. |
| `PAI-007` | Advance retains consumer modes and exact bases, while `--force-history-loss` never bypasses a failed assurance guard. |
| `PAI-008` | Grammar 6, all 44 commands, Contract 7 results, GovernanceDecision v2, and the closed 20-root schema catalog activate together. |
| `PAI-009` | Domain failures return the fixed assurance diagnostics, unavailable hash inspection emits no digest, and a real separate-output race returns exit 5 without overwriting the winner. |
| `PAI-010` | Assurance writes use governance interface 2, pre-change DAG ownership, fresh candidate authority, expected digest, and one safe persistence step. |
| `PAI-011` | Unit migration preserves Grammar 6 assurance bytes; Mermaid semantic profile 2 round-trips them while older profiles report exact loss. |
| `PAI-012` | The standard parser, package root, CLI, help, schemas, link, and isolated package expose one atomic Contract 7 public boundary without selecting a release. |

## 5. Cross-surface closure

The final acceptance adds one public CLI workflow that executes all ten
assurance maintenance and inspection commands against one evolving Grammar 6
document. It checks preview/write candidate identity, fresh expected digests,
all relation modes, explicit reseals, lifecycle hash exclusion, changed
outcome propagation, unavailable evidence, and the closed inspection result.

The workflow exposed and closed one public-cutover regression: the shared
actuals edit planner treated every non-Grammar-5 input as an upgrade target and
therefore rewrote a Grammar 6 lifecycle candidate back to version 5. The
planner now preserves version 6 while retaining the historical Grammar 1
through 4 upgrade to version 5. The end-to-end workflow verifies that
`task finish --at` keeps Grammar 6 and leaves the task contract hash unchanged.

The final acceptance also runs a real CLI separate-output race. A competing
writer creates the destination after the assurance command has created its
temporary candidate but before exclusive destination creation. The command
returns exit 5 with `PTIO-501`, preserves the competing bytes, and does not
retry or overwrite them.

## 6. Side-effect boundary

The accepted assurance operations mutate only the requested `.pert` document
or separately selected output after preview, governance, expected-digest, and
safe-write gates. Inspection, analysis, and hash selection remain read-only.
The hash chain is a semantic change detector and acceptance basis; it is not a
cryptographic signer, authenticated identity, append-only ledger, or proof
against a writer that can replace both source and commitments.

Tests may create disposable files and Git repositories solely as controlled
inputs. The acceptance never runs `git add`, `git commit`, `git tag`,
`git push`, npm publication, a GitHub mutation, or a dist-tag operation.

## 7. Verification

The acceptance gate is:

```sh
npm ci
node --test test/plan-assurance-*.test.mjs test/json-schema.test.mjs test/guide.test.mjs test/command-registry.test.mjs
npm run check:link
npm run check:package
npm run check
git diff --check
```

The complete gate passed on 2026-08-04 with these observed results:

- the focused plan-assurance, registry, Guide, and schema matrix passed all 89
  tests;
- the shared actuals and CLI regression matrix passed all 100 tests;
- the complete repository test run passed all 787 tests with no failures,
  skips, or cancellations;
- the English baseline checked 598 text files and exactly three allowlisted
  lines;
- documentation checks covered 152 Markdown files and seven normative PERT
  examples;
- read-only check, analyze, and next passed for all 30 self-use plans;
- the temporary-link workflow passed with `perttool 0.6.0`; and
- the isolated package workflow passed a 601-file, 656.1 kB tarball, including
  Contract 7 file-first and plan-assurance workflows.

The package operation was a `beta`-targeted dry-run only. It did not publish
or mutate a registry. `git diff --check` passed separately.
`npm ci` completed successfully but reported one high-severity dependency
audit finding. No automatic dependency or lockfile mutation was applied; a
future release decision must assess that report independently.

The task lifecycle was closed with one deterministic finish event at
`2026-08-04T16:17:19+09:00`. The completed pre-advance plan has source digest
`sha256:51dc8595b6e1306fd391c8c6da5990d9cc6e74ae30c279daecc15f5b565ea563`,
zero precedence and heuristic resource makespans, and no ready, recommended,
or startable task.

After the exact completed pre-advance snapshot is retained in Git, a
separately authorized canonical `dag advance` may contract the workstream to
reached `ASSURE_ACCEPTED`. Advance, release selection, publication, remote
writes, dist-tag movement, and Issue mutation remain independent decisions.
