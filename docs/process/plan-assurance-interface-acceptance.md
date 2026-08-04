# Conditional Plan Assurance Interface Acceptance

- Status: Accepted target 1.0
- Acceptance date: 2026-08-03
- Workstream task: `ASSURE_INTERFACE_CONTRACT`
- Semantic contract: [Conditional Plan Assurance](../specs/plan-assurance.md)
- Interface contract: [Grammar 6 and CLI Contract 7](../specs/plan-assurance-interface.md)
- Case fixture: [`plan-assurance-interface-v1.json`](../../test/fixtures/plan-assurance-interface-v1.json)
- Active runtime: Grammar 5 and CLI Contract 6
- Runtime status: interface accepted; later internal hash, source, mutation,
  and authority Cores implemented; public surface not activated

## 1. Acceptance decision

The interface target is complete enough to hand to source and hash Core
implementation. It selects Grammar 6, CLI Contract 7, assurance source
records, ten command paths, closed result identities, the start-authority
policy, governance interface 2, diagnostics, migration, Mermaid profile 2,
and fixed SHA-256 vectors as one coherent target.

This acceptance does not activate the standard parser, command registry,
schema catalog, help, package root, CLI, linked package, or installed package.
Those surfaces remain Grammar 5 and CLI Contract 6 until
`ASSURE_PUBLIC_CONTRACT`. It also does not select a package or release version.

## 2. Closed decisions

| Concern | Accepted target |
| --- | --- |
| Enablement | paired `plan_assurance_model 1` and `plan_assurance_hash_model 1` in Grammar 6 |
| Relation | `task_relation`; `both`, `execution_only`, or `planning_only` |
| Accepted basis | one task-keyed `plan_seal` with machine-written contract, ordered input, and basis commitments plus a human reason |
| Outcome | one globally identified, basis-bound `task_outcome`; changed status requires a closed summary |
| Advance frontier | machine-managed `assurance_receipt` with a self-hash and per-consumer mode |
| Inspection and acceptance | filtered `plan-assurance show`, scalar `hash`, `seal`, and repeatable-task `reseal` |
| Maintenance | `plan-dependency add|set|remove` and `task-outcome add|set|remove` |
| Public results | Check v4, Project v4, Analysis v5, Next v6, Mutation v4, Advance v2, PlanAssurance v1, GovernanceDecision v2 |
| Start authority | `recommendation_v1_plus_release_gate_plus_plan_assurance_v1` |
| Persistent authority | new `plan_assurance` scope controlled by the effective pre-change DAG owner |
| Compatibility | Grammar 1 through 5 and CLI Contract 6 unchanged; enablement only through atomic seal |

## 3. Consistency findings

- Lifecycle status, events, actual measurements, source trivia, and accepted
  hashes remain excluded from the task plan contract.
- Accepted contract and input commitments make direct task, direct relation,
  and inherited predecessor causes distinguishable; one opaque basis alone
  would not satisfy the explanation requirement.
- The source record stores only the accepted component snapshot: contract,
  ordered inputs, and their basis. Current computed hashes remain a read-only
  projection and therefore cannot accept themselves.
- Reseal accepts a stable task set in planning-topological order and leaves
  unselected mismatching descendants visible for review.
- Outcome evidence is explicit and bound to the exact accepted/computed basis;
  completion status alone cannot claim conformance.
- Advance contracts only still-consumed commitments and proves each retained
  basis equal before and after. Repository history safety remains independent.
- Governance source contract 1 requires no new principal metadata. Governance
  interface 2 adds only the closed affected scope and result identity needed
  to control assurance writes.
- The interface calls SHA-256 values seals or commitments, never signatures,
  authentication, blockchains, or correctness proof.
- Pinpoint `hash` inspection emits one selected current digest but never changes
  accepted components or substitutes for governed reseal.

## 4. Machine acceptance

The dependency-ordered fixture defines `PAI-001` through `PAI-012`. The focused
test recomputes every fixed vector from its exact canonical UTF-8 string,
checks command/result/governance/policy identities, and proves the active
Contract 6 registry and schema catalog do not advertise assurance. It also
passes a Grammar 6 target record to the active parser and requires rejection.

The standard documentation gates additionally check the English baseline,
Markdown fences and links, and all normative `.pert` samples. The self-use
gates include the selected thirty-plan workstream set.

## 5. Remaining work and boundaries

`ASSURE_HASH_CORE`, `ASSURE_SOURCE_CORE`, mutation, and authority were
implemented in later internal slices. Advance, compatibility, public-contract,
and complete acceptance tasks remain. No Git push, GitHub
mutation, npm publication, dist-tag movement, plan advance, or release decision
is included here.
