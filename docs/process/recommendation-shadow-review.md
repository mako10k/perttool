# Recommendation Self-use Shadow Acceptance

- Decision: Accepted
- Decision date: 2026-07-23
- Task: `SELF_USE_SHADOW` / MIG-06
- Migration: [recommendation-migration.md](recommendation-migration.md)
- Self-use: [self-use.md](self-use.md)
- Test: [../../test/recommendation-self-use-shadow.test.mjs](../../test/recommendation-self-use-shadow.test.mjs)
- Golden: [../../test/golden/self-use/recommendation-shadow.expected.json](../../test/golden/self-use/recommendation-shadow.expected.json)

## 1. Decision

Accept the `Perttool.NextResult.v3` self-use shadow gate. For five self-use plans, v3 recommendations matched the manual selections from the same snapshots and passed checks for known version, complete graph, byte determinism, ready subset, joint resource feasibility, operational fields, and structured why-not.

This decision does not adopt normal recommendations as the task-selection authority. Retain manual selection as the authority until MIG-07 synchronizes `AGENTS.md`, Copilot instructions, AI development guidance, help, and unknown-version safe stop in the same change. Read-only override validation and override apply are also outside this decision's scope.

## 2. Evaluation snapshots

The snapshots were evaluated before changing `SELF_USE_SHADOW` to done.

| Plan | Source digest | Manual selection | V3 recommended | Decision |
| --- | --- | --- | --- | --- |
| `control-plane.pert` | `sha256:21d4d8e5706031abf5c5713ed680638eef58f0f73cb49e2a3631a605b9c66c95` | empty | empty | Match |
| `grammar.pert` | `sha256:bbdeeb1636c0c3ca534d0f69b8a52c17f399a31c38aeecb2b7271f07812c909a` | empty | empty | Match |
| `operations.pert` | `sha256:02735a31416f6e9e1e62e5aa3a816a6d4e1e44ee1b7a2a3e1caab8e5663aedea` | empty | empty | Match |
| `recommendation.pert` | `sha256:2271c43a68cc7eb0cd9286335a1020c1a1fb53af3d6a3167b86d8f2e02f3109d` | `SELF_USE_SHADOW` | `SELF_USE_SHADOW` | Match |
| `mvp.pert` | `sha256:1a264e27b67e081708b2ccba87148296bd4b4aaa392b9c1a2eace9b14c014545` | `RECOMMENDATION_IMPLEMENTATION` | `RECOMMENDATION_IMPLEMENTATION` | Match |

After the completion-state update, rerun the same tests against the current five plans. Update the golden as a shadow projection of the current snapshot, not as a replacement for past plans, and retain the table above as the record of the acceptance-time snapshots.

## 3. Contract checks

The following were confirmed for all five plans.

- Root schema is `Perttool.NextResult.v3`; recommendation interface version is 1
- Algorithm is `perttool.recommendation-ranking.lexicographic-frontier` version 1 with `optimal=false`
- Reason taxonomy is `1.0`; explanation/expression/description registry version is 1; locale is `en`
- `complete=true`, `decisive_chain_complete=true`, `truncated=false`, and every omitted count is 0
- stdout from two runs with the same file and options is byte-identical
- Every ready task has a task decision, and the recommended set is a subset of ready tasks
- The `set_start_feasibility` fact referenced by the result decision is boolean `true`
- No `PTREC-*` diagnostics
- `groups`, task classification, `runnable_now`, resource rejection, and upcoming explanations inherited from v2 have the same meaning as the existing baseline

`PTDAG-208` is an advance-proposal warning for done closure, not a recommendation failure.

## 4. Why A rather than B?

In the detail plan at evaluation time, with `SELF_USE_SHADOW` as A and `OVERRIDE_VALIDATION` as B, the following could be answered from JSON alone.

1. A has precedence critical class `driving`, B has `non_critical`, and A ranks higher under the primary comparison's decisive rule `critical_class`
2. After A enters the recommended set, adding B results in selected usage 1, required 1, available 0, and deficit 1 against `REVIEWERS` capacity 1
3. Therefore A is `recommended`, B is `deferred`, and the resource decisive rule is `joint_resource_feasibility`
4. The canonical descriptions for ranking comparison, resource conflict, and deferred summary are derived from the same facts/comparisons

This explanation is not a chat re-inference; it comes from `primary_higher_priority_task_id`, two comparisons, a resource-capacity witness, and description records.

## 5. Exit criteria and non-goals

Exit:

- check/analyze/next succeeds for five plans
- shadow test and golden succeed
- update `SELF_USE_SHADOW` to done preview-first with expected digest
- add completed 2p to same-day observed recommendation velocity and update Velocity to `17p/1d`

Non-goal:

- normal authority adoption
- read-only override validation
- override apply, audit, and Git integration
- `RELEASE_E2E` or npm publish
