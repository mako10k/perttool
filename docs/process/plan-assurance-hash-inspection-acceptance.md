# Conditional Plan Assurance Hash Inspection Acceptance

- Status: Accepted internal read-only inspection Core
- Acceptance date: 2026-08-04
- Workstream task: `ASSURE_HASH_INSPECTION`
- Interface: [Plan Assurance Interface Contract](../specs/plan-assurance-interface.md)
- Semantic contract: [Conditional Plan Assurance](../specs/plan-assurance.md)
- Implementation: `src/application/target-assurance-inspection.ts`
- Focused test: `test/plan-assurance-hash-inspection.test.mjs`
- Active public runtime: Grammar 5 and CLI Contract 6

## 1. Accepted slice

The internal read-only application service validates complete Grammar 6 input
through the identity-checked target capability and reuses the shared assurance
source projection and topological evaluator. It does not independently hash
task source bytes. Both operations bind their result to the raw source digest,
document ID, grammar version, and the closed
`Perttool.PlanAssuranceResult.v1` identity selected by CLI Contract 7.

`plan-assurance.show` returns either the complete evaluator-ordered task set or
one filtered projection. Repeated task selectors are deduplicated into evaluator
order. A filtered result intersects aggregate and action affected-task sets,
retains each applicable action's complete root set, and keeps all direct and
inherited causes entering each selected task. Any unknown task fails the whole
request with `PTASSURE-302`; it never exposes a misleading partial projection.

## 2. Pinpoint hash selection

`plan-assurance.hash` requires exactly one task and one explicit kind. The
mapping is closed:

| Kind | Evaluator field |
| --- | --- |
| `contract` | `contract_hash` |
| `computed-basis` | `computed_basis_hash` |
| `exported` | `exported_assurance_hash` |

Successful text rendering is exactly one lowercase `sha256:` digest followed
by LF. It has no label, heading, color, warning, or other standard-output byte,
so a coding agent can copy only the semantic digest needed for a pinpoint
manual repair. JSON retains the complete source-bound result and selected
one-task projection.

If the selected evaluator value is unavailable, the result fails with one
error-severity `PTASSURE-203`, keeps `selected_hash` null, and renders no text
bytes. Parse, validation, unknown-task, and malformed normalized-request
boundaries also fail closed. A low diagnostic limit preserves the inspection
error instead of allowing an unrelated warning to hide it.

## 3. Non-authority and public boundary

Inspection accepts no mutation, governance, write, actor, owner-assertion, Git,
clock, network, or raw-byte hash input. A returned digest does not add, replace,
repair, or accept a seal or receipt; it does not authorize direct editing or a
later reseal candidate. Formal plan acceptance remains a separately governed
`seal` or `reseal` mutation.

The module and its declarations compile into the isolated package inventory so
the future public adapter can consume one tested Core. They remain absent from
`src/index.ts`, the Contract 6 registry, CLI dispatch, help, Guide, schemas, and
the installed public workflow. The atomic Grammar 6 and CLI Contract 7 cutover
remains owned by `ASSURE_PUBLIC_CONTRACT`.

## 4. Verification

Focused acceptance proves:

- the internal-only Contract 7 identity and unchanged active package root;
- complete and filtered source-bound show projections;
- selector deduplication and stable evaluator order;
- preservation of incoming cause roots and required actions;
- atomic unknown-task failure with `PTASSURE-302`;
- all three selectors against the fixed A/B SHA-256 vectors;
- semantic hash stability across BOM, CRLF, and lexical trivia changes;
- `PTASSURE-203` and zero text bytes for an unavailable exported hash;
- closed, deterministic JSON projection and scalar text rendering;
- invalid Grammar 6 suppression; and
- normalized request refusal before evaluation.

The focused inspection test passes eleven cases. The related assurance and
active Contract 6 regression set passes 105 cases, and the complete Node.js
test suite passes 783 cases. `npm run check` passes the 581-file English
baseline check, 150 Markdown files, seven normative PERT examples, all 30
self-use plans, the temporary-link workflow, and the 560-file isolated-package
workflow with the required internal inspection artifacts. `git diff --check`
also passes.

## 5. Remaining boundary

This slice does not activate Grammar 6, CLI Contract 7, public assurance
commands or result schemas, help, Guide, package-root exports, or installed
behavior. It does not seal, reseal, replan, edit, persist, or advance a plan.
Current Grammar 5, CLI Contract 6, package `0.6.0`, and every active public
result remain unchanged.

After the finish event, fresh complete, non-truncated NextResult v5 recommends
and authorizes only `ASSURE_PUBLIC_CONTRACT`. That atomic public cutover was not
started by this slice.

Plan advance, commit, release selection, remote writes, publication, dist-tag
movement, and Issue mutation remain separate authorization boundaries.
