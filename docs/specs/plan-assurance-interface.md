# Conditional Plan Assurance Interface Contract

- Status: Normative 1.0
- Decision date: 2026-08-03
- Source grammar target: Grammar 6
- Public CLI target: CLI Contract 7
- Plan-assurance model: 1
- Hash model: 1
- Runtime status: Grammar 6 and CLI Contract 7 active in the source CLI,
  package root, discovery, Guide/help, schemas, and installed workflows
- Semantic contract: [plan-assurance.md](plan-assurance.md)
- Historical compatibility baseline: Grammar 5, CLI Contract 6, and exact pin
  0.6.0
- Active package boundary: `beta=latest=0.7.1` after the separately authorized
  compatible patch publication and post-publication promotion; `0.7.0`
  remains the first Contract 7 and Grammar 6 pin
- Workstream: [../../plans/plan-assurance.pert](../../plans/plan-assurance.pert)

## 1. Decision and scope

Grammar 6 and CLI Contract 7 are the first atomic public boundary for
conditional plan assurance. Grammar 6 is a strict additive source superset of
Grammar 5. CLI Contract 7 changes the closed results that must project
assurance, adds one read-only assurance command and eight assurance mutations,
and retains every unrelated command spelling.

This contract selects and now governs the active source/runtime shape. Its
activation does not select a package version, authorize a release,
authenticate a caller, or claim that a hash is a digital signature.

Resolve conflicts in this order:

1. must requirements in `docs/requirements.md`;
2. the [Conditional Plan Assurance Contract](plan-assurance.md);
3. this interface contract;
4. the active [DSL Grammar](dsl-grammar.md), [Mutation](mutation.md),
   [Governance Interface](governance-interface.md), and
   [Recommendation Interface](recommendation-interface.md) contracts for
   unchanged behavior; and
5. basic design, examples, tests, help, and implementation.

## 2. Grammar 6 source contract

### 2.1 Enablement fields

Grammar 6 adds two project fields:

```pert
project SAMPLE:
  version 6
  plan_assurance_model 1
  plan_assurance_hash_model 1
```

The fields are optional as a pair. Their joint omission means
`coverage=not_enabled`. If either field is present, both are required. Model 1
requires both values to be `1`. A syntactically valid unknown positive integer
is preserved and projects assurance as `unavailable`; it is not evaluated by a
best-effort fallback.

Canonical project-field order places `plan_assurance_model` and
`plan_assurance_hash_model` immediately after `dag_delegates` and before
`critical_epsilon`. Existing declared field order remains source-preserved.

### 2.2 Relation record

The previously selected relation form is unchanged:

```pert
task_relation REL_A_B A -> B:
  mode planning_only
  reason "B uses A's findings but may start before A finishes"
```

`task_relation` declares a globally unique relation ID. Both endpoints resolve
only to current tasks. `mode` is exactly `both`, `execution_only`, or
`planning_only`. `reason` is required for the two non-default modes and
optional for `both`. Relation ID and reason are excluded from assurance hashes;
endpoints and effective mode are inputs.

### 2.3 Per-task accepted seal

One machine-managed `plan_seal` record stores the current accepted basis for a
task:

```pert
plan_seal B:
  accepted_contract sha256:ccafd4ffb6985b1d11cbb4c91a40e1d634027f73bab5e195d2d63e1179f1aacf
  accepted_basis sha256:17d1c255bdf3d1f913eb12264c16d64b1abaae4d17e88a224229f550a0830fb9
  accepted_inputs:
    A both sha256:3923becd976daeca7047a65206633ed3b8210b426f1bf969107728f5261cd489
  reason "Initial plan assurance seal"
```

The header identifier is a task reference, not a newly declared global ID.
Exactly one record may refer to a task. `accepted_contract`, `accepted_basis`,
and nonempty `reason` are required. `accepted_inputs` is required when the
accepted planning input set is nonempty and omitted for an empty set. Each
entry stores predecessor task ID, the accepted `both` or `planning_only` mode,
and its accepted assurance hash in predecessor-ID order. The accepted basis
must reproduce from the stored accepted contract and inputs.

The component snapshot is required because one opaque basis hash cannot
distinguish a task's own contract change from a relation change or an inherited
predecessor change. It permits complete direct and inherited causes without
storing old task prose. The reason is current human context, is excluded from
every hash, and is replaced when that task is resealed. Git retains prior
values.

### 2.4 Task outcome record

An outcome record has a stable global ID and one current task reference:

