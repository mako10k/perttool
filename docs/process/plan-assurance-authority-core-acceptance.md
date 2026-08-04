# Conditional Plan Assurance Authority Core Acceptance

- Status: Accepted internal Core
- Acceptance date: 2026-08-04
- Workstream task: `ASSURE_AUTHORITY_CORE`
- Interface: [Plan Assurance Interface Contract](../specs/plan-assurance-interface.md)
- Semantic contract: [Conditional Plan Assurance](../specs/plan-assurance.md)
- Implementation: `src/assurance/authority.ts`,
  `src/application/target-assurance-analysis.ts`, and
  `src/assurance/mutation.ts`
- Focused test: `test/plan-assurance-authority-core.test.mjs`
- Active public runtime: Grammar 5 and CLI Contract 6

## 1. Accepted slice

The internal assurance evaluator now feeds one pure projection shared by
assurance-aware check, analysis, Next authority, and mutation impact. The
projection retains model identities, coverage, complete per-task hash/state
and cause results, direct and inherited mismatch sets, the complete replan
closure, active-attention IDs, and typed required actions.

The Grammar 6 application adapter validates and projects source through the
identity-checked capability, computes the source digest, and returns the same
check, analysis, and Next assurance projection. Invalid Grammar 6 input
returns no authority projection. This adapter is internal and is not reachable
from the Contract 6 package root or CLI.

## 2. Authority composition

The accepted composition order is:

```text
raw Recommendation version 1 order
  -> recommendation_v1_plus_release_gate temporal authority
  -> recommendation_v1_plus_release_gate_plus_plan_assurance_v1
  -> startable recommended task IDs
```

The composer never reranks, promotes, or substitutes a task. It preserves the
raw recommended IDs and their order. Assurance-disabled `not_applicable`,
`conditional`, and `verified` tasks pass the assurance filter. `unsealed`,
`review_required`, and `unavailable` tasks remain visible in the raw priority
result but are absent from new-start authority. A separate verified branch
continues when another planning closure requires review.

The base recommendation interface, ranking algorithm, reason taxonomy,
explanation, expression, description registry, locale, and temporal policy
must have their accepted identities. The trace must be complete and
non-truncated, temporal-startable IDs must be unique members of the raw
recommended set, every such ID must have an assurance result, and enabled
model identities must be known. An unknown or incomplete input returns an
empty startable set with stable safe-stop reasons; it does not guess or fall
back to Contract 6 authority.

## 3. Actions, attention, and diagnostics

An all-unsealed enabled plan returns one `initial_seal` action over the
complete task set. A mismatch or later partial branch returns
`replan_and_reseal` with stable direct root IDs and the affected closure.
Missing, damaged, or unknown evidence returns
`restore_assurance_evidence`. These are control-plane projections and never
create an AoA task or accept a computed hash.

Only active tasks whose assurance is `review_required` or `unavailable` enter
`active_attention_required_task_ids`. No lifecycle state is suspended,
cancelled, or rewritten. Check projects deterministic task/outcome state
counts. The shared diagnostic projection emits aggregate `PTASSURE-201`
through `PTASSURE-204` warnings for partial coverage, mismatch, unavailable
evidence or authority, and active attention.

MutationResult v4's internal impact retains its accepted before/after evaluator
facts and additionally uses this shared projection for required actions,
active attention, and warnings. Candidate planning and accepted seals remain
owned by the mutation Core; authority composition is read-only.

## 4. Verification

Focused acceptance proves:

- assurance-disabled compatibility without a changed startable set;
- conditional and verified pass-through with unchanged raw ordering;
- affected-closure withholding while an unrelated verified branch proceeds;
- atomic initial-seal and replan/reseal action projection;
- unknown-model, incomplete-trace, unknown-policy, invalid-ID, and missing-task
  safe stops;
- active-attention reporting without lifecycle mutation;
- shared mutation-impact causes, actions, attention, and diagnostics;
- real Grammar 6 source analysis and Next parity;
- invalid Grammar 6 source returning no authority; and
- continued absence from the public Contract 6 package root.

The focused authority test passes eleven cases. After the task's finish
snapshot was written, `npm run check` passed 756 tests, the 570-file English
baseline check, 147 Markdown files, seven normative PERT examples, all 30
self-use plans, the temporary-link workflow, and the 540-file isolated-package
workflow. `git diff --check` also passed.

## 5. Remaining boundary

This slice does not activate Grammar 6, CLI Contract 7, AnalysisResult v5,
NextResult v6, schemas, registry paths, help, Guide, or package exports. It
does not implement the pinpoint hash command or assurance-aware advance
contraction. The current public recommendation implementation, temporal
authority policy, and every Contract 6 result remain unchanged. After the
finish event, fresh complete, non-truncated NextResult v5 recommends and
authorizes only `ASSURE_ADVANCE_CONTRACTION` for the ASSURE-001 workstream;
the raw runnable subset remains distinct from this start authority.

Plan advance, commit, release selection, remote writes, publication, dist-tag
movement, and Issue mutation remain separate authorization boundaries.
