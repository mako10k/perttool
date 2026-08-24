# Planning Pool Projection Core Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-24
- Accepted candidate parent: `4b6c3f1c8d81707176c7dfcf09d4b0392d1ae477`
- Plan: [`plans/planning-pool.pert`](../../plans/planning-pool.pert)
- Plan task: `PLANNING_POOL_PROJECTION_CORE`
- Normative contract: [Work-centered Planning Pool and Window Contract](../specs/planning-pool.md)
- Private capability: `perttool.planning-projection-core@1`
- Active public runtime: unchanged package `0.10.5`, Grammar 8, and CLI Contract 9

## 1. Decision

Accept the private portable Planning Pool projection Core. It composes one
normalized reshape operation that transfers selected Event and Activity
meaning into same-ID strict Milestone and Task declarations, updates every
associated Work in the same candidate, validates the complete final Grammar 9
strict DAG, and classifies draft and canonical destructive ranges separately.

The same Core also supports the narrow inverse deferral of one linked,
unstarted, evidence-free strict fragment back to same-ID Event and Activity
declarations. It retains strict boundary Milestones and rejects protected,
active, direct, or still-consumed strict meaning. Archive removes only an
already empty Work from the current source; no tombstone or historical record
is persisted in the canonical document.

Public Grammar 9 and CLI Contract 10 activation, governed persistence, Git
history proof, user-facing command composition, Window operations, release,
remote writes, Issue mutation, and plan advance remain separate.

## 2. Evidence chain

### C-POOL-PROJECTION-001 `high`, accepted

Claim: projection is one same-ID ownership transfer, not a semantic copy, and
therefore must update every associated Work and validate the final strict DAG
atomically.

Evidence:

- `E-POOL-PROJECTION-001`: `PPRJ-002` through `PPRJ-005` project one Event to
  one same-ID Milestone and one Activity to one same-ID Task, replace every
  association with a projection link, and reject incomplete affected-Work
  coverage.
- `E-POOL-PROJECTION-002`: the final candidate is reparsed and validated as a
  complete Grammar 9 document, including acyclicity and finish connectivity.
- `E-POOL-PROJECTION-003`: a root Event becomes a reached root Milestone only
  when no projected Activity enters it. The transfer invents no criterion,
  receipt, seal, completion, or outcome evidence.

Action:

- `A-POOL-PROJECTION-001`, implementation permitted, executed: add the closed
  project fragment, same-ID declaration transfer, global Work-link rewrite,
  exact transfer audit, and final strict-DAG validation.

### C-POOL-PROJECTION-002 `high`, accepted

Claim: deferral is safe only for an unstarted, evidence-free strict fragment
whose selected meaning has no retained strict consumer.

Evidence:

- `E-POOL-PROJECTION-004`: `PPRJ-010` through `PPRJ-012` transfer selected
  same-ID Task and internal Milestone declarations to Activity and Event while
  retaining boundary Milestones required by the residual strict graph.
- `E-POOL-PROJECTION-005`: `PPRJ-013` and `PPRJ-014` reject direct, started,
  accepted, evidence-bearing, protected, and retained-consumer selections with
  `PTPOOL-109`.
- `E-POOL-PROJECTION-006`: existing authoritative projection-link ownership
  cannot be silently reallocated between Work declarations.

Action:

- `A-POOL-PROJECTION-003`, implementation permitted, executed: add the narrow
  deferral fragment and fail-closed protected-evidence, lifecycle, boundary,
  consumer, and link-ownership checks.

### C-POOL-PROJECTION-003 `high`, accepted

Claim: the canonical source can remove Temporary Draft meaning without Git
proof, while canonical strict and Work removals remain distinguishable for a
later history-safe persistence owner.

Evidence:

- `E-POOL-PROJECTION-007`: `PPRJ-006` and `PPRJ-007` preserve the bounded
  residual-description reminder and classify Event and Activity removal as
  `temporary_draft`, separately from `canonical` strict or Work removal.
- `E-POOL-PROJECTION-008`: `PPRJ-008` and `PPRJ-009` archive only an already
  empty Work and reject residual descriptions or relationships.
- `E-POOL-PROJECTION-009`: neither projection nor archive adds a tombstone,
  durable operation log, or self-review record to the latest canonical source.

Action:

- `A-POOL-PROJECTION-004`, implementation permitted, executed: add exact
  destructive-range ownership and current-source archiveability while leaving
  canonical Git proof and safe writes to the later persistence composition.

### C-POOL-PROJECTION-004 `high`, accepted