```pert
task_outcome OUT_A:
  model 1
  task A
  against_basis sha256:3923becd976daeca7047a65206633ed3b8210b426f1bf969107728f5261cd489
  status changed
  summary "The delivered API returns a different normalized record"
  reason "Acceptance found a deliberate contract difference"
```

Fields are `model`, `task`, `against_basis`, `status`, optional `summary`, and
`reason` in canonical order. `status` is `conformant` or `changed`. A nonempty
`reason` is always required. `summary` is required and nonempty for `changed`
and forbidden for `conformant`. At most one outcome record may refer to a task.

For a changed outcome, `TaskOutcomeCommitment.v1` hashes the decoded `summary`
as this closed contract:

```json
{"model":"Perttool.ChangedTaskOutcomeContract.v1","summary":"A delivered a versioned alternative"}
```

Its hash enters `TaskOutcomeCommitment.v1` as
`changed_outcome_contract_hash`, following the recurrence in the semantic
contract. The reason and record ID are excluded. The tool consumes the explicit
status; it never infers it from the prose.

### 2.5 Frontier receipt

Advance owns a machine-managed receipt:

```pert
assurance_receipt AR_A:
  model 1
  receipt_hash sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
  producer A
  producer_contract_hash sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
  producer_assurance_hash sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc
  outcome conformant
  source_milestone M1
  consumers:
    B both
    C planning_only
```

The receipt ID is globally unique. `producer` is a preserved historical task
identifier and does not resolve to a current declaration. Consumer identifiers
must resolve to distinct current tasks and are stored in task-ID order. Their
mode is only `both` or `planning_only`. `source_milestone` is optional and, if
present, is preserved as an identifier rather than required to resolve after
advance.

Advance generates one receipt per removed producer. Its preferred ID is
`AR_<producer-task-id>`. If that ID is already used by a retained globally
indexed declaration, advance selects the first unused ID in the exact sequence
`AR_<producer-task-id>_2`, `AR_<producer-task-id>_3`, and so on. IDs of
declarations removed by the same candidate do not cause a collision. The
generated receipt records the removed producer's destination milestone as
`source_milestone`; this is provenance only and is excluded from reference
resolution after contraction.

All displayed fields except `source_milestone` are required. `receipt_hash`
is computed over the canonical receipt object with `receipt_hash` omitted.
Receipt IDs are excluded from the receipt and task-basis hashes.

### 2.6 Grammar fragment and tokens

```ebnf
PlanAssuranceModelField = "plan_assurance_model", HSPACE, PositiveInteger ;
PlanAssuranceHashModelField = "plan_assurance_hash_model", HSPACE,
                              PositiveInteger ;

PlanSealDecl = "plan_seal", HSPACE, Identifier, ":", NEWLINE,
               INDENT, PlanSealField,
               { NEWLINE, PlanSealField }, DEDENT ;
PlanSealField = ( "accepted_contract", HSPACE, HashDigest )
              | ( "accepted_basis", HSPACE, HashDigest )
              | AcceptedInputsField
              | ( "reason", HSPACE, String ) ;
AcceptedInputsField = "accepted_inputs:", NEWLINE, INDENT,
                      AcceptedInput,
                      { NEWLINE, AcceptedInput }, DEDENT ;
AcceptedInput = Identifier, HSPACE, ( "both" | "planning_only" ),
                HSPACE, HashDigest ;

TaskOutcomeDecl = "task_outcome", HSPACE, Identifier, ":", NEWLINE,
                  INDENT, TaskOutcomeField,
                  { NEWLINE, TaskOutcomeField }, DEDENT ;
TaskOutcomeField = ( "model", HSPACE, PositiveInteger )
                 | ( "task", HSPACE, Identifier )
                 | ( "against_basis", HSPACE, HashDigest )
                 | ( "status", HSPACE, ( "conformant" | "changed" ) )
                 | ( "summary", HSPACE, String )
                 | ( "reason", HSPACE, String ) ;

AssuranceReceiptDecl = "assurance_receipt", HSPACE, Identifier, ":", NEWLINE,
                       INDENT, AssuranceReceiptField,
                       { NEWLINE, AssuranceReceiptField }, DEDENT ;
AssuranceReceiptField = ( "model", HSPACE, PositiveInteger )
                      | ( "receipt_hash", HSPACE, HashDigest )
                      | ( "producer", HSPACE, Identifier )
                      | ( "producer_contract_hash", HSPACE, HashDigest )
                      | ( "producer_assurance_hash", HSPACE, HashDigest )
                      | ( "outcome", HSPACE,
                          ( "conformant" | "changed" ) )
                      | ( "source_milestone", HSPACE, Identifier )
                      | AssuranceConsumersField ;
AssuranceConsumersField = "consumers:", NEWLINE, INDENT,
                          AssuranceConsumer,
                          { NEWLINE, AssuranceConsumer }, DEDENT ;
AssuranceConsumer = Identifier, HSPACE, ( "both" | "planning_only" ) ;

HashDigest = "sha256:", LowerHex64 ;
```

