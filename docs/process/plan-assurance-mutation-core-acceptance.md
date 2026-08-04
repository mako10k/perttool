# Conditional Plan Assurance Mutation Core Acceptance

- Status: Accepted internal Core
- Acceptance date: 2026-08-03
- Workstream task: `ASSURE_MUTATION_CORE`
- Interface: [Plan Assurance Interface Contract](../specs/plan-assurance-interface.md)
- Semantic contract: [Conditional Plan Assurance](../specs/plan-assurance.md)
- Implementation: `src/assurance/mutation.ts`,
  `src/assurance/governance.ts`,
  `src/application/target-assurance-write.ts`, and
  `src/io/target-safe-write.ts`
- Focused test: `test/plan-assurance-mutation-core.test.mjs`
- Active public runtime: Grammar 5 and CLI Contract 6

## 1. Accepted slice

The identity-checked internal Grammar 6 target now provides typed,
preview-first candidates for `plan_dependency.add|set|remove`,
`plan_assurance.seal|reseal`, and `task_outcome.add|set|remove`. Assurance-only
batch requests apply their members to one final candidate and evaluate
governance once. A mixed batch can combine current task, gate, milestone,
resource, or project maintenance with relation maintenance and validates only
the final Grammar 6 candidate; this is the required path for an AoA dependency
edit and relation-mode conversion. The standard package root, CLI registry,
help, Guide, public
schemas, and installed-package surface do not expose these operations.

Every successful candidate is parsed and semantically validated again before
it is returned. Relation changes never create, remove, or reconnect an AoA
task, gate, or milestone, and they never modify an accepted seal. Invalid
relation mode/execution combinations and planning cycles fail with the
accepted `PTASSURE-101` or `PTASSURE-102` source diagnostics.

## 2. Seal and reseal boundary

Initial seal is one mutation candidate. For an assurance-disabled Grammar 1
through 5 document, it upgrades only the declared grammar version, adds the
model pair, computes the complete planning baseline, and inserts one component
seal for every current task. A completed task's plan basis is established
without pretending that outcome conformance already exists; the final
assurance evaluation therefore remains unavailable until an explicit outcome
record is added.

An enabled partial document may receive only missing initial seals when all
existing seals remain consistent. A complete or inconsistent accepted
baseline is not replaced by `seal`. Selected `reseal` requires existing task
seals, one nonempty reason, known model identities, available current bases,
and inclusion of every unresolved current predecessor needed by the selected
set. Unselected descendants retain their previous accepted components and
remain review-required.

Seal edits update `accepted_contract`, `accepted_basis`, ordered
`accepted_inputs`, and `reason` without deriving accepted values from raw
source bytes. No check, relation mutation, outcome mutation, or warning accepts
a computed hash implicitly.

## 3. Outcome and impact boundary

Outcome add binds `against_basis` to the task's current equal accepted and
computed basis; the caller supplies no hash. A conformant outcome forbids a
summary, while a changed outcome requires one. Outcome set preserves its
stored basis unless the request explicitly rebinds it with a nonempty reason
and the same equal-current-basis precondition. Removing the record makes a
completed producer and dependent planning closure unavailable rather than
guessing conformance.

Every valid candidate includes one before/after assurance impact with stable
affected task IDs and the complete hash/state/cause projections. Relation and
outcome changes can therefore expose a downstream review closure while the
stored seal bytes remain unchanged.

## 4. Governance and persistence

The internal decision is `Perttool.GovernanceDecision.v2`, interface and
semantics version 2. Any actual assurance candidate affects the distinct
`plan_assurance` scope, controlled by the effective pre-change DAG owner and
delegates. Preview remains available without owner confirmation. Persistent
authority is candidate-local and source-digest-bound; missing authority
returns `PTGOV-101`, while the existing unused-assertion and preview-assertion
warning meanings remain `PTGOV-103` and `PTGOV-104`.

The internal writer accepts only an `ok`, changed, persist-intent, authorized
result whose candidate bytes reproduce its recorded digest. It then uses the
existing optimistic-lock, symlink/race rejection, candidate revalidation, and
atomic in-place or exclusive-output safe-write machinery with the exact
Grammar 6 capability. An expected-digest mismatch or source race remains a
write conflict rather than a blind retry.

## 5. Verification

Focused acceptance proves:

- atomic Grammar 5-to-6 initial enablement and component sealing;
- source-preserving relation insertion, removal fallback, and selected reseal;
- no relation-side accepted-hash update;
- invalid relation/source combinations failing before a candidate is exposed;
- basis-bound conformant and changed outcomes plus unavailable removal;
- assurance-only and mixed final-candidate batches with one governance decision;
- request, initial-seal, reseal, and outcome precondition failures;
- BOM, CRLF, leading-comment, and unrelated-source preservation;
- candidate-bound Governance v2 denial and direct-owner authority; and
- digest-bound Grammar 6 safe persistence and destination readback.

The focused plan-assurance suite passes 32 cases across interface, hashing,
source, formatting, semantic validation, mutation, governance, and safe-write
boundaries.

The complete `npm run check` gate passes 745 tests, the 566-file English
baseline scan, 146 Markdown and seven normative PERT documentation checks, all
30 self-use plans, the temporary-link workflow, and the 532-file isolated
package workflow. The installed public workflow remains Grammar 5 and CLI
Contract 6.

## 6. Remaining boundary

This slice does not activate Grammar 6 or CLI Contract 7 and does not add the
read-only `plan-assurance hash` command. Composition into check, analysis,
Next, active-task attention, and ordinary-mutation impact is accepted by the
later `ASSURE_AUTHORITY_CORE` record. Assurance-aware advance contraction, the
public cutover, package exports, schemas, help, Guide, and installed acceptance
remain later plan tasks.

Public registry and request-envelope integration remains part of the atomic
public-contract path. Plan advance, commit, release selection, remote
writes, publication, dist-tag movement, and Issue mutation remain separate
authorization boundaries.
