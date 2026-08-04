# Conditional Plan Assurance Hash Core Acceptance

- Status: Accepted internal Core
- Acceptance date: 2026-08-03
- Workstream task: `ASSURE_HASH_CORE`
- Interface: [Plan Assurance Interface Contract](../specs/plan-assurance-interface.md)
- Semantic contract: [Conditional Plan Assurance](../specs/plan-assurance.md)
- Implementation: `src/assurance/`
- Focused test: `test/plan-assurance-hash-core.test.mjs`
- Active public runtime: Grammar 5 and CLI Contract 6

## 1. Accepted slice

The internal Core implements model-1 canonical task contracts,
domain-separated SHA-256 commitments, default and explicit planning
dependencies, deterministic planning-cycle rejection, one complete stable
topological evaluation, accepted component seals, basis-bound completion
outcomes, frontier inputs, assurance states, and complete stable cause paths.

The implementation is pure with respect to files, Git, network, and clock. It
accepts already projected semantic values and does not parse or mutate `.pert`
source. `ASSURE_SOURCE_CORE` owns that later adapter.

## 2. Resolved implementation finding

The pre-implementation consistency check found that storing only one opaque
accepted basis could detect a mismatch but could not distinguish these required
causes:

1. the task's own plan contract changed;
2. its planning relation set or mode changed; or
3. one predecessor commitment changed and propagated.

The accepted source target now stores `accepted_contract`, ordered
`accepted_inputs`, and `accepted_basis` in each `plan_seal`. The Core verifies
that the accepted basis reproduces from those components. This adds no task
status, work event, source trivia, or historical prose to a hash.

## 3. Deterministic hash boundary

The canonical writer owns field order, RFC 8259 encoding, UTF-8, exact reduced
Rational strings, safe JSON integers, Unicode-scalar tag ordering, set
ordering, explicit nulls, and lone-surrogate rejection. It does not reuse a
whole-document digest.

The machine fixture fixes six exact canonical UTF-8 vectors:

- A and B task contracts;
- A and B recursive planning bases;
- A's closed changed-outcome contract; and
- A's exported changed-outcome commitment.

Every vector is independently recomputed by both the interface-contract test
and the Core test.

## 4. State and cause acceptance

Focused cases prove:

- disabled documents return `not_enabled` and `not_applicable` without hashes;
- unknown positive models return affected tasks as `unavailable`;
- missing seals produce `unsealed`, while inconsistent seal components fail
  closed as `unavailable`;
- a missing required frontier commitment makes coverage `partial` and its
  consumer closure `unavailable`;
- implicit `both` propagates one direct cause through complete chain and
  diamond paths;
- `planning_only` propagates without execution meaning, while
  `execution_only` does not propagate plan changes;
- a separate planning cycle returns `PTASSURE-102` before hashing;
- own-contract, relation, inherited predecessor, and frontier changes remain
  distinguishable;
- status, events, trivia, and declaration order do not enter task hashes;
- changed outcomes invalidate consumers once and become usable after explicit
  consumer reseal; and
- missing or stale outcome evidence makes the producer and dependent closure
  unavailable without guessing conformance.

The internal typed boundary also checks the closed relation modes, lifecycle
values, planning-input modes, digest spelling, and changed-outcome strings at
runtime. Malformed projected values return a stable invalid or unavailable
result instead of escaping as a hash input or an uncaught exception.

Input ordering does not change the byte serialization of the complete result.
Full recomputation remains the reference algorithm; no cache or incremental
path is claimed in this slice.

## 5. Non-activation and remaining work

The standard parser, semantic validator, formatter, package root, command
registry, schemas, help, Guide, CLI, link, and installed-package workflow still
expose Grammar 5 and CLI Contract 6. Neither `evaluatePlanAssurance` nor the
hash helpers are exported from `dist/index.js`.

Source projection, governed assurance mutations, and start-authority
composition are accepted in later internal slices. Advance receipts,
compatibility, public activation, and end-to-end acceptance remain plan tasks. Package version
selection, release, remote writes, GitHub
mutation, npm publication, dist-tag movement, Issue mutation, and plan advance
are outside this acceptance.