The existing `TaskRelationDecl` fragment in the semantic contract is also a
Grammar 6 top-level declaration. These words are contextual in their selected
positions and do not expand the Grammar 1 through 5 reserved-ID set.

### 2.7 Placement and source ownership

Canonical top-level insertion order after tasks and gates is:

1. `task_relation` by relation ID;
2. `plan_seal` by referenced task ID;
3. `task_outcome` by record ID;
4. `assurance_receipt` by record ID; and
5. `work_event` by existing event ownership rules.

A direct task or gate addition MUST insert before the first declaration in
that list. In particular, it MUST NOT append a new task after an existing
`plan_seal`, outcome, receipt, or work event merely because those records are
already present.

The identifier in a `plan_seal` header is the referenced task ID, not an
entity declaration that can shadow the task. Any task-specific mutation,
lifecycle operation, or editor identity lookup MUST resolve the pair
`(kind=task, id)` independently of declaration order. A valid source with a
same-ID task and seal remains valid and has two distinct source ranges. An
implementation may use a generic ID lookup only where the operation is
defined over the global non-seal entity namespace.

Formatting preserves existing declaration order, explicit `both` records,
comments, blank lines, BOM, and line endings. Removal owns the declaration and
its leading comment block under the existing rules. Advance additionally owns
the exact task-associated seal and outcome records it contracts or removes.

## 3. Source validity and assurance availability

- Any assurance record or project assurance field requires `project.version=6`.
- `task_relation`, `plan_seal`, `task_outcome`, and `assurance_receipt` require
  both project model fields to be present.
- Missing seals, unknown positive model values, inconsistent accepted seal
  components, stale outcome bases, and missing or self-hash-mismatched receipts
  are valid replanning inputs with assurance `unavailable` or `unsealed`; they
  do not suppress the graph needed to repair the plan.
- Invalid references, duplicate semantic relation pairs, duplicate task seal
  or outcome ownership, invalid conditional fields, malformed digests, and a
  planning cycle are document errors and expose no success candidate.
- A stored accepted basis that differs from recomputation is
  `review_required`, not a syntax or semantic-document error.

## 4. CLI Contract 7 commands

CLI Contract 7 retains all 34 Contract 6 command paths and adds these ten,
for 44 registered paths:

```text
perttool plan-assurance show <file>
  [--task <task-id>...]
perttool plan-assurance hash <file> <task-id>
  --kind contract|computed-basis|exported
perttool plan-assurance seal <file> --reason <text>
perttool plan-assurance reseal <file> --task <task-id>... --reason <text>

perttool plan-dependency add <file> <id> <predecessor> <successor>
  --mode both|execution-only|planning-only [--reason <text>]
perttool plan-dependency set <file> <id>
  [--predecessor <task-id>] [--successor <task-id>]
  [--mode both|execution-only|planning-only]
  [--reason <text> | --clear reason]
perttool plan-dependency remove <file> <id>

perttool task-outcome add <file> <id> <task-id>
  --status conformant|changed [--summary <text>] --reason <text>
perttool task-outcome set <file> <id>
  [--status conformant|changed] [--summary <text> | --clear summary]
  [--reason <text>] [--rebind-current-basis]
perttool task-outcome remove <file> <id>
```

All mutation commands receive the existing shared preview, write, output,
expected-digest, diagnostics, warning, actor, and owner-assertion groups.
`show` and `hash` are read-only and receive the read-only result and diagnostic
groups. `hash` does not receive write, actor, or owner-assertion options.

### 4.1 Inspection and pinpoint hash output

`show --task` is repeatable. Without it, `show` returns the complete assurance
projection; with it, the command returns only the named task results, while
retaining project coverage, full source identity, and causes that enter those
tasks. An unknown task is `PTASSURE-302`.

`hash` requires one task ID and one explicit `--kind`:

- `contract` selects the current task-plan contract hash;
- `computed-basis` selects the full current recursive basis; and
- `exported` selects the trustworthy commitment currently exported to planning
  consumers.