Claim: the implementation reuses the accepted reshape preflight and token
binding without changing the public runtime.

Evidence:

- `E-POOL-PROJECTION-010`: `PPRJ-015` re-runs the normalized audit and binds
  the same source, request, preflight hash, candidate, expiry, and one-time
  opaque token before apply preparation.
- `E-POOL-PROJECTION-011`: `PPRJ-016` keeps projection modules outside the
  root, Core, Node, CLI, schema, LSP, VSIX, and MCP public facades.
- `E-POOL-PROJECTION-012`: the complete regression and installed-package
  gates retain package `0.10.5`, Grammar 8, CLI Contract 9, 56 commands, 23
  root schemas, 129 root exports, 129 Node exports, and 45 Core exports.

Action:

- `A-POOL-PROJECTION-002`, implementation permitted, executed: decompose the
  projection and deferral validation, transfer, and final-candidate assembly
  into bounded helpers so the accepted complexity ratchet remains unchanged.
- `A-POOL-PROJECTION-005`, implementation permitted, executed: extend only the
  private reshape request and implementation closure, and adjust the exact
  private-source inventory and current-plan assertions.

## 3. Accepted transfer model

The closed `strict_fragment` is either a `project` selection of Event and
Activity IDs or a `defer` selection of Task and Milestone IDs. Selection
arrays are normalized as sets. Existing fixed reshape vectors that use a null
fragment remain byte-identical.

Projection selects project-owned Event and Activity meaning rather than one
Work association. Every Work associated with the selected declaration is an
affected Work and changes to a same-ID projection link in the same candidate.
Activity endpoints must be existing or simultaneously projected strict
Milestones. A shared projected Task or Milestone has one strict owner and its
complete Work set is explicit through those links.

Event fields without a strict Milestone owner, including `source`, fail closed
instead of being lost. Activity fields transfer source-preservingly to Task.
The reverse Task transfer removes only strict lifecycle fields after the
eligibility proof; the reverse Milestone transfer rejects lifecycle,
acceptance, temporal, and finish evidence before removing its strict state.

Archive is a contraction of one Work that is already semantically empty in
the current source. It is not an instruction to discard residual Work meaning.

## 4. Accepted cases

The dependency-ordered matrix is
[`planning-pool-projection-core-v1.json`](../../test/fixtures/planning-pool-projection-core-v1.json).

| Cases | Accepted boundary |
| --- | --- |
| `PPRJ-001`–`PPRJ-005` | private identity, closed fragments, same-ID projection, global Work coverage, and complete strict DAG |
| `PPRJ-006`–`PPRJ-009` | residual assistance, destructive ownership, and empty-Work archiveability |
| `PPRJ-010`–`PPRJ-014` | narrow same-ID deferral, retained boundaries, and protected/evidence failure |
| `PPRJ-015`–`PPRJ-016` | normalized preflight/token reuse and unchanged public runtime |

The fixture SHA-256 is
`cd9e69c1c7bd243d1a7ff06560d292044fc828b01ed1a0bab8eb73fa1b319b57`.
The focused test SHA-256 is
`ec7106dc98fd0799e85e290a49ade1d66cfa4c581fadca3dbe29289479b5acdf`.
The duplicate and complexity baselines were not changed.

## 5. Verification

The accepted candidate passed:

- all eight focused test groups covering `PPRJ-001` through `PPRJ-016`;
- the projection, reshape, source, contract, and Core-dependency focused gate,
  44 tests in total;
- the complete 1,271-test repository regression gate;
- TypeScript checks for the package, LSP, VSIX, and MCP workspaces;
- pinned jscpd 5.0.15 and Lizard 1.23.0 ratchets without a baseline change;
- English-baseline checks over 1,212 text files and documentation checks over
  349 Markdown files and seven PERT examples;
- read-only self-use checks over 45 plans;
- isolated LSP, MCP, VSIX, temporary-link, and public-package workflows; and
- one 925-file, 3.1 MB package dry run plus isolated Contract 9 and plan-
  assurance installation checks.

## 6. Deferred boundaries

This acceptance does not activate a public projection command, schema, or
result identity. It does not perform governance, owner confirmation, Git
history proof, safe persistence, Window add/set/close, observation,
historical reconstruction, editor or MCP mutation, release selection,
publication, remote writes, Issue mutation, or plan advance.

The implementation task may be marked complete in its exact pre-advance plan.
Its conformant outcome, reached-milestone criterion and receipt, and canonical
advance each remain separately governed operations.
