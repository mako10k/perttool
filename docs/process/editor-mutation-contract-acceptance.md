# Tiered Editor Mutation Contract Acceptance

- Document status: Accepted 1.0
- Date: 2026-08-13
- Workstream: `EDITOR-MUTATION-001`
- Task: `EDITOR_MUTATION_CONTRACT`
- Plan: [../../plans/editor-mutations.pert](../../plans/editor-mutations.pert)
- Contract: [../specs/editor-mutations.md](../specs/editor-mutations.md)
- Machine cases:
  [../../test/fixtures/editor-mutation-contract-v1.json](../../test/fixtures/editor-mutation-contract-v1.json)

## 1. Accepted decision

The cross-tier editor mutation and Editor Protocol model 2 contract is
accepted. It makes the following decisions before runtime work:

- one complete final candidate receives the strictest applicable class in the
  closed order `E0 < E1 < E2 < E3`;
- `E0` requires complete semantic fingerprint equality and is the only class
  that may use standard whole-document formatting or user-enabled format on
  save;
- `E1` is limited to versioned repairs whose complete affected assurance
  closure is unsealed before and after the edit;
- `E2` requires an explicit preview and an independently proved exact inverse,
  not editor Undo alone;
- `E3` retains dedicated review, fresh candidate-bound governance and
  assurance authority, and exact advance repository/history evidence;
- the server plans bound edits and the editor applies them; neither adapter
  writes a workspace file directly; and
- Editor Protocol model 1 remains exact and active until a later task
  explicitly activates a model-2 capability.

`Perttool.EditorSemanticFingerprint.v1` is deliberately distinct from source
identity and plan-assurance hashes. Hash equality over a narrower assurance
projection cannot prove formatting equivalence for the complete document.

## 2. Normative trace

| Cases | Accepted evidence |
| --- | --- |
| `EMC-001` through `EMC-003` | exact model-1 baseline, additive negotiation, and URI/generation/version/source/candidate binding |
| `EMC-004` through `EMC-006` | complete semantic fingerprint, strictest-class selection, and fail-closed unknown handling |
| `EMC-007` through `EMC-009` | valid/idempotent E0 candidate, whole-document formatting only, and user-owned format-on-save setting |
| `EMC-010` through `EMC-012` | complete unsealed closure, guarded Quick Fix/Fix All behavior, and assurance/governance/history exclusions |
| `EMC-013` through `EMC-015` | exact inverse recovery, explicit E2 preview/application, and no destructive or E3 cause |
| `EMC-016` through `EMC-020` | assurance, governance, advance, dedicated-review, and fresh apply-time authority boundaries |
| `EMC-021` through `EMC-024` | editor application ownership, recovery failure, exact limits/diagnostics, and unchanged runtime/public surface |

The fixture owns 24 dependency-ordered cases, four classes, four capability
gates, two custom methods, six statuses, ten `PTEDM-*` diagnostics, nine exact
limits, and the contract-only activation state. The contract test checks those
inventories rather than inferring behavior from prose.

## 3. Compatibility and non-activation evidence

Direct runtime inspection established the contract snapshot:

| Surface | Result |
| --- | --- |
| active grammar | 7 |
| active CLI contract | 8 |
| command catalog | 53 |
| root schema catalog | 23 |
| root / Node / Core runtime exports | 129 / 129 / 45 |
| package version | `0.9.1` |
| current editor protocol selection | model 1 |
| `documentFormattingProvider` | absent |
| current server formatting handler | absent |

The focused test initializes the real private language server with an ordered
`[2, 1]` offer. The current server selects model 1, does not advertise
`documentFormattingProvider`, and exposes no formatting handler. The source,
package manifest, private adapter types, VSIX contributions, command and
schema catalogs, package exports, dependencies, release identity, and public
artifacts are unchanged by this contract task.

## 4. Artifact identity

| Artifact | UTF-8 bytes | SHA-256 |
| --- | ---: | --- |
| `docs/specs/editor-mutations.md` | 22,495 | `61722c8bb73da121adbaa1c72c038d93603d7d3e80dc61fe4dee737d9ce5c853` |
| `test/fixtures/editor-mutation-contract-v1.json` | 9,583 | `73aee76296956937cd117d59b69c2661915dc5453728af6f197c3fcb1b65212c` |
| `test/editor-mutation-contract.test.mjs` | 8,747 | `4d253be78761401136704c765ca36131dd636b658adc110a09b4089ad4b41d37` |
| completed pre-outcome `plans/editor-mutations.pert` | 18,559 | `1ec37bb4ed7af3b500eceb387ab46abc1ee1e924b463f7cb435e0daa72223941` |
| outcome-recorded `plans/editor-mutations.pert` | 18,838 | `e5ebb94a7c2c17040ef60da8035da30053d30cba0b727e6c44a8fc12b79436ca` |

The initial accepted and sealed plan source digest was
`sha256:04e671e4dab8147e2c05b10680226079c27b4c44712b65e8a7af0dc670f4c60a`.
One expected-digest `task finish --write` changed only
`EDITOR_MUTATION_CONTRACT` to `done`, producing the pre-outcome digest above.
The later separately confirmed outcome write produced the current digest. No
plan advance was performed.

## 5. Executed gates

The acceptance run includes:

- seven dedicated editor-mutation contract tests;
- the existing editor-protocol, adapter-architecture, governance,
  plan-assurance, advance-history, and Help/Guide consistency regressions;
- the complete Node.js 22 typecheck and 1,052-test repository gate;
- documentation and English-baseline checks;
- deterministic `document check`, `dag analyze`, and `dag next` over all 40
  self-use plans;
- private LSP, MCP, and VSIX package gates plus temporary-link and isolated
  public-package gates; and
- `git diff --check`.

The complete gate passed immediately before the separately confirmed outcome
write. Post-write readback, the dedicated contract test, the forty-plan
self-use shadow, documentation, English baseline, and `git diff --check` pass
on the outcome-recorded state. The acceptance creates no package, VSIX
installation, release, remote write, GitHub Issue mutation, or published
artifact.

## 6. Assurance and next boundary

Completing the task made its accepted outcome the next assurance boundary.
The exact assertion-free preview used outcome ID
`OUTCOME_EDITOR_MUTATION_CONTRACT`, status `conformant`, and reason
`Accepted tiered editor mutation contract and twenty-four closed cases`. It
binds accepted basis
`sha256:166d04cab88b3e00035c43305179b6a70ada31556ec5ef64175443a5470294b6`,
completed source digest
`sha256:1ec37bb4ed7af3b500eceb387ab46abc1ee1e924b463f7cb435e0daa72223941`,
and candidate digest
`sha256:e5ebb94a7c2c17040ef60da8035da30053d30cba0b727e6c44a8fc12b79436ca`.
It affects only `plan_assurance`, names `codex` as actor, and requires the
candidate-bound `user` owner assertion. The user separately confirmed that
exact candidate. It was written once with the same source digest, actor,
assertion, status, and reason; readback matches the candidate digest.

Complete assurance now has no unavailable task, mismatch, replan requirement,
or required action. `PTASSURE-203` is absent. Fresh complete NextResult v7
recommends only `EDITOR_FORMAT_CORE`, whose assurance state is `verified`.
The remaining `PTDAG-208` reports the reached contract milestone pending a
separately authorized advance. The next task may activate only E0
whole-document formatting. E1, E2, E3, semantic highlighting, MCP mutation,
public VSIX publication, release selection, remote writes, Issue mutation,
and plan advance remain separate.