Successful text output is exactly one canonical lowercase
`sha256:<64 lowercase hexadecimal digits>` value followed by LF, with no label,
heading, color, warning, or other stdout text. JSON uses the same
`Perttool.PlanAssuranceResult.v1` root as `show`, with operation
`plan-assurance.hash`, source digest, task ID, kind, and selected hash. A missing
or unavailable selected value returns exit 1 with `PTASSURE-203` and no text
digest. The command uses the shared semantic projection and hash Core; it does
not parse raw task bytes independently.

Hash inspection is not seal acceptance. It does not add, replace, or repair a
`plan_seal`, does not authorize direct editing, and does not make a pasted
`accepted_basis` consistent with its required `accepted_contract` and
`accepted_inputs`. Formal acceptance still uses governed `seal` or `reseal`.

The internal implementation fixes the closed
`Perttool.PlanAssuranceResult.v1` root before public activation. Its common
fields are `schema_version`, `cli_contract_version`, `tool_version`,
`operation`, `ok`, `document_id`, `source`, `source_digest`, `diagnostics`,
`diagnostics_truncated`, `grammar_version`, `selected_task_ids`, `task_id`,
`kind`, `selected_hash`, and `assurance`. `operation` is exactly
`plan-assurance.show` or `plan-assurance.hash`. The last three selection fields
are null for `show`; `hash` sets all three except that `selected_hash` remains
null on failure. `assurance` is the existing closed
`PlanAssuranceProjectionV1` or null when no valid projection exists.

An omitted `show --task` filter returns every task result. A supplied filter is
deduplicated, and results retain evaluator task order rather than caller option
order. `selected_task_ids` uses that same evaluator order. The projection keeps
global model identities and coverage, intersects
task-ID aggregate sets and action affected sets with the selection, retains
the complete root set of each retained action, and retains every direct and
inherited cause on each selected task. It returns no unselected task result.
Any unknown selected task fails atomically with `PTASSURE-302` and no partial
projection.

`hash` uses the same one-task filtered projection, then reads only
`contract_hash`, `computed_basis_hash`, or `exported_assurance_hash` from that
task result. A null value produces one error-severity `PTASSURE-203` for that
task, keeps `selected_hash` null, and renders an empty text body. Parse,
validation, unknown-task, and unavailable failures also render an empty text
body. JSON remains complete for recovery. Inspection accepts no mutation,
governance, write, actor, owner-assertion, Git, clock, network, or raw-byte hash
input.

### 4.2 Seal and reseal

`plan-assurance seal` upgrades Grammar 1 through 5 to Grammar 6 when needed,
adds both model fields, and writes every current/future task seal with its
accepted contract, ordered planning inputs, and basis in one candidate. It
refuses a partial baseline. On an already enabled partial plan, it may fill
only missing initial seals when no accepted seal would be replaced;
replacement uses `reseal`.

`reseal --task` is repeatable and requires at least one task. The exact
selected set is recomputed in stable planning-topological order. A selected
task may consume an unresolved predecessor only when that predecessor is also
selected and becomes accepted earlier in the same candidate. Unselected
descendants retain their old seals and remain `review_required`. One nonempty
reason applies to every selected seal and satisfies the hash-only
reacceptance requirement.

No model-1 `disable` command exists. Removing assurance requires a separately
specified future migration and cannot be achieved by `project set --version`.

### 4.3 Outcomes

`task-outcome add` binds `against_basis` to the task's current equal accepted
and computed basis; callers do not type or approve a hash. `set` preserves the
stored basis unless `--rebind-current-basis` is present. Rebinding requires the
same current-basis precondition and a nonempty reason. `remove` makes any
completed producer that requires the record unavailable until corrected.

### 4.4 Atomic batch

Contract 7 batch request kinds are:

```text
plan_assurance.seal
plan_assurance.reseal
plan_dependency.add|set|remove
task_outcome.add|set|remove
```

They compose with existing mutations and validate only the complete final
candidate. This is the required route for an AoA dependency edit and relation
mode conversion that would be invalid in either intermediate document.

## 5. Public results and policy identities

The atomic cutover selects:

| Surface | Contract 7 identity |
| --- | --- |
| document check | `Perttool.CheckResult.v4` |
| project show | `Perttool.ProjectResult.v4` |
| dag analyze | `Perttool.AnalysisResult.v5` |
| dag next | `Perttool.NextResult.v6` |
| direct, lifecycle, batch, and assurance mutation | `Perttool.MutationResult.v4` |
| dag advance | `Perttool.AdvanceResult.v2` |
| plan-assurance show and hash | `Perttool.PlanAssuranceResult.v1` |
| nested persistent authority decision | `Perttool.GovernanceDecision.v2` |

