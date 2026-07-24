# Recommendation implementation and self-use migration

- Document status: MVP adoption complete 1.9
- Created: 2026-07-22
- Requirements: [../requirements.md](../requirements.md)
- Basic design: [../basic-design.md](../basic-design.md)
- Interface contract: [../specs/recommendation-interface.md](../specs/recommendation-interface.md)
- V3 consumer guide: [next-v3-consumer-migration.md](next-v3-consumer-migration.md)
- Human override: [../specs/recommendation-override.md](../specs/recommendation-override.md)
- Normative example: [../examples/recommendation.md](../examples/recommendation.md)
- AI development guide: [ai-development.md](ai-development.md)
- Self-use plan: [self-use.md](self-use.md)
- Related issue: [Issue #1](https://github.com/mako10k/perttool/issues/1)
- Design acceptance record: [recommendation-design-review.md](recommendation-design-review.md)
- Shadow acceptance record: [recommendation-shadow-review.md](recommendation-shadow-review.md)

## 1. Purpose

This document defines the order and gates for introducing the designed recommendation contract into Core, CLI, and self-use without changing the meanings of fields derived from `Perttool.NextResult.v2` partway through.

The migration objectives are as follows.

- Do not reimplement ranking, reasons, or explanations for each UI.
- Do not make an incomplete explanation graph the AI task-selection authority.
- Make the breaking migration from v2 to v3 one published logical change.
- Introduce recommendation implementation and human-override apply as separate authorities.
- Do not make current read-only self-use depend on an incomplete writer or audit path.
- When restructuring the roadmap, divide implementation tasks, dependencies, and acceptance into estimable units.

This document defines process and migration order. It does not change the corresponding normative specifications for ranking, tiers, wire schema, or override semantics.

## 2. Current boundaries

As of 2026-07-23, the implementation is as follows.

- `selectNextTasks` and `dag next` return `Perttool.NextResult.v3` and the complete recommendation graph.
- `active`, `ready`, `runnable_now`, `blocked_now`, and `upcoming` are implemented.
- Candidate facts, complete order, selection horizon, recommended set, tier, structured explanation, PTREC invariants, and Core/CLI JSON/text/help/package publication are implemented.
- Self-use shadow is accepted for five plans.
- Read-only override validation and the `Perttool.OverrideDecision.v1` artifact are implemented in the public library Core.
- Normal-authority adoption is complete following the five-plan shadow and unknown-version safe-stop dry run.
- Override apply and audit integration are unimplemented.
- Self-use is at Stage 3; editing/advance writes require preview, expected digest, and reanalysis after writing. Override apply is unimplemented.
- In accordance with the [AI development guide](ai-development.md), normal AI task selection uses a complete and known v3 recommendation as its authority.

Do not interpret v2-derived fields as recommendation; root `recommendation` alone is the source of truth for normal recommendation. Do not start a task for an unknown version, incomplete trace, or `PTREC-*`, and keep human-override apply unavailable until MIG-08.

## 3. Roadmap restructuring gate

Add the first product-implementation tasks and estimates to the macro/detail plans in `M1_ROADMAP_UPDATE` only after it satisfies the following. This gate was completed on 2026-07-22.

1. `DESIGN_REVIEW` in `plans/control-plane.pert` is complete.
2. Acceptance of `plans/grammar.pert` is complete.
3. Assign formatter, mutation preview, safe write, and advance to their actual module/file boundaries and responsible resources.
4. Give each unit a duration, acceptance, narrow test, and parallelizability.
5. Do not start product implementation until `M1_ROADMAP_UPDATE` in `plans/mvp.pert` is complete.

Execution order was fixed in the [operations detail plan](../../plans/operations.pert), completing all 24p. After M3, Stage 3, Mermaid profile design, and Mermaid export/import round-trip, the [MVP release readiness audit](mvp-release-readiness.md) identified unimplemented acceptance criterion 16. MIG-01 through MIG-07 were detailed in the [recommendation implementation plan](../../plans/recommendation.pert) as 22p, precedence 19p, and resource 22p, using observed operations `24p/1d` as initial velocity. The macro plan added `RECOMMENDATION_IMPLEMENTATION` as a release hard predecessor and returned `RELEASE_E2E` to upcoming.

MIG-01 was completed on 2026-07-23. Minimal `.pert` fixtures for REC-001 through REC-007, unit input for REC-008 through REC-011, future expected facts, and the current `NextResult.v2` groups/tasks/resource-rejection/upcoming-explanation projection were fixed as fixtures and goldens. REC-002 corrected normative distance so completion counterfactual and gate distance agree. The first completion sample of 2p/1 active day updated recommendation-specific velocity to `2p/1d`, leaving precedence 17p, resource 20p, resource delay 3p, and resource forecast 10d. The next task was `RANKING_CORE`.

On the same day, MIG-02 was completed. It implemented in `src/recommendation/` a pure Core for completion counterfactuals of actual ready tasks, structural distance, exact complete order, selection horizon, joint resource scan including active allocation, tier, and resource witnesses. Unit tests fixed REC-001 through REC-007, every ranking rule, near-critical/minimum-float horizon, parallel/empty sets, capacity override, and selected/active-only blockers; current Core exports, CLI, help, and `NextResult.v2` were unchanged. Cumulative velocity was updated from 6p/1 active day to `6p/1d`, leaving precedence 13p, resource 16p, resource delay 3p, and resource forecast `8/3d`. The next task was `EXPLANATION_CORE`.

On the same day, MIG-03 was completed. It implemented a non-public pure Core that builds exact typed facts, depth-limited expressions, minimal comparisons with winner/alternative/decisive rule, phase-ordered decision traces, taxonomy 1.0 reason occurrences, and canonical English descriptions from typed parameters from the MIG-02 result. It validates record IDs, canonical order, reference closure, tier/set, expression reevaluation, version/rule/code/fact registry, and description key/parameter/text, fail-closed to `PTREC-301` through `PTREC-303`. Unit tests fixed REC-001 through REC-011, selected/active-only resource blockers, resource witnesses at scan time and final set, zero ready tasks, exact Rational values, and each diagnostic corruption; all 186 tests confirmed current Core exports, CLI, help, and `NextResult.v2` unchanged. Velocity was updated from cumulative 11p/1 active day to `11p/1d`, leaving precedence 8p, resource 11p, resource delay 3p, and resource forecast 1d. The next task was `NEXT_V3_PUBLICATION`.

On the same day, MIG-04 was completed. It connected ranking/explanation to `selectNextTasks` and included public `NextResultV3` types, snake_case JSON adapter, `dag next` v3 complete graph, four-tier text summary, structured help, consumer migration guide, CHANGELOG, and Core/CLI/package parity in one breaking change. It preserves v2 operational projection and returns result-decision and joint-feasibility facts even with zero ready tasks. Velocity was updated from cumulative 15p/1 active day to `15p/1d`, leaving precedence 4p, resource 7p, resource delay 3p, and resource forecast `7/15d`. The next precedence-critical task was `SELF_USE_SHADOW`; `OVERRIDE_VALIDATION` was on the same ready frontier but deferred due to reviewer contention.

On the same day, MIG-06 was completed. Five self-use plans verified the known v3 contract, complete graph, byte determinism, ready subset, joint resource feasibility, v2 operational-field compatibility, and absence of `PTREC-*`. Goldens fixed that the difference between `SELF_USE_SHADOW` and `OVERRIDE_VALIDATION` can be explained only from primary comparison, resource witness, and canonical description; the decision was recorded in the [shadow acceptance record](recommendation-shadow-review.md). Velocity was updated from cumulative 17p/1 active day to `17p/1d`, leaving precedence 3p, resource 5p, resource delay 2p, and resource forecast `5/17d`. The next precedence-critical and recommended task was `OVERRIDE_VALIDATION`; `AUTHORITY_ADOPTION` was on the same ready frontier but deferred due to reviewer contention. Shadow acceptance alone does not promote normal authority.

On the same day, MIG-05 was completed. It implemented pure `validateOverride`, public request/result types, `Perttool.OverrideDecision.v1` JSON projection, and canonical artifacts, fixing allowed/deferred replacement, normal-authority selection, stale/eligibility/resource failure, caller-asserted actor, explicit UTC time, evidence canonicalization, capacity-override binding, and SHA-256 identity in OVR-001 through OVR-004 and OVR-006. The OVR-005 discouraged fixture remains reserved for a future version that introduces a concrete negative fact. The package-installed API generates the same artifact; no file, Git, or network write was added. Velocity was updated from cumulative 20p/1 active day to `20p/1d`, leaving precedence/resource 2p, resource delay 0p, and resource forecast `1/10d`. The only next critical and recommended task was `AUTHORITY_ADOPTION`.

On the same day, MIG-07 was completed. It synchronized the macro-to-detail normal-selection rule to `AGENTS.md`, Copilot instructions, the AI development guide, and help; dry runs fixed the recommended subset, all recommended tasks plus one allowed task, allowed replacement, deferred selection, and empty recommendation. At 16 boundaries for schema, interface, algorithm, taxonomy, explanation, expression, description, locale, completeness, tier, decisive rule/reason/expression, and `PTREC-*`, it safely stops without a selected task. Completing all 22p on the same active day updated provisional observed velocity to `22p/1d`, leaving 0p of detail work. Normal recommendation authority is adopted, and the next macro recommended work package is `RELEASE_E2E`.

MIG-01 through MIG-07 share `src/cli.ts`, `src/index.ts`, CLI/help tests, and `REVIEWERS` through v3 publication. `plans/recommendation.pert` is authoritative for task-specific duration, file ownership, acceptance, and narrow tests. MIG-08 requires override-validation/audit gates in addition to the safe-write gate and remains an independent post-MVP work package. Because Issue #2 also shares help surface and reviewers, it was added after MVP public alpha as the beta-gated `plans/agent-guidance.pert` and macro `AGENT_GUIDANCE_IMPLEMENTATION`. With provider baseline and public contract complete, select Issue #2 from the macro plan and start detail `GUIDANCE_CORE`.

Before roadmap restructuring, duration, ownership, and parallelizability for recommendation migration were not decided in advance. The 2026-07-22 release-readiness audit opened the restructuring gate and fixed initial estimates from actual modules and the verification matrix. Treat Issue #2 as an independent feature that coordinates shared help surface, not as a semantic predecessor of MVP recommendation implementation.

## 4. Implementation migration units

### MIG-01 Normative fixture baseline

Expand case IDs from the [normative recommendation example](../examples/recommendation.md) into minimal `.pert` fixtures and expected facts. Also make the current v2 `groups`, `tasks`, `resource_rejections`, and upcoming `explanation` golden using the same fixtures.

Exit:

- Each implementable case from REC-001 through REC-011 maps to a fixture or unit input.
- The current projection of v2 fields is fixed.
- Do not fabricate `discouraged` in normal version 1.
- Adding fixtures alone does not change public schema or text.

### MIG-02 Candidate facts, ranking, and tier Core

Implement a pure Core that calculates candidate facts, complete order, selection horizon, recommended set, and tier from the actual `ready` set. It takes precedence analysis and project-graph facts as input; do not feed the scheduler's `runnable_now`, resource arcs, or schedule critical path back into ranking input.

Exit:

- Return the same `H`, `R`, and tier from the same input using exact Rational values and stable IDs.
- Distinguish selected blockers from active-only blockers.
- Fix empty sets and parallel recommendations in unit tests.
- `R` is jointly feasible including active allocation.
- No ranking rule exists in the CLI renderer, help, or provider adapter.

### MIG-03 Explanation graph and invariant Core

Build facts, expressions, decision steps, comparisons, reason occurrences, and descriptions from the MIG-02 decision. Validate record IDs, canonical order, reference closure, and description rendering, converting inconsistencies to `PTREC-301` through `PTREC-303`.

Exit:

- Every ready task has a complete decisive chain.
- “Why A rather than B” can be answered from winner, alternative, rule, and typed facts.
- Do not generate a ready-task winner for an active-only rejection.
- Canonical English text can be reproduced from keys and typed parameters.
- Do not convert an invariant failure into a partial-success result.

### MIG-04 `NextResult.v3` atomic publication

After satisfying MIG-01 through MIG-03, switch the Core and `dag next` default result to v3 together, in accordance with the Recommendation Interface Contract.

Include in the same logical change:

- Public Core type and library export.
- CLI JSON serialization and text summary.
- Goldens for complete JSON, Core/CLI parity, text, and errors.
- v3 explanation and machine-readable help in `dsl help` or command help.
- README, package documentation, and consumer migration guide
- The pre-release breaking change in `CHANGELOG.md`.
- A consumer example that checks `schema_version` first.

Do not include in the same logical change:

- Reinterpreting v2 fields as recommendation fields.
- Adding dual emission such as `--schema-version 2`.
- Returning an incomplete graph with `complete=true`.
- Moving only the CLI to v3 first while leaving the library result on v2.
- Mixing unrelated writer, formatter, or Mermaid changes with recommendation.

Keep the default CLI on v2 until immediately before publication. Even when committing internal Core work first, do not make an incomplete result discoverable through a public export or help.

### MIG-05 Read-only override validation

Implement pure `validateOverride`, which takes a complete v3 result as input, as a result separate from normal ranking.

Exit:

- Distinguish unnecessary, required, and impossible overrides with `PTOVR-*`.
- Recheck the selected set for allowed/deferred replacements including active allocation.
- Reference normal reasons by source ID without copying or converting them to a human reason.
- Fix deterministic artifact ID, caller-asserted actor, and explicit UTC time.
- Do not change filesystem, Git, network, or task state.

MIG-05 can be implemented independently after v3 publication. Do not make MIG-04 normal recommendation depend on override apply or write implementation.

MIG-05 was implemented as public library Core on 2026-07-23. `validateOverride` reads only source `NextResultV3` and a request, returning `PTOVR-101` through `PTOVR-106` or a canonical artifact. Do not add a CLI command, task-state mutation, audit write, or Git operation until MIG-08.

### MIG-06 Self-use shadow evaluation

Do not immediately promote v3 publication to AI task-selection authority. First compare the current explicit procedure and v3 recommendation on the same snapshot for `plans/mvp.pert` and selected detail plans.

Shadow gate:

- Every self-use plan succeeds at check/analyze/next.
- JSON is known `Perttool.NextResult.v3` with `complete=true` and `truncated=false`.
- The consumer understands algorithm, taxonomy, explanation, expression, and description versions.
- The same input and options return a byte-identical result.
- Recommended tasks are a subset of actual ready tasks, and the entire recommended set is resource-feasible.
- The normative example and self-use golden succeed, with no `PTREC-*`.
- The AI can explain the primary higher-priority task and decisive comparison from JSON.
- v2-derived operational groups and resource/upcoming explanations have the same meanings as before migration.

During shadow, keep the current manual-selection procedure from the [AI development guide](ai-development.md) as authority. If there is a difference, distinguish implementation bug, specification gap, or insufficient plan facts. Do not alter goldens to match recommendation based on chat intuition.

This gate was accepted for five plans on 2026-07-23. Save the pre-acceptance snapshot in the [shadow acceptance record](recommendation-shadow-review.md), and continuously check the post-completion current snapshot with the [test](../../test/recommendation-self-use-shadow.test.mjs) and [golden](../../test/golden/self-use/recommendation-shadow.expected.json). Keep manual authority until MIG-07.

### MIG-07 Normal recommendation authority adoption

After satisfying MIG-06, only normal start selection can be promoted to authority in the AI development flow.

Update together in the adoption change:

- The shared task-selection rule in `AGENTS.md` and `.github/copilot-instructions.md`.
- The switch from manual to v3 in the [AI development guide](ai-development.md).
- Gates and golden evidence in the [self-use plan](self-use.md).
- AI-consumer procedure in help.
- Safe stop for unknown schema/version.

AI normal selection rule:

1. Select a workstream from the macro plan's recommended work package.
2. Select the recommended task in the corresponding detail plan.
3. A subset of recommended tasks may be selected.
4. One `allowed` task may be added only while retaining all of `R` in the same start selection; reanalyze after starting.
5. Do not start `deferred` or `discouraged` under normal authority.
6. After task start, completion, block, or capacity change, reanalyze rather than reusing the same result.

There is no feature that combines multiple plans into one ranking domain. Select a workstream in the macro plan before evaluating its detail plan, and do not compare tasks in different detail plans directly.

MIG-07 covers normal selection only. Until MIG-08 is satisfied, do not regard a selection requiring human override as an applied override in perttool self-use; the AI must state the difference between normal recommendation and human instruction, then stop. Human final decision authority is not lost, but do not represent unimplemented audit/apply as successful.

MIG-07 was accepted on 2026-07-23, synchronizing the normal-selection rule to shared instructions, the AI development guide, help, and self-use evidence. An automated test fixes the dry run that returns no task ID for an unknown or incomplete contract and `PTREC-*`. The MIG-08 override apply/audit boundary is unchanged.

### MIG-08 Override apply and audit adoption

Override becomes available for self-use only after satisfying MIG-05, the safe-write gate, and the following.

- The selected task's start-state transition can be safely previewed, rechecked, and atomically written.
- Source digest, capacity option, and task-state stale checks exist.
- The canonical override artifact can be saved to a durable audit sink.
- In repository-native operation, task-state changes and the Git trailer can be in the same logical commit.
- Artifact ID, trailer, and selected set are validated before and after apply.
- Check, analyze, and next are rerun for the whole plan after apply.
- Reuse of a single-use ID and partial apply are rejected.

Until MIG-08, even if `Perttool.OverrideDecision.v1` can be generated, do not automate file mutation, Git commit, or task execution.

## 5. Dependencies and publication boundaries

```text
design review + grammar acceptance
                  |
                  v
          M1_ROADMAP_UPDATE
                  |
                  v
 FORMATTER_CORE + MUTATION_PREVIEW
                  |
                  v
            WRITE_SAFETY ------------------------------+
                  |                                    |
                  v                                    |
              ADVANCE                                  |
                                                       |
MIG-01 fixtures -> MIG-02 ranking -> MIG-03 explanation|
                                      |                |
                                      v                |
                              MIG-04 v3 publish         |
                                  |          |          |
                                  v          v          |
                         MIG-05 override   MIG-06 shadow|
                                  |          |          |
                                  |          v          |
                                  |      MIG-07 normal authority
                                  |          |          |
                                  +----------+----------+
                                             |
                                             v
                                  MIG-08 override apply
```

Do not start the MIG-01 through MIG-07 side track before `M3_SAFE_WRITE_READY`, because `M1_ROADMAP_UPDATE` identified conflicts over shared CLI and reviewers. MIG-05 and MIG-06 are candidates for parallel work after v3 publication, but reanalyze their ordering with Mermaid and Issue #2 in the post-safe-write resource schedule. The diagram does not authorize implementation estimates or parallel Agent execution.

## 6. Consumer migration guide

MIG-04 added the [consumer migration guide](next-v3-consumer-migration.md), fixing at least the following.

- Root differences between v2 and v3.
- Checking `schema_version` first.
- Root `recommendation` is always present.
- Normal handling of zero ready tasks and an empty recommended set.
- Treating `recommended_task_ids` as a set.
- How to follow task-decision, primary-higher-priority-task, decisive-step, and comparison references.
- No automatic start for unknown decisive semantics.
- JSON is the complete graph; text is a `complete=false` summary.
- Preserving the meanings of `groups`, `tasks`, scheduler resource rejection, and upcoming explanation.
- Not displaying `optimal=false` as a global optimum.

Provider-specific prompt, skill, agent, and hook templates are in the scope of Issue #2. Each provider guide references this consumer rule and does not add independent ranking or reason inference.

## 7. Failure, rollback, and compatibility

### Before publication

- Keep default v2 before the MIG-04 completion commit.
- Do not mix internal ranking/explanation failure into v2 fields.
- Do not publish a failed internal slice in public help.

### After publication

- Default returns v3 only; do not add v2 dual emission.
- For a v3 regression, do not use recommendation for task selection; isolate the cause with a known-good Git revision and golden.
- Do not omit the recommendation root while `schema_version=v3`.
- Do not return a successful result with empty v3 fields to hide failure.
- Do not silently downgrade v2 consumers; state the pre-release breaking change explicitly.
- Do not change the project plan to fit a tool bug even if self-use authority is suspended temporarily.

A recommendation failure is not necessarily a plan failure. Use a small golden graph to isolate which boundary failed: check, precedence analysis, resource schedule, classification, ranking, explanation, or adapter.

## 8. Verification matrix

| Unit | Narrow verification | Publication/adoption gate |
| --- | --- | --- |
| MIG-01 | fixture check, v2 projection golden | normative case coverage |
| MIG-02 | ranking/tier unit test, determinism, resource invariant | Core review |
| MIG-03 | explanation/reference/invariant test | complete graph review |
| MIG-04 | typecheck, Core/CLI parity, text/JSON E2E, help, package | `npm run check`, CHANGELOG, consumer guide |
| MIG-05 | pure override unit, canonical hash, negative test | no filesystem/Git side effect |
| MIG-06 | five self-use plans, byte determinism, why A/B answer | shadow evidence |
| MIG-07 | AI workflow dry run, unknown-version safe stop | shared-instruction synchronization |
| MIG-08 | stale, atomicity, audit trailer, re-analysis | safe-write/override adoption review |

Run `git diff --check` for every unit. Because MIG-04, MIG-07, and MIG-08 change an adapter or operational boundary, do not consider them complete based only on narrow tests.

## 9. Acceptance

- Defined the implementation order from Core through adapter.
- Separated the internal implementation period that preserves v2 from atomic v3 publication.
- Included CHANGELOG, help, and consumer migration guide in v3 switch conditions.
- Defined the gate that promotes complete JSON to normal authority only after shadow evaluation.
- Preserved two-stage selection through macro/detail plans.
- Separated normal-recommendation adoption from override-apply adoption.
- Connected override apply to safe write, audit, stale check, and reanalysis.
- Defined the boundary that Issue #2 provider guides have no independent ranking.
- Did not fabricate duration, ownership, or Agent parallelism before roadmap restructuring.
- Did not change the current CLI, schema, implementation, or write path.
