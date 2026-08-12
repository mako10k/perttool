# Milestone Outcome Acceptance Contract

- Status: Normative target 1.0
- Milestone-acceptance model version: 1
- Target grammar: Grammar 7
- Target CLI contract: Contract 8
- Requirements: [../requirements.md](../requirements.md)
- Backlog: [`MILESTONE-ACCEPT-001`](../backlog.md#milestone-accept-001-separate-graph-closure-from-milestone-outcome-acceptance)
- Plan: [`plans/milestone-acceptance.pert`](../../plans/milestone-acceptance.pert)

## 1. Purpose

AoA closure proves that every incoming dependency of a milestone is satisfied.
It does not prove that the outcome named by that milestone meets behavioral,
artifact, command, test, observation, or owner-review requirements.

Model 1 adds a separately declared milestone criterion set and exact evidence
receipts. Closure remains a graph fact. Acceptance becomes a distinct outcome
fact and a fail-closed precondition for Contract 8 canonical advance.

## 2. Normative boundaries

The applicable order is:

1. requirements in `docs/requirements.md`;
2. this contract;
3. closure and canonical contraction in [Graph Semantics](graph-semantics.md);
4. source edits in [Mutation Semantics](mutation.md);
5. pre-change DAG authority in [Governance Authority](governance-authority.md)
   and [Governance Interface](governance-interface.md);
6. task-only conditional assurance in [Plan Assurance](plan-assurance.md);
7. destructive Git proof in [Advance History Safety](advance-history-safety.md);
8. checkpoint reconstruction in [Historical DAG](historical-dag.md); and
9. safe persistence in [CLI Interface](interfaces.md).

Model 1 does not add authentication, signatures, trusted time, an external
verification service, partial advance, or downstream task-plan invalidation.
Release selection, publication, remote writes, Issue mutation, and plan
advance remain separate decisions.

## 3. Separate state axes

The effective-reached set `R*` remains the least fixed point defined by Graph
Semantics. One closure computation can derive several milestones, but each
milestone enters `R*` only after all its own incoming edges are satisfied.

For each milestone, the acceptance evaluator returns:

```text
closure       unreached | reached
acceptance    not_declared | pending | accepted | failed | unavailable
```

Explicit `state reached` remains a graph assertion. It is never evidence that
the named outcome was accepted.

## 4. Criterion-set revision

One milestone owns zero or one current criterion-set revision:

```ts
interface MilestoneCriterionSetV1 {
  readonly milestoneId: string;
  readonly revisionId: string;
  readonly commitment: `sha256:${string}`;
  readonly criteria: readonly MilestoneCriterionV1[];
}

interface MilestoneCriterionV1 {
  readonly criterionId: string;
  readonly description: string;
  readonly required: boolean;
  readonly evidenceKind: "test" | "command" | "artifact" | "observation" | "owner";
}
```

Criterion IDs are unique within one milestone and stable only within the exact
set revision. A declared set is non-empty and contains at least one required
criterion. Optional-only and empty declared sets are invalid. Absence is the
single `not_declared` representation.

The commitment is a domain-separated SHA-256 digest over the milestone ID,
revision ID, and canonical ordered criterion semantics. It excludes receipts,
status, source trivia, timestamps, and the commitment itself.

Replacing one criterion replaces the complete set. The same atomic candidate
removes the old revision and every receipt it owns from current source. No
criterion ID, receipt, waiver, or acceptance state continues implicitly, even
when text or IDs are reused. Git retains the exact prior snapshot.

## 5. Receipts and evaluation

Every receipt has a globally unique stable receipt ID and binds the exact set
revision, set commitment, criterion ID, and criterion commitment.

Verification receipts additionally bind:

- one evidence kind equal to the criterion kind;
- one non-empty evidence reference;
- one Git revision, artifact digest, or explicit `none` where the evidence
  kind has no revision identity;
- a caller-asserted verifier principal; and
- a caller-asserted UTC timestamp in strict ISO `Z` form.

The CLI does not read a clock to validate truth, order receipts by time, or
give a newer assertion precedence. These fields are provenance, not
authentication. Exact replay of a complete receipt identity is idempotent.
Conflicting reuse fails closed.

The closed receipt actions are:

```text
verify | fail | unavailable | revoke | waive
```

`revoke` names the exact prior receipt it revokes. A waiver is permitted only
for one required criterion and carries a non-empty reason. It is bound to the
same revision and commitment as evidence receipts.

For one criterion, at most one unrevoked terminal receipt may exist. Adding a
different terminal receipt requires an explicit revocation of the exact prior
receipt in the same or an earlier atomic candidate. Multiple unrevoked terminal
receipts fail validation instead of deriving authority from declaration or
timestamp order. An unrevoked terminal `verify` means `satisfied`; `fail` means
`failed`; `unavailable` means `unavailable`; an owner-authorized `waive` means
`waived`; and no terminal fact means `pending`. A revocation removes only its
named receipt from effective evaluation and cannot revive a different
superseded receipt implicitly.

Required criteria determine milestone acceptance:

| Required states | Milestone acceptance |
| --- | --- |
| every criterion is `satisfied` or `waived` | `accepted` |
| any criterion is `failed` | `failed` |
| otherwise, any criterion is `unavailable` | `unavailable` |
| otherwise | `pending` |

Optional states remain visible but never block acceptance or appear in the
blocking-ID list. Blocking required IDs use criterion declaration order.

## 6. Governance and mutation

The complete criterion-set replacement and every `verify`, `fail`,
`unavailable`, `revoke`, and `waive` write affect the existing `dag` scope.
They use the pre-change effective `dag_owner` and delegates. Preview returns
the complete candidate and decision without requiring owner confirmation;
persistence fails closed under the existing candidate-bound rules.

`actor`, `verifier`, and `accepted_by_owner` are distinct caller assertions.
None is authenticated. Model 1 adds no milestone-acceptance owner role.

The target preview-first command families are:

```text
milestone acceptance replace
milestone acceptance verify
milestone acceptance fail
milestone acceptance unavailable
milestone acceptance revoke
milestone acceptance waive
milestone acceptance show
```

These are the exact command paths. Grammar migration uses the exact path
`document migrate --target-grammar 7`. Routine writes must not require direct
PERT editing.

Contract 8 has 53 commands and 23 root schemas. It replaces the active result
identities as follows while retaining every unrelated identity:

| Surface | Contract 8 result identity |
| --- | --- |
| document check | `Perttool.CheckResult.v5` |
| analysis | `Perttool.AnalysisResult.v6` |
| Next | `Perttool.NextResult.v7` |
| acceptance mutations | `Perttool.MutationResult.v5` |
| canonical advance | `Perttool.AdvanceResult.v3` |
| migration | `Perttool.MilestoneAcceptanceMigrationResult.v1` |
| acceptance show | `Perttool.MilestoneAcceptanceResult.v1` |

The source record identities are exactly `milestone_criterion_set`,
`milestone_acceptance_receipt`, and `milestone_acceptance_migration`. Their
closed fields implement Sections 4, 5, and 7; no alias spelling is accepted.

Canonical source order places criterion-set declarations before their owned
verification, failure, unavailable, revocation, and waiver receipts. Existing
record owners retain source-preserving relative order outside that block.

## 7. Grammar migration and grandfathering

Grammar 1 through 6 remain readable for `document check`, analysis, and
migration. Contract 8 acceptance mutations and `dag advance` require Grammar
7 and return a migration-required diagnostic for older documents.

Migration is preparation only. It creates no criterion, evidence, waiver, or
accepted state and infers none from titles, descriptions, task state, tests,
Git history, plan-assurance records, or work events.

A changed in-place migration requires:

1. a regular on-disk repository-relative target;
2. current bytes equal to the target blob in `HEAD`;
3. a stage-0 index equal to that `HEAD` blob;
4. a captured repository, path, object format, `HEAD`, blob, raw source digest,
   and candidate digest; and
5. rechecks of source, `HEAD`, and stage-0 index before atomic persistence.

The candidate writes one compact versioned migration baseline record binding
that evidence and the exact sorted IDs stored as `state reached` in the
pre-migration source. Only that closed set is grandfathered. Later direct
state changes create no exemption. Preview and separate output return the
candidate and proof requirements but do not claim a durable grandfather
baseline without an eligible committed in-place source.

The baseline's `candidate_digest` is the domain-separated semantic digest of
the complete migration inputs and sorted grandfather set. It is not a
self-referential raw-byte digest of a record containing that same field. The
ordinary mutation result separately carries the raw final-candidate digest.

`document check` succeeds with a non-blocking diagnostic for each
non-grandfathered milestone with no declared criterion set and points to the
criterion replacement workflow. Existing `--warnings-as-errors` may reject
that check.

## 8. Acceptance-aware canonical advance

Advance uses these phases:

1. validate source and request;
2. create a pure provisional advance plan, affected milestone set, candidate,
   diff, edits, and destructive records without Git inspection;
3. evaluate acceptance for every non-grandfathered closure-derived milestone
   that the provisional plan would remove or make explicitly reached;
4. if blocked, return the provisional candidate, diff, acceptance guard, and
   blocking criterion IDs as explanatory non-persistable output;
5. if passed, promote that exact provisional plan to the canonical candidate;
6. apply plan-assurance, governance, warning, history-safety, race, expected-
   digest, symlink, atomic-write, and post-write controls in their existing
   order.

One blocked affected milestone blocks the entire advance. Partial advance
does not exist. `--force-history-loss` bypasses only its existing Git
recoverability assessment and cannot bypass acceptance. A waiver is the only
criterion-specific owner decision that can satisfy an otherwise unmet
required criterion.

History safety remains an orthogonal Git guard and is not invoked for an
acceptance-blocked preview or persistence request.

## 9. Analysis, Next, and assurance

One pure Domain evaluator owns criterion and milestone acceptance semantics.
Analysis, Next, mutation, and advance Application services consume that
projection. Text, JSON, LSP, VSIX, and MCP adapters do not recompute it.

Analysis and Next expose closure, acceptance, required and optional states,
blocking IDs, and receipt provenance separately. Acceptance does not change
task readiness from graph closure. It restricts only Contract 8 canonical
advance in model 1.

Milestone criterion commitments are excluded from task-plan assurance hashes,
seals, and downstream start authority in model 1. Criterion replacement resets
only milestone acceptance. A future assurance model may add an explicit
planning dependency, but this contract does not do so.

## 10. Public and adapter boundary

Grammar 7 and Contract 8 atomically activate parser, validator, formatter,
source spans, migration, evaluator, mutations, advance, closed results,
schemas, diagnostics, Help, Guide, public exports, package inventory,
temporary-link behavior, and isolated installed behavior.

The selected adapter slice is read-only. LSP, VSIX, and MCP may project
closure, acceptance, criteria, blockers, provenance, and source navigation
from the Application result. They add no acceptance mutation, external
verification, semantic inference, editor write, or public extension release.

## 11. Historical reconstruction

Historical reconstruction chooses the parser, evaluator, and canonical
advance planner compatible with each exact checkpoint. Contract 7 and older
checkpoints have no milestone-acceptance projection and must not be rewritten
as accepted or rejected.

Grammar 7 criterion-set replacements form distinct source epochs. Deleted
revisions and receipts are visible only from Git checkpoints. A historical
canonical-advance proof compares the exact acceptance-aware candidate valid at
that checkpoint. Gaps, missing baselines, shallow history, ambiguous identity,
or incompatible contracts fail closed without granting current authority.

`Perttool.HistoricalMilestoneAcceptanceModel.v1` is the single bounded model
embedded in `Perttool.HistoricalGraphResult.v1`. Each first-parent checkpoint
reports its Grammar version, exact acceptance records and source ranges, one
shared evaluator projection, and `not_applicable`, `available`, or
`unavailable` status. Contract 7 and older checkpoints are always
`not_applicable`; they never inherit the endpoint's Contract 8 meaning.

The first Grammar 7 checkpoint must carry one migration baseline whose opaque
repository, relative path, object format, `HEAD`, blob, and raw source digest
match an inspected pre-migration checkpoint. A missing lower boundary,
provenance mismatch, later contract regression, unsupported Grammar, invalid
source, or hard-limit breach makes the milestone-acceptance history
incomplete. SHA-1 and SHA-256 object identities remain opaque and exact.
The baseline may leave current source only when an exact canonical-advance
proof retires its record; later checkpoints then use the retained Git
lineage, rather than inventing a new grandfather set.

A canonical proof exists only when the planner valid at the earlier checkpoint
returns the later source byte-for-byte after its acceptance guard passes. The
proof records affected, grandfathered, accepted, and removed acceptance-record
identities. An explanatory blocked candidate is not historical authority.
`dag history` exposes this model in JSON as
`milestone_acceptance_history` and in text as `ACCEPTANCE_CHECKPOINT` and
`ACCEPTANCE_ADVANCE` lines without adding a write or current authority.

## 12. Diagnostics and acceptance

Contract 8 assigns these stable diagnostics:

| Code | Meaning |
| --- | --- |
| `PTMAC-101` | Grammar 7 migration is required for the requested mutation or advance. |
| `PTMAC-102` | A non-grandfathered milestone has no declared criterion set. |
| `PTMAC-103` | A criterion set is empty, optional-only, or otherwise structurally invalid. |
| `PTMAC-104` | A criterion or receipt identity is duplicated or conflicts with an existing identity. |
| `PTMAC-105` | A receipt revision, set commitment, criterion ID, or criterion commitment does not match. |
| `PTMAC-106` | A verifier time, evidence kind, evidence reference, or evidence revision is invalid. |
| `PTMAC-107` | DAG-owner confirmation is required or does not authorize persistence. |
| `PTMAC-108` | Canonical advance is blocked by milestone acceptance. |
| `PTMAC-109` | Migration repository, `HEAD`, blob, stage-0 index, or source proof is unavailable. |
| `PTMAC-110` | A captured migration proof or source binding raced before persistence. |

`PTMAC-102` is the non-blocking `document check` warning described in Section
7. `PTMAC-101`, `PTMAC-103` through `PTMAC-109` are domain failures with exit
1. `PTMAC-110` is a stale/race failure with exit 5. CLI grammar and option
misuse remains `PTCLI-001` with exit 2.

The dependency-ordered machine cases are
[`milestone-acceptance-contract-v1.json`](../../test/fixtures/milestone-acceptance-contract-v1.json).
They fix semantics without claiming runtime implementation.

## 13. Non-goals

Model 1 does not provide:

- authenticated principals, signatures, certificates, trusted timestamps, or
  malicious-caller resistance;
- network evidence collection or external service dependency;
- inference from prose, task completion, Git, tests, work events, or plan
  assurance;
- optional-only criterion sets;
- implicit receipt continuation or current-source inactive history;
- partial advance or a general acceptance force option;
- downstream task-plan invalidation;
- editor or MCP mutation;
- release, publication, remote, Issue, or plan-advance authority.