All other result identities retain their Contract 6 versions. The schema
catalog has twenty root result identities plus shared local definitions. The
new root is `Perttool.PlanAssuranceResult.v1`; versioned replacements do not
remain active root identities. Exact old packages remain the compatibility
route for old closed results.

Every assurance-aware result uses one closed `PlanAssuranceProjectionV1` with:

```text
model_version
hash_model_version
coverage
task_results
direct_mismatch_task_ids
inherited_mismatch_task_ids
replan_required_task_ids
active_attention_required_task_ids
required_actions
```

Each `required_actions` item is a closed object with `kind`,
`root_task_ids`, and `affected_task_ids`. `kind` is exactly `initial_seal`,
`replan_and_reseal`, or `restore_assurance_evidence`; the semantic contract
defines their trigger conditions and exact table-order projection. An action
is advice for the control plane and is never write authority.

MutationResult v4 additionally has `assurance_impact`; AdvanceResult v2 has
`assurance_guard`; ProjectResult v4 exposes declared model fields; CheckResult
v4 exposes coverage and aggregate state counts; AnalysisResult v5 and
NextResult v6 expose the complete projection.

`assurance_guard` is a closed model-1 object with `status` equal to
`not_applicable`, `passed`, or `blocked`; a stable `cause`; sorted crossing
producer, created-receipt, updated-receipt, and removed-receipt ID sets; and
one task-ID-ordered retained-basis check containing the before hash, after
hash, and equality result. The causes are exactly `not_enabled`, `no_change`,
`basis_preserved`, `crossing_commitment_unavailable`,
`changed_outcome_not_accepted`, `retained_receipt_unavailable`, and
`retained_basis_changed`. A blocked guard makes the result unsuccessful and
cannot be changed by the history-loss force option.

NextResult v6 retains recommendation interface 1 and ranking algorithm 1. Its
start-authority policy is exactly:

```text
recommendation_v1_plus_release_gate_plus_plan_assurance_v1
```

Raw recommendation facts and order are unchanged. Only the authority
projection removes assurance-withheld IDs.

## 6. Governance, diagnostics, and exits

Governance semantics and interface version 2 add affected scope
`plan_assurance`. Governance source contract 1 and its owner fields remain
unchanged. The effective pre-change DAG owner and delegates control the new
scope. A candidate may also require `dag` or `goal`; every distinct required
owner is evaluated atomically.

Relation, model, seal, outcome, and receipt changes affect `plan_assurance`.
An assurance-aware advance affects `dag` and `plan_assurance`. An ordinary task
plan edit retains its existing governance classification, reports assurance
impact, and never updates seals.

Stable diagnostic families are:

| Code | Meaning |
| --- | --- |
| `PTASSURE-101` | invalid assurance source/reference/conditional-field combination |
| `PTASSURE-102` | effective planning-dependency cycle |
| `PTASSURE-201` | enabled task set is unsealed or partially sealed |
| `PTASSURE-202` | accepted and computed bases differ |
| `PTASSURE-203` | assurance unavailable because a model, outcome, or receipt cannot be used |
| `PTASSURE-204` | active task requires human attention |
| `PTASSURE-301` | invalid assurance mutation request |
| `PTASSURE-302` | assurance mutation target or uniqueness failure |
| `PTASSURE-303` | initial-seal precondition failure |
| `PTASSURE-304` | reseal set has unresolved planning input |
| `PTASSURE-305` | outcome add, correction, or rebind precondition failure |
| `PTASSURE-306` | advance cannot preserve every retained computed basis |

Codes 101, 102, and 301 through 306 are exit 1 domain failures. Codes 201
through 204 are warnings with stable aggregate task-ID data; existing
`--warnings-as-errors` returns exit 1 without removing a valid candidate.
Usage remains exit 2, I/O exit 3, optimistic/race conflict exit 5, and internal
invariant exit 70.

## 7. Compatibility and migration

- Grammar 1 through 5 parsing and source meaning remain unchanged.
- Grammar 6 without assurance fields is `not_enabled`.
- `plan-assurance seal` is the only model-1 enablement migration and is atomic.
- Generic format, unit migration, project metadata, history, and batch paths
  preserve every Grammar 6 assurance record byte-semantically.
