# Plan Review Request Contract

- Document status: Normative 1.0
- Date: 2026-09-10
- Source model: `plan_review_request` model 1
- Target grammar: 10
- Target CLI contract: 11
- Related issue: [GitHub Issue #21](https://github.com/mako10k/perttool/issues/21)
- Accepted requirement: [Plan Review Request Requirements v1](../requirements/plan-review-request-v1.2.md)
- Accepted decision: [ADR 0010](../adr/0010-separate-plan-review-from-plan-authority.md)

## 1. Purpose and authority

This contract defines a persistent request to review a plan when an observation
makes a current planning assumption questionable. It fixes source syntax,
semantic projection, authority, commands, result identities, diagnostics,
limits, lifecycle, migration, and compatibility for contract review.

The request is advisory evidence. It is not a plan mutation, assurance
mismatch, milestone acceptance result, recommendation override, start block,
or proof that its reason or locator is true.

This accepted contract is not active implementation authority. Grammar 9, CLI
Contract 10, and their current identities remain unchanged until a separately
accepted atomic implementation activates this complete contract.

## 2. Source model and syntax

### 2.1 Declaration

Grammar 10 adds this project-owned declaration:

```pert
plan_review_request PRR_001 TASK_A:
  model 1
  reason "Observed throughput no longer supports the planned duration"
  created_at 2026-09-10T15:30:00+09:00
  created_by codex
  locator "run:local-observation-42"
```

A resolved declaration retains the original fields and appends:

```pert
  outcome plan_changed
  resolved_at 2026-09-10T16:15:00+09:00
  resolved_by user
  resolution_reason "Split the downstream delivery window"
  reviewed_source_digest sha256:<64-lowercase-hex>
  change_request_digest sha256:<64-lowercase-hex>
  plan_basis_before sha256:<64-lowercase-hex>
  plan_basis_after sha256:<64-lowercase-hex>
```

The grammar fragment is:

```ebnf
PlanReviewRequestDecl = "plan_review_request", HSPACE, Identifier,
                        HSPACE, Identifier, ":", NEWLINE,
                        INDENT, PlanReviewRequestField,
                        { NEWLINE, PlanReviewRequestField }, DEDENT ;

PlanReviewRequestField = ModelField
                       | ReasonField
                       | CreatedAtField
                       | CreatedByField
                       | LocatorField
                       | OutcomeField
                       | ResolvedAtField
                       | ResolvedByField
                       | ResolutionReasonField
                       | ReviewedSourceDigestField
                       | ChangeRequestDigestField
                       | PlanBasisBeforeField
                       | PlanBasisAfterField ;

ModelField                = "model", HSPACE, "1" ;
ReasonField               = "reason", HSPACE, String ;
CreatedAtField            = "created_at", HSPACE, EventDateTimeV5 ;
CreatedByField            = "created_by", HSPACE, Identifier ;
LocatorField              = "locator", HSPACE, String ;
OutcomeField              = "outcome", HSPACE,
                            ( "plan_retained" | "plan_changed" ) ;
ResolvedAtField           = "resolved_at", HSPACE, EventDateTimeV5 ;
ResolvedByField           = "resolved_by", HSPACE, Identifier ;
ResolutionReasonField     = "resolution_reason", HSPACE, String ;
ReviewedSourceDigestField = "reviewed_source_digest", HSPACE, Sha256Digest ;
ChangeRequestDigestField   = "change_request_digest", HSPACE, Sha256Digest ;
PlanBasisBeforeField      = "plan_basis_before", HSPACE, Sha256Digest ;
PlanBasisAfterField       = "plan_basis_after", HSPACE, Sha256Digest ;
```

The header contains request ID then referenced Task ID. Request IDs share the
global document ID namespace. All keywords are contextual in these positions
and do not expand the Grammar 1 through 9 global reserved-ID set.

Canonical field order is the order above. `locator` follows `created_by` when
present. A new declaration is inserted after all Planning Pool declarations
and before the first `task_relation`, `plan_seal`, `task_outcome`,
`assurance_receipt`, `milestone_criterion_set`, `milestone_acceptance_receipt`,
or `work_event`. Multiple insertions use request-ID order.

### 2.2 Open and resolved records

An open record contains exactly `model`, `reason`, `created_at`, `created_by`,
and optional `locator`. A resolved record additionally contains exactly one of
these closed field sets:

| Outcome | Required additional fields | Forbidden fields |
| --- | --- | --- |
| `plan_retained` | `outcome`, `resolved_at`, `resolved_by`, `resolution_reason`, `reviewed_source_digest` | `plan_basis_before`, `plan_basis_after` |
| `plan_changed` | all resolution fields plus `change_request_digest`, `plan_basis_before`, `plan_basis_after` | none |

Every reason decodes to a non-empty string. Every date-time uses the existing
numeric-offset `EventDateTimeV5` lexical form; `Z` is not accepted. Every actor
uses `Identifier`. Digests use lowercase `sha256:` form. Unknown, duplicate,
or conditionally invalid fields fail validation.

Creation requires a current Task reference. A resolved Task reference is an
explicit historical reference and need not resolve to a current Task. An open
reference must always resolve in the final candidate.

## 3. Plan Review plan basis

### 3.1 Identity and canonicalization

The basis identity is `Perttool.PlanReviewBasis.v1`. Its digest is SHA-256 of
UTF-8 RFC 8785 JSON Canonicalization Scheme bytes for this closed object:

```ts
interface PlanReviewBasisV1 {
  readonly model_version: 1;
  readonly project: {
    readonly id: string;
    readonly finish_milestone_id: string;
    readonly duration_unit: string;
    readonly velocity: string | null;
    readonly target_duration: string | null;
    readonly critical_epsilon: string;
  };
  readonly calendars: readonly CanonicalCalendarPlanV8[];
  readonly resources: readonly CanonicalResourcePlanV8[];
  readonly milestones: readonly CanonicalMilestonePlanV8[];
  readonly tasks: readonly CanonicalTaskPlanV8[];
  readonly gates: readonly CanonicalGatePlanV8[];
  readonly assurance_relations: readonly CanonicalTaskRelationV1[];
  readonly planning_pool: CanonicalPlanningPoolPlanV1 | null;
}
```

The named canonical components reuse their owning accepted semantic models,
not source spelling. Arrays use declaration order except maps or sets already
defined by an owning contract as ID-sorted. Rational values use their reduced
exact string. Date-times use their canonical numeric-offset source value.

Included meaning is limited to:

- project outcome and quantitative planning settings;
- calendar schedules and resource availability;
- resource capacity and Task resource requirements;
- Milestone identity and planning constraints;
- Task identity, endpoints, description, estimate, duration, priority,
  requirements, planning owner, tags, source, finish target, and temporal
  constraints;
- Gate identity, endpoints, and reason;
- effective plan-assurance dependency relations, excluding seals, outcomes,
  and receipts; and
- Planning Pool Work, Event, Activity, Window, ordering, associations,
  dependencies, links, objectives, estimates, constraints, and planning
  assumptions.

Excluded meaning is:

- every Plan Review Request field;
- project title, version, and `as_of` presentation metadata;
- Task and Milestone lifecycle state, block reason, and all work events;
- observations and Git-derived execution evidence;
- plan seals, task outcomes, assurance receipts, milestone criteria,
  acceptance receipts, and migration baselines;
- governance owners, delegates, decisions, and caller assertions; and
- comments, whitespace, source spans, declaration location, Help, and Guide.

Any later change to an included or excluded semantic field requires a new
basis identity. Implementations must not approximate this projection with raw
source hashing.

### 3.2 Outcome checks

For `plan_retained`, basis before and after the complete candidate must be
equal and basis fields are absent from source and result.

For `plan_changed`, basis before and after must differ. The source stores both
digests. The mutation result independently recomputes both from the exact
original and complete final candidate and requires equality with the stored
values.

Digest inequality proves only that included plan meaning changed. The
resolving actor asserts that the change addresses the request and that the
result is suitable; the tool does not prove either assertion.

## 4. Derived review state

`PlanReviewProjectionV1` is:

```ts
interface PlanReviewProjectionV1 {
  readonly model_version: 1;
  readonly state: "clear" | "review_required";
  readonly open_request_ids: readonly string[];
  readonly required_actions: readonly ({
    readonly kind: "review_before_new_downstream_work";
    readonly request_ids: readonly string[];
  })[];
}
```

Request IDs use declaration order. State is `review_required` exactly when the
array is non-empty, with exactly one required action containing the same IDs.
Otherwise state is `clear` and `required_actions` is empty.

`dag next` text and JSON place this complete projection before recommendation.
Every v8 recommendation, temporal, assurance, acceptance, readiness,
`runnable_now`, ranking, and start-authority meaning remains unchanged.

## 5. Commands and mutation requests

CLI Contract 11 adds exactly four command paths:

```text
plan review-request <document> <request-id> <task-id>
  --reason <text> --created-at <date-time> --actor <principal>
  [--locator <text>]

plan review-list <document> [--state open|resolved|all]

plan review-show <document> <request-id>

plan review-resolve <document> <request-id>
  --outcome plan_retained|plan_changed
  --resolved-at <date-time> --actor <principal>
  --resolution-reason <text>
  [--accepted-owner <principal>]...
  [--request <json-path-or-stdin>]
```

Create and resolve also accept the standard `--preview`, `--diff`, `--output`,
`--in-place`, `--expected-digest`, and `--format text|json` groups. Preview is
the default. Exactly one of `--output` and `--in-place` selects persistence.
`--diff` is presentation only. Document and JSON request cannot both consume
stdin.

`--request` is forbidden for `plan_retained`. For `plan_changed` it is
required and contains one existing Contract 11 batch request whose operations
produce the non-Plan-Review plan mutation. It cannot contain another Plan
Review create or resolve operation. The complete candidate is composed once,
then validated and authorized once. There is no separate pre-resolution or
post-resolution write. The source record stores `change_request_digest`, the
SHA-256 digest of the normalized closed batch-request JSON after RFC 8785
canonicalization. It is replay identity, not plan-change or correctness proof.

The equivalent library request identities are
`Perttool.PlanReviewCreateRequest.v1` and
`Perttool.PlanReviewResolveRequest.v1`. Their JSON fields correspond exactly
to the CLI inputs and reject unknown fields.

## 6. Authority and atomic write

Creation requires a syntactically valid `actor`. It requires no owner
assertion and creates no governance affected scope.

Resolution evaluates `Perttool.PlanReviewAuthorityDecision.v1` against the
effective pre-change DAG owner and delegates:

```ts
interface PlanReviewAuthorityDecisionV1 {
  readonly model_version: 1;
  readonly request_id: string;
  readonly source_digest: string;
  readonly candidate_digest: string;
  readonly actor: string;
  readonly effective_dag_owner: string;
  readonly effective_dag_delegates: readonly string[];
  readonly actor_direct: boolean;
  readonly owner_confirmation_required: boolean;
  readonly owner_confirmation_satisfied: boolean;
  readonly authorized: boolean;
}
```

The exact rules match the existing owner/delegate comparison discipline: the
actor is direct when it equals the owner or a delegate; otherwise the exact
owner must appear in fresh candidate-bound `accepted_owner` assertions.
Assertions never authenticate an identity and are valid for this candidate
only.

This decision is not `Perttool.GovernanceDecision.v2`, creates no governance
affected scope, and emits no `PTGOV-*` diagnostic merely because resolution
needs authority.

A `plan_changed` candidate separately evaluates every existing governance,
plan-assurance, milestone-acceptance, history, and mutation guard produced by
its batch. Plan Review authority neither supplies nor waives them. One final
candidate is written only after all applicable decisions pass.

## 7. Result and schema identities

The atomic Contract 11 boundary adds these active root result schemas:

```text
Perttool.PlanReviewResult.v1
Perttool.PlanReviewMutationResult.v1
```

It replaces `Perttool.NextResult.v8` with `Perttool.NextResult.v9` in the
active schema catalog. It also exposes these public nested or request
identities without making them command-result roots:

```text
Perttool.PlanReviewRequestModel.v1
Perttool.PlanReviewBasis.v1
Perttool.PlanReviewProjection.v1
Perttool.PlanReviewAuthorityDecision.v1
Perttool.PlanReviewCreateRequest.v1
Perttool.PlanReviewResolveRequest.v1
```

`Perttool.PlanReviewResult.v1` owns list and show. Its closed fields are
`schema_version`, `cli_contract_version`, `tool_version`, `operation`, `ok`,
`document_id`, `source`, `query`, `projection`, `requests`, and `diagnostics`.
Each request includes all semantic source fields, derived state, whether its
Task reference is current or historical, and immutable source binding.

`Perttool.PlanReviewMutationResult.v1` owns create and resolve. Its closed
fields are `schema_version`, `cli_contract_version`, `tool_version`,
`operation`, `ok`, `document_id`, `source`, `request`, `request_before`,
`request_after`, `projection_before`, `projection_after`, `plan_basis`,
`plan_review_authority`, `composed_mutation`, `candidate`, `edits`, `diff`,
`write`, and `diagnostics`. `plan_review_authority` is null for create.
`composed_mutation` is non-null only for `plan_changed`. `plan_basis` contains
status `unchanged` with null digests for create and `plan_retained`, or status
`changed` with both digests for `plan_changed`.

All root and nested JSON objects are closed under Draft 2020-12 and reject
unknown fields. Contract 11 moves the current catalog from 29 to 31 active
root schemas: two additions plus one version replacement. The exact public
export counts must be frozen by implementation acceptance, not guessed here.

## 8. Idempotency and mismatch

Create is an idempotent no-op only when an existing request with the same ID
has the exact normalized Task ID, reason, created date-time, creator, and
locator. Any difference returns `PTREV-105`.

Resolve first checks whether the request is already resolved before building a
new candidate:

1. normalize the requested outcome, date-time, actor, reason, and supplied
   batch;
2. compare outcome, resolved date-time, resolver, resolution reason, and
   normalized batch identity with the stored record;
3. for `plan_changed`, normalize the supplied batch, recompute its
   `change_request_digest`, and compare it with the stored digest;
4. return an idempotent no-op only when every comparison succeeds; otherwise
   return `PTREV-105` without a candidate or write.

The replay short-circuits before applying the batch to the current later
source. It never evaluates a new resolution, updates stored evidence, or treats
a different but semantically plausible plan change as the same resolution.
The stored reviewed-source and basis digests remain evidence of the originally
accepted complete candidate; the normalized batch digest closes replay
identity without fetching historical bytes. Owner assertions are not replay
identity and are not reevaluated after the persisted resolution already proves
that the original authority decision succeeded.

## 9. Task removal, advance, and history

Any final candidate that removes or remove-and-add renames a Task referenced
by an open request must atomically resolve every such request as
`plan_changed`. Failure lists blocking request IDs in declaration order.

Resolved references remain valid historical references. Ordinary later
mutations preserve their declaration bytes unless the operation explicitly
changes an unrelated canonical formatting boundary already owned by that
operation; no command may target request deletion.

Canonical `dag advance` applies this exact rule:

- a request resolved in the input source and referencing a removed Task may be
  removed with that Task;
- a request open in the input source and resolved by this same candidate must
  remain in the final source even when its Task is removed; and
- any still-open reference to a removed Task blocks the candidate.

Removed pre-resolved request IDs appear in the advance result. Their complete
declaration ranges are destructive records and pass the existing exact HEAD,
stage-0 index, acceptance, assurance, governance, and history guards. This
model adds no external receipt and no ordinary delete command.

## 10. Diagnostics, exits, and limits

| Code | Severity | Meaning |
| --- | --- | --- |
| `PTREV-101` | error | invalid declaration, field, ID, date-time, digest, or conditional field set |
| `PTREV-102` | error | invalid current or historical Task reference |
| `PTREV-103` | error | request or free-text hard limit exceeded |
| `PTREV-104` | error | create or resolve request is invalid or incomplete |
| `PTREV-105` | error | duplicate ID, non-identical create, replay mismatch, or illegal second resolution |
| `PTREV-106` | error | Plan Review authority denied or stale |
| `PTREV-107` | error | retained/changed basis condition or stored digest binding failed |
| `PTREV-108` | error | Task removal or rename would orphan an open request |
| `PTREV-109` | error | composed plan mutation or independent guard did not succeed |
| `PTREV-110` | error | migration or Contract 11 compatibility is unavailable |

Domain failures exit 1. Usage remains exit 2, input or filesystem failure exit
3, optimistic-lock or race failure exit 5, and internal invariant or schema
failure exit 70. No error returns a partial candidate or writes source.

| Limit | Exact value |
| --- | ---: |
| source or candidate UTF-8 bytes | 8,388,608 |
| requests per document | 10,000 |
| UTF-8 bytes per reason or resolution reason | 16,384 |
| UTF-8 bytes per locator | 8,192 |
| composed batch request UTF-8 bytes | 8,388,608 |
| operations in one composed batch | 10,000 |
| request records returned by list | 10,000 |

Counts and byte limits are checked before allocation or candidate expansion.
List never silently truncates.

Reason, resolution reason, and locator are untrusted text. They never trigger
file, Git, network, shell, connector, or tool access.

## 11. Help, Guide, ordering, and determinism

The Contract 11 registry is the only source for the four commands, options,
usage, text Help, and JSON Help. The Guide adds topic `plan-review` and must
distinguish active-work continuation, bounded local safety action, new
downstream start, review, plan retention, plan change, Plan Assurance,
Milestone Outcome Acceptance, and mutation authority.

List order, open IDs, blocking IDs, removed IDs, authority delegates, edits,
diagnostics, and JSON fields are deterministic. Declaration order governs
request collections; delegate collections use the existing governance order;
diagnostics use source then code order. Preview, separate output, and in-place
write use one byte-identical final candidate.

## 12. Migration and compatibility

`document migrate --target-grammar 10` accepts a valid Grammar 9 document and
changes only its grammar version and migration-owned trivia. It creates no
request and changes no existing semantic projection. Older inputs use their
existing migration path to Grammar 9 first. There is no automatic downgrade.

Plan Review mutations require Grammar 10 and return `PTREV-110` for older
inputs. Read-only list and show also require Grammar 10 because older grammars
cannot contain the declaration.

CLI Contract 10 continues to return `Perttool.NextResult.v8`. CLI Contract 11
returns `Perttool.NextResult.v9` for every supported Grammar 1 through 10
input. On Grammar 1 through 9 input, the Plan Review projection is `clear`
with empty arrays and every v8 meaning remains identical.

The active Contract 11 command count moves from 71 to 75. LSP, VSIX, MCP
mutation, external Issue synchronization, notification, automatic request
creation, publication, and cross-document propagation are unchanged and out
of scope.

## 13. Closed acceptance cases

The implementation fixture must cover at least these exact cases:

1. create, identical create, conflicting create, and missing locator;
2. list/show open, resolved, and mixed requests in deterministic order;
3. two open requests, partial resolution, and last resolution;
4. direct owner, delegate, confirmed owner, wrong actor, and stale candidate;
5. `plan_retained` with equal basis and rejected basis change;
6. atomic `plan_changed` with unequal basis and every independent guard;
7. rejected lifecycle-only, evidence-only, governance-only, and
   Plan-Review-only changes for `plan_changed`;
8. exact `plan_changed` replay, normalized batch-digest mismatch, and every
   stored-evidence mismatch;
9. active, blocked, suspended, done, current, and historical Task references;
10. blocked open-reference removal and rename;
11. atomic resolution plus removal or rename with the final request retained;
12. later ordinary removal with resolved request preserved;
13. advance removal of a pre-resolved request with destructive history proof;
14. advance retention of a same-candidate newly resolved request;
15. invalid fields, limits, untrusted locator, output race, and no partial
    write;
16. Help, Guide, text/JSON parity, closed schemas, and package exports; and
17. Grammar 9 migration plus unchanged Grammar 1 through 9 Contract 11 Next
    behavior.

## 14. Review boundary

The decision owner accepted complete Candidate 1.0 on 2026-09-10. Acceptance
fixes this contract only. It does not authorize delivery-plan mutation,
implementation, commit, push, PR, release, publication, Issue mutation, or
canonical plan advance.
