# Issue #37 Next Start-Authority Technical Acceptance

- Status: Implementation, local acceptance, PERT task finish, and conformant
  Outcome accepted; Milestone acceptance and GitHub Issue closure remain
  separately governed
- Date: 2026-09-04
- Issue: #37, `bug: dag next can recommend a task marked not runnable in the same NextResult`
- PERT task: `POOL_NEXT_SIGNAL_CONSISTENCY`
- Public result: `Perttool.NextResult.v8`
- Recommendation algorithm: `perttool.recommendation-ranking.lexicographic-frontier` version 1
- Authority policy: `recommendation_v1_plus_release_gate_plus_plan_assurance_v1`

## 1. Accepted correction

Let `R` be the raw recommended set, `L` be `groups.runnable_now` after
resource and temporal selection, `T` be the time-eligible set, and `A` be the
plan-assurance-eligible set. The complete result now grants normal new-start
authority only for:

```text
startable_recommended_task_ids = R intersection L intersection T intersection A
```

Recommendation ranking and scheduler selection remain independent. The
correction does not change their order, horizon, heuristic identity, or
resource facts and does not rewrite a source plan to make the sets agree. A
raw recommended ID outside `L` remains visible in
`recommendation.recommended_task_ids` and `raw_recommended_task_ids`, while
its task has `runnable_now=false`, its scheduler rejection remains available,
and it is absent from both `temporal_startable_recommended_task_ids` and final
`startable_recommended_task_ids`. The text renderer states the same condition
under `NON-RUNNABLE RAW RECOMMENDED`.

The existing result and policy identities remain valid because they already
separate raw preference from final start authority, and the read-only override
validator already required the missing `R intersection L` relationship. The
active closed schema gains only explanatory annotations for those existing
fields; no field, algorithm, policy, command, or schema identity changes.

## 2. Root cause and escape boundary

The source cause was a missing composition operand. Recommendation ranking and
the scheduler independently selected resource-feasible alternatives, but both
the temporal and actuals Next composers derived start authority from raw
recommendation plus time eligibility and omitted the published scheduler
selection. Plan-assurance composition then correctly narrowed that already
incorrect intermediate set and could not restore the missing relationship.

The escape cause was a test that deliberately established `R != L` but asserted
that the raw recommendation remained startable. Other tests verified each
subsystem independently and did not require final start authority to be a
subset of `groups.runnable_now`. This explains why the defect passed; it is not
the root cause.

The correction centralizes the `R intersection L` operation in
`selectRunnableRecommendedTaskIds` and uses it from both temporal and actuals
composition. Consumer-adoption tests now require the raw, intermediate, and
final set relationships. The dedicated Issue #37 fixture preserves the exact
critical-path-versus-explicit-priority disagreement that originally exposed
the defect.

## 3. Acceptance evidence

The dependency-ordered regression in
`test/issue-37-next-authority.test.mjs` proves:

1. Core retains raw recommendation `CRITICAL` and scheduler selection
   `HIGH_PRIORITY` without changing either algorithm.
2. `CRITICAL.runnable_now=false` retains its exact earlier-selected resource
   witness.
3. Intermediate and final startable sets are empty.
4. CLI JSON carries the same typed facts, CLI text explicitly labels the
   non-runnable raw recommendation, and the source bytes remain unchanged.
5. The complete result validates against the closed active
   `Perttool.NextResult.v8` schema, whose annotations state the same authority
   relationship.
6. `scripts/check-package.sh` repeats the Core-authoritative JSON assertions
   through a newly packed and isolated globally installed CLI.

Focused authority, temporal, publication, schema, CLI, Guide, override,
public-Core, plan-assurance, and adapter tests passed. The static gate passed
type checking, the exact duplicate-code ratchet, and the exact complexity
ratchet. The package gate built a 1,019-file `perttool@0.10.5` development
tarball in a disposable directory, passed publish dry-run, installed it in an
isolated prefix, passed the Issue #37 replay and existing Contract 10 package
workflows, and removed the disposable files. No package was published.

The first complete repository test run passed 1,338 of 1,339 tests; its only
failure was the release-plan test still expecting the exact pre-start PERT
digest and frontier. That lifecycle expectation was updated to the separately
applied task-start event and passed in isolation. The subsequent fresh complete
repository run passed all 1,339 tests after this record and the lifecycle
expectation were present.

The owner then accepted the semantic behavior described in this record, not
the candidate digest alone. The task finished at
`2026-09-04T10:54:41+09:00` with `197/360h` active time and `197/180ph`
effort. The separately previewed and owner-confirmed
`OUTCOME_POOL_NEXT_SIGNAL_CONSISTENCY` records a conformant result against
the unchanged accepted basis
`sha256:8f880210a2a04a8b6c65bd3e2f9dfc1e13e91db0fd8220872da1fffe248c1819`.
The resulting PERT source digest is
`sha256:8bd113759367c784a83a6feba785bcb2b1de8e1b1489c3cc629d0e41bb156746`.

## 4. Preserved boundaries

This correction does not change the source plan, recommendation ranking,
scheduler order, capacity, task priority, Recommendation version, result
identity, authority-policy identity, command count, active schema count,
public export count, Grammar 9 or CLI Contract 10 meaning, VSIX/MCP mutation,
or release scope. The accepted task Outcome does not declare or accept a
criterion set for `POOL_NEXT_SIGNAL_READY`, close Issue #37, resume Gate
Design, reseal or start Issue #38, accept the `0.11.0` gate, push a branch,
publish a package, or move an npm distribution tag. Those remain separate
operations and authority boundaries.