- Lossless Mermaid support uses semantic profile 2. Profile 1 and plain
  Mermaid cannot claim lossless Grammar 6 assurance; strict loss rejects the
  artifact, while non-strict loss enumerates every omitted assurance fact.
- No adapter infers seals, outcomes, or receipts from Git or status.
- Published package 0.6.0 remains unchanged; exact old-package pins are the
  closed Contract 6 result compatibility route.

The internal compatibility implementation fixes these additional rules before
public activation:

1. A generic source operation first validates the complete Grammar 6 document.
   Formatter output may canonicalize supported source spelling, but its
   semantic assurance projection and hashes must be identical. Unit migration,
   project metadata mutation, and unrelated mixed-batch edits preserve the raw
   project assurance fields and every `task_relation`, `plan_seal`,
   `task_outcome`, and `assurance_receipt` declaration byte-for-byte.
2. Unit migration retains declared version 6. It converts only the existing
   unit-migration duration inventory plus `project.duration_unit` and an
   explicitly required `project.velocity`; it validates the final candidate
   with the identity-checked Grammar 6 capability.
3. Project metadata projects both assurance model identities explicitly.
   Project history accepts validated Grammar 1 through 6 snapshots but reduces
   only task/work-event actuals. It does not include assurance acceptance in an
   actuals result and does not derive assurance from Git.
4. Semantic Mermaid profile 2 contains a digest-bound canonical Grammar 6
   carrier and deterministic graph projection. Import validates the carrier,
   its digest, the complete Grammar 6 semantics, and exact artifact
   reproduction. Profile 1 and plain projections are output only under an
   explicit non-strict loss option and produce one stable loss record for each
   omitted assurance project field and assurance-owned declaration.
5. Compatibility modules remain internally capability-bound, while the
   standard package root and Contract 7 discovery surfaces expose only the
   accepted public names, result versions, and option spellings.
6. Direct-edit guidance leads with semantic fields and affected tasks. A
   pinpoint digest is supplemental inspection evidence: it never edits a
   `plan_seal`, repairs a receipt, accepts a plan, or authorizes reseal/write.

## 8. Help, schema, and activation gate

The structured registry is the only source for all 44 paths, options, usage,
text help, and JSON help. The Guide adds plan-assurance concepts, verify/seal,
replanning/reseal, outcomes, dependency modes, advance receipts, and the
non-signature trust boundary. JSON schemas close every object and validate
real success, mismatch, unavailable, denied, invalid, and usage results.

The completed `ASSURE_PUBLIC_CONTRACT` cutover activates the standard parser,
package root, 44-command registry, help, 20-root schema catalog, CLI,
temporary link, and installed package together. No public surface may expose a
mixed Grammar 5/Contract 6 and Grammar 6/Contract 7 identity set.

## 9. Fixed hash vectors

The interface fixture fixes ASCII canonical vectors for one root task A and
one default-`both` successor B. Their accepted values are:

```text
C(A) = sha256:e35fe89aabf48b47a19c513e63a7782591e8bf098f79a6b3ad789f905ef3cf2d
B(A) = sha256:3923becd976daeca7047a65206633ed3b8210b426f1bf969107728f5261cd489
C(B) = sha256:ccafd4ffb6985b1d11cbb4c91a40e1d634027f73bab5e195d2d63e1179f1aacf
B(B) = sha256:17d1c255bdf3d1f913eb12264c16d64b1abaae4d17e88a224229f550a0830fb9
O(A) = sha256:0b67ac9b301e58d8d9ace9e5bf4d7034fdec47890fa8422a0473bb3a182ec3a0
A'(A) = sha256:3a6a1f163198f68fec99b00dcfcb4dcf584dc864f7c0256faaf08fcad990a889
```

`O(A)` is the changed-outcome contract hash and `A'(A)` is the exported changed
outcome commitment. The fixture contains all six exact canonical UTF-8 strings.
An implementation must reproduce them without using raw source bytes or binary
floating point.

## 10. Non-goals and separate decisions

- authenticated signatures, key management, or an external trust root;
- a permanent ledger or complete historical plans in current source;
- automatic replanning, resealing, suspension, cancellation, or rollback;
- public cross-project or macro/detail assurance composition; the future
  semantic draft in [Task Refinement and Assurance
  Boundaries](task-refinement.md) does not add an active interface;
- model-1 disable or downgrade;
- package version selection, release plan, Git push, GitHub mutation, npm
  publication, dist-tag movement, or Issue mutation.
