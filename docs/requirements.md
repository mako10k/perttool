# perttool Requirements

- Document status: Draft 0.17
- Created: 2026-07-21
- Updated: 2026-07-27
- Scope: MVP and subsequent extension boundaries
- Intended file extension: `.pert` (provisional)

## 1. Purpose of this document

This document defines the requirements for `perttool`, which manages a project's current state and future plan using PERT diagrams.

The central mission of `perttool` is not PERT analysis itself. It is to provide an **AI Project Control Plane** that reproduces priority decisions for AI development from an explicit project plan and prevents task choices that may be locally sound but delay the overall project. PERT/CPM, resource schedules, gates, and milestones provide the basis for deriving these project-control decisions from project facts.

`perttool` treats a document written in its DSL as the source of truth and makes the following reproducible from that document.

- Structural validation as a DAG
- Schedule analysis based on PERT/CPM
- Generation of a feasible schedule that considers shared resource capacity
- Projection of the relative schedule onto declared dates or date-times
- Evaluation of task and milestone deadlines without hiding infeasible targets
- Exact preview-first migration between Points and one explicitly
  velocity-linked time unit
- Extraction of critical tasks and slack
- Extraction of the “next task” that can be started now
- Derivation of the task to prioritize in the current project and the reason it takes precedence over other feasible tasks
- Conversion to visualization formats such as Mermaid
- Equivalent operations from the CLI, CI, and AI agents using CLI JSON; MCP and editor adapters will be added after the MVP

This document classifies requirements as `Must`, `Should`, and `Could`.

- Must: required for the MVP
- Should: needed by immediately after the MVP
- Could: a future extension

## 2. Core product decisions

### 2.1 Adopt Activity-on-Arrow

`perttool` uses Activity-on-Arrow (AoA) as its core model.

- A task is an edge.
- A milestone or event is a node.
- Task dependencies are expressed through edge connections and zero-duration dependency edges.
- Cycles that violate the DAG structure are not permitted.

This decision makes the need to easily revise, change, and add tasks (edges) a first-class property of the data model.

### 2.2 Treat the document as the source of truth

Must:

- Structural validation, analysis, and next-task selection can be rerun from the `.pert` document alone.
- Routine analysis does not require a database, server, or network connection.
- The same document, configuration, and tool version produce the same analysis result.
- Analysis results, caches, and layout coordinates are not mixed into the source-of-truth document.

Should:

- Generated artifacts can be saved in an ignorable location such as `.perttool/`.
- Relative paths in a document are resolved relative to the document itself, not the execution directory.

### 2.3 The current document represents the present and the future

Must:

- The source-of-truth `.pert` document represents the current work boundary and the unfinished plan beyond it.
- Git retains the history of tasks that are complete and no longer serve a role.
- Only completed tasks still needed to determine a join of parallel tasks may remain temporarily in the current document with state `done`.
- After the join condition is satisfied, the current boundary can advance and unnecessary past portions can be removed mechanically.

This document calls this forward operation `advance`. Git is used to inspect history and the difference before and after `advance`.

### 2.4 Make the AI Project Control Plane the central purpose

`perttool` is a control plane that determines which work an AI or human should prioritize now from the current state of the whole project, rather than merely listing feasible tasks. Its purpose is not to maximize the number of completed tasks; it is to prioritize work that helps shorten the time to the declared project finish while respecting dependencies, resource capacity, explicit priorities, gates, and milestones.

The source of truth for the formal separation of feasibility, resource selection, and recommendation tier is the [Recommendation Semantics specification](specs/recommendation.md); for deterministic recommendation order, the [Recommendation Ranking Policy specification](specs/recommendation-ranking.md); for machine-readable reason vocabulary, the [Recommendation Reason Taxonomy specification](specs/recommendation-reasons.md); for the explanation graph from typed facts to derived descriptions, the [Recommendation Structured Explanation specification](specs/recommendation-explanation.md); for Core/text/JSON, the [Recommendation Interface Contract specification](specs/recommendation-interface.md); and for intentional human deviations, the [Recommendation Human Override Contract specification](specs/recommendation-override.md).

Must:

- A project plan with tasks, dependencies, milestones, gates, resources, state, and explicit priorities is the source of truth for priority decisions.
- “Tasks that can be executed now” and “tasks that should be prioritized in the current project” are separate decisions.
- An AI performs work within the authorization and recommendation range decided by the project; it does not redefine project priority based only on conversational interest, ease of implementation, or local improvements.
- Recommendations are derived from facts made explicit in the project model, such as critical path, float, resource constraints, downstream dependencies, gates, and milestones.
- It is possible to explain, using machine-readable project facts, not only the recommended task but also why other feasible tasks are not more highly prioritized.
- Rather than returning a conclusion by reason code alone, the tool returns the applied rule, typed facts, comparison subjects, and conditions used in the decision as a structured explanation, so that an AI can answer “why this task rather than another task” without re-reasoning the ranking.
- Human-readable reason descriptions are derived deterministically from stable codes, structured facts, comparisons, and a decision trace; natural-language text alone is not the source of truth for the basis of a decision.
- The same document, options, and algorithm version return the same recommendations in the same order.
- When the recommendation algorithm and resource schedule are heuristic, the tool does not present them as an unproven global optimum.
- Facts not present in the current project model, such as rework risk, insufficient information, and release-specific meaning, are not inferred from chat context and incorporated into ranking.
- A human can intentionally deviate from a recommendation. Instead of forbidding the deviation, the contract makes clear that it is an override and states its reason.
- In the MVP, recommendations are available as read-only Core/CLI analysis. Persistence of an override is not required until the write-safety gate has been crossed.

Should:

- After project state changes, such as task completion, a block, capacity, or an override, the whole project is reanalyzed and stale recommendations are not reused.
- Future adapters other than the CLI use the same Core recommendation and do not reimplement provider-specific priority decisions.

### 2.5 English is the repository baseline

English is the canonical language for repository-maintained artifacts. This decision applies to requirements, specifications, design, examples, process documentation, current plan metadata, source comments, bundled help, and diagnostic messages.

Must:

- New or substantively modified repository prose uses English.
- Stable command names, DSL keywords, JSON fields, enum values, schema identifiers, diagnostic codes, reason codes, and typed data remain the machine-readable authority. Natural-language messages alone must not become a machine contract.
- Existing Japanese content remains explicit migration debt until the phased work in [`plans/english-baseline.pert`](../plans/english-baseline.pert) is accepted.
- User-authored `.pert` titles, descriptions, source data, and intentional Unicode fixtures are preserved. The tool must not translate them automatically.
- The language used to communicate with a human is independent from the repository baseline. An agent may answer a Japanese-speaking user in Japanese while writing tracked repository artifacts in English.
- The same input, options, tool version, and fixed English description registry produce the same output regardless of the process locale.

Current non-goals:

- Runtime locale selection or a `--locale` option
- Translation catalogs, gettext-style infrastructure, or environment-dependent message selection
- Full translation of legacy Japanese artifacts in one change

The baseline policy is effective immediately. Migration of existing surfaces is a separate, phased workstream after the first beta and does not expand the accepted `BETA_RELEASE_E2E` gate.

### 2.6 Separate plan maintenance from goal and DAG authority

`perttool` distinguishes authority to perform ordinary plan maintenance from
authority to redefine the project goal or DAG. The threat is accidental
authority overreach or goal substitution by a non-malicious executor, such as
changing `project.finish` or replacing difficult critical-path work and then
treating the resulting empty recommendation as project completion.
The [Owner-Aware Mutation Governance Semantics specification](specs/governance-authority.md)
defines the exact change classification and pre-change authority decision.
The [Governance Source and Effective-Metadata
specification](specs/governance-source.md) defines principal syntax, declared
and effective project metadata, Grammar 4 compatibility, and the source
snapshot consumed by that decision.
The [Owner-Aware Governance Interface
Contract](specs/governance-interface.md) defines the caller assertions, public
results, CLI Contract 5, help, diagnostics, exits, and atomic activation.

Must:

- Represent effective owners and delegates separately for the project goal and
  DAG.
- Keep existing documents valid when governance metadata is omitted. Their
  effective goal owner and DAG owner are `user`, and both delegate sets are
  empty.
- Treat principal IDs and owner-confirmation values as caller assertions, not
  authenticated or verified identities. The initial principal domain supports
  at least `user`, `llm`, and `codex`.
- Require explicit write authority for goal and DAG changes while keeping
  preview, diff, and read-only analysis available without owner confirmation.
- Authorize owner and delegate changes against the pre-change governance state;
  a mutation cannot grant itself authority and use the new authority in the
  same operation.
- Keep this project-model write authority separate from a recommendation
  override. An override selects a different feasible ready-task start set; it
  does not authorize changing project facts, the goal, or the DAG.
- Preserve all existing parse, semantic, candidate-validation,
  optimistic-lock, safe-write, and Git-history protections.

## 3. Problems to solve

- A task list alone makes dependencies and start order hard to see.
- Critical paths and slack calculated manually become stale after a plan changes.
- Relative durations alone do not show when work is projected to start or
  finish, whether a start constraint is active, or whether a declared deadline
  is at risk.
- Editing a diagram directly separates it from the plan data or makes them inconsistent.
- When adding a task, it is difficult to notice that existing dependencies have been broken.
- “Tasks that can be done now” and “future tasks” are mixed together.
- “Tasks that can be done now” and “tasks that should be done now” are not distinguished, causing an AI to optimize locally for an easy-to-start branch task.
- Project intent and the reasons for task selection are scattered across prompts, chat history, and issue discussions, so the same decision cannot be reproduced from the same plan.
- Optional features and improvements scheduled for replacement are prioritized, while critical dependencies and work immediately before a gate are postponed.
- An executor that is authorized to maintain status or estimates can
  accidentally redefine `project.finish` or restructure the DAG without the
  goal or DAG owner's confirmation.
- A plan that cannot be recalculated without a GUI or external service is difficult to put under Git and automation.
- Behavior diverges when human help and the operational contract for AI are implemented separately.

## 4. Non-goals

The MVP and the subsequent extension boundaries in this document do not aim to
provide the following.

- Replacing a general-purpose project-management SaaS
- Guaranteeing an exact exhaustive-search optimum for resource-constrained schedules in the MVP
- A general-purpose resource calendar that includes shifts, holidays, skills, and setup time
- Actual-time, attendance, or timesheet recording
- Automatic deadline enforcement that silently changes dependencies, duration,
  resource priority, or recommendation ranking
- Management of attendance, work billing, costs, or budgets
- Chat, notifications, or approval workflows
- Storing all historical states in one `.pert` document without using Git history
- Treating Mermaid as the source of truth and interpreting all Mermaid syntax
- Guaranteeing an exact completion probability for a network with competing critical paths
- Delegating PERT/CPM calculation itself to an LLM
- A planning system in which AI autonomously invents tasks, dependencies, milestones, or priorities
- Deciding priority by evaluating code interest, quality, or general value outside the project plan
- Deciding recommendations only from opaque AI/ML scores
- Guaranteeing an exact global optimum for a heuristic schedule or recommendation
- Treating risks, information, or release semantics absent from the project model as source-of-truth facts inferred from chat
- Prohibiting a human from deviating from a recommendation
- Authenticating or verifying governance principals, or providing signatures,
  RBAC, identity-provider integration, or an external approval system
- Defending against a malicious caller that deliberately forges an actor or
  owner-confirmation assertion
- Preventing a text editor from changing `.pert` bytes
- Treating governance owners or delegates as recommendation-ranking facts,
  dependency edges, or scheduling resources
- Providing a durable owner-confirmation ledger or combining owner-aware
  mutation authority with recommendation override apply/audit
- runtime i18n, localization catalogs, or locale negotiation

## 5. Intended users and primary use cases

### 5.1 Plan author

- Add milestones and tasks as text.
- Describe three-point estimates.
- Declare exclusive equipment or personnel slots as resources.
- Validate syntax, references, cycles, and unreachable portions.
- Generate and review Mermaid diagrams.

### 5.2 Work executor

- Check tasks currently in progress.
- Check tasks that can be started now.
- Check the set of tasks that can start concurrently with currently available resource capacity.
- Check blocking reasons and criticality.
- Change a task's state, estimate, owner, or endpoint.
- Advance the current boundary after completion.

### 5.3 Reviewer

- Review plan changes from a Git diff.
- Recalculate the critical path, projected completion, and slack after a change.
- Compare concurrency and projected completion after changing resource capacity.
- Use both Mermaid diagrams and machine-readable JSON.

### 5.4 AI agent

- Discover the DSL and operational contract through structured help.
- Validate and analyze a document, obtaining feasible tasks separately from recommended tasks.
- Check a recommendation's reasons and higher-ranked tasks, then choose work from the range the project authorizes or recommends.
- When choosing a task outside the recommendation at human direction, state that it is an override and state the reason.
- Preview task edits and show the diff.
- Do not rewrite a file without explicit authorization and conflict validation.

## 6. Terminology and semantic model

| Term | Meaning |
| --- | --- |
| Project | One PERT planning document |
| Milestone | A DAG node representing the start or finish of a task |
| Task | A DAG edge representing work and having positive duration |
| Gate | A non-task edge with zero duration that represents dependency only |
| Resource | A shared resource whose capacity is occupied while a task runs and returned when it completes |
| Frontier | The set of milestones reached now that form the entry to the future plan |
| Reached | A state in which a milestone's conditions are satisfied and work can proceed from it |
| Ready | A state derived from a not-started task whose dependencies are satisfied and which is not blocked |
| Critical | A task or gate whose total float is within the allowed tolerance |
| Schedule Critical | A sequence of tasks that constrains completion time in a feasible schedule including resource waits |
| Recommendation | Work that should currently be prioritized and its explanation, derived from facts explicit in the project model. The [Recommendation Semantics specification](specs/recommendation.md) is authoritative for its formal meaning. |
| Override | A decision in which a human intentionally chooses work different from the recommendation and states that fact and its reason |
| Principal | A caller-asserted identifier such as `user`, `llm`, or `codex`; it is not an authenticated identity |
| Goal Owner | The principal whose authority governs changes to `project.finish` and goal-governance metadata |
| DAG Owner | The principal whose authority governs changes to task, gate, and milestone structure and DAG-governance metadata |
| Delegate | A principal that an owner has declared may perform governed writes within one authority scope |
| Owner Confirmation | A caller assertion that the named effective owner was consulted; it is neither authentication nor proof of approval |
| Point | The project-specific unit `p` that AI or people use to estimate relative work size; it is not time itself |
| Velocity | A project-wide ratio expressing the number of Points that can be completed in a period; for example, `20p/10d` |
| Velocity Forecast | A forecast that converts Points and days/hours using Velocity, distinct from declared PERT values |
| Snapshot | A `.pert` document representing the present and future at a particular point in time |
| Advance | An operation that moves the frontier forward to reflect completion conditions and removes unneeded past portions |
| Temporal Anchor | `project.as_of`, which maps relative schedule time zero to the declared snapshot date or date-time |
| Not Before | An absolute task-start constraint that prevents an unstarted task from becoming time-eligible before the declared value |
| Deadline | An absolute target by which a task should finish or a milestone should be reached; missing it does not make the source document structurally invalid |
| Calendar Projection | A derived mapping from exact relative schedule values to dates or date-times; it does not replace the base-unit analysis |

## 7. Canonical data model

### 7.1 Project

Must fields:

- `id`: a stable identifier unique within the document
- `title`: a human-readable name
- `finish`: the ID of the final milestone
- `duration_unit`: the project-wide base unit used for analysis and display: one of `day`, `hour`, or `point`

Optional fields:

- `as_of`: the temporal anchor and reference date or date-time of the snapshot
- `description`: a multiline description
- `critical_epsilon`: the tolerance for including near-critical work in critical display under exact Rational calculation
- `target_duration`: the target duration from the current boundary to `finish`
- `velocity`: the project-wide ratio for converting between Points and days/hours; required when `duration_unit point`

Constraints:

- A task's duration/estimate, `critical_epsilon`, and `target_duration` use the project's base unit.
- `velocity` expresses a positive Point quantity and a positive period as `<points>p/<period>d` or `<points>p/<period>h`.
- When specifying velocity with `duration_unit day|hour`, the period suffix matches the project's base unit.
- With `duration_unit point`, the period suffix of velocity determines whether conversion is to `day` or `hour`.
- A velocity-derived value is explicitly named `velocity_forecast` and does not replace a declared PERT value.
- Velocity does not imply a relationship between `1d` and `1h`, business days, or working hours.
- A document declaring any task or milestone temporal property requires
  `as_of`; no command derives it from the system clock.
- The deadline for the whole project is the `deadline` on the milestone
  referenced by `finish`. There is no separate `project.deadline` alias.

Owner-aware governance extension:

- The project model provides declared and effective values for `goal_owner`,
  `dag_owner`, `goal_delegates`, and `dag_delegates`.
- Omitting these fields means effective `goal_owner=user`,
  `dag_owner=user`, and empty goal and DAG delegate sets. Existing documents
  remain valid without source migration.
- Owner and delegate values are principal IDs. The normative grammar,
  canonical field order, compatibility version, and source-preserving mutation
  forms are fixed by the [Governance Source and Effective-Metadata
  specification](specs/governance-source.md) rather than inferred from these
  requirements.

### 7.2 Resource

A Resource is a renewable resource that is occupied while a task runs and returned when it completes.

Must fields:

- `id`: a stable identifier unique within the document
- `title`: a human-readable name
- `capacity`: a positive integer available for concurrent use; `1` represents exclusive execution

Optional fields:

- `description`: a multiline description
- `tags`: a set of strings for search and display

Constraints:

- Capacity is at least 1 and at most 2147483647.
- Consumable resources, shifts, calendars, and capacity changes during execution are outside the MVP.
- A task using a resource retains its declared quantity for its entire execution interval.

### 7.3 Milestone

Must fields:

- `id`: a stable identifier unique within the document
- `title`: a human-readable name

Optional fields:

- `state`: `planned` or `reached`; defaults to `planned`
- `description`: a multiline description
- `tags`: a set of strings for search and display
- `deadline`: the latest desired date or date-time at which the milestone
  should be reached

Constraints:

- The milestone referenced by `project.finish` exists.
- No task or gate may leave the finish milestone.
- A `reached` milestone with an unfinished incoming edge is reported as a state contradiction.
- Portions before an explicit `reached` milestone that are not needed for present-state determination should not be retained.
- A milestone deadline is a target, not a dependency edge or a hard cap on the
  schedule. A future or missed deadline does not make an otherwise valid DAG
  invalid.
- The current snapshot does not reconstruct the actual reach time or deadline
  compliance of an already reached milestone.

### 7.4 Task

Must fields:

- `id`: a stable identifier unique within the document
- `from`: the start milestone ID
- `to`: the finish milestone ID
- `title`: a human-readable name
- `status`: one of `planned`, `active`, `blocked`, or `done`; defaults to `planned`
- `duration` or `estimate`: exactly one of them

Optional fields:

- `description`: a multiline description including completion conditions
- `owner`: the responsible person or group
- `priority`: explicit priority during resource contention; defaults to 0
- `requires`: pairs of resource IDs and required quantities; absent means no resource occupation
- `tags`: a set of strings
- `blocked_reason`: the reason for `blocked`
- `source`: a reference target such as a ticket or design document
- `not_before`: the earliest permitted date or date-time at which an unstarted
  task may start
- `deadline`: the latest desired date or date-time at which the task should
  finish

Constraints:

- `from` and `to` must not be the same milestone.
- `duration` must be greater than 0.
- `estimate` must satisfy `optimistic <= most_likely <= pessimistic`.
- `duration` and `estimate` must not be specified together.
- A `blocked` task requires `blocked_reason`.
- Priority is at least 0 and at most 2147483647.
- Each required quantity is at least 1 and no greater than the referenced resource's capacity.
- A task can start only when all required resources can be secured simultaneously.
- The same resource must not be specified more than once within a task.
- The start milestone of an `active` or `done` task must be effectively reached.
- A `done` task should remain only while it is needed for the current join determination.
- A task ID can be retained even when its name or endpoint changes.
- `not_before` constrains temporal start eligibility but does not create a DAG
  edge, change the task duration, or make a structurally ready task unready.
- A task deadline is evaluated independently of its destination milestone
  deadline. Neither value is implicitly copied to the other.
- A deadline is a target rather than a hard finish constraint. A past or
  forecast-missed deadline remains analyzable and is reported as a temporal
  result rather than a structural-validation failure.
- The current document does not store actual start or finish timestamps. It
  must not infer deadline compliance for `done` tasks from `as_of` or Git
  commit time.

The `duration` or `estimate` of an in-progress task represents remaining duration at the current snapshot. Git history records previous estimates.

### 7.5 Gate

A Gate is a dummy edge in AoA that represents dependency only; it is not a task.

Must fields:

- `id`: a stable identifier unique within the document
- `from`: the start milestone ID
- `to`: the finish milestone ID
- `reason`: why this dependency is necessary

Constraints:

- Its duration is always 0.
- It must not create a cycle, just as a task must not.
- In a visualization, it uses a line style distinguishable from a task.

### 7.6 Temporal property scope

The first temporal extension accepts exactly the following declared
properties.

| Entity | Property | Meaning |
| --- | --- | --- |
| Project | `as_of` | Existing snapshot anchor for relative schedule time zero |
| Milestone | `deadline` | Latest desired reach date or date-time |
| Task | `not_before` | Earliest permitted start date or date-time for an unstarted task |
| Task | `deadline` | Latest desired finish date or date-time |

Must:

- Use the same explicit ISO date/date-time lexical family as `as_of`; a
  date-time carries an offset and no value depends on the process-local time
  zone.
- Require `project.as_of` when `deadline` or `not_before` is declared.
- Keep structural readiness separate from temporal eligibility. A task can be
  `ready` but not time-eligible or `runnable_now`.
- Keep task and milestone deadlines as evaluation targets. Do not convert them
  into hidden gates, resource dependencies, duration changes, or hard
  infeasibility errors.
- Keep exact relative PERT/CPM and resource-schedule values in the project base
  unit. Calendar projections and deadline evaluations are separate qualified
  results and never replace those values.
- Preserve a declared offset and enough date/date-time precision to reproduce
  comparisons and projections. Human-readable formatting is not a comparison
  input.
- Evaluate task deadlines, milestone deadlines, and the finish-milestone
  deadline independently, while returning their relationships explicitly when
  one task feeds a deadline-bearing milestone.
- Treat temporal output as a deterministic function of the document, options,
  and versioned algorithms. Do not read the current wall clock.
- Expose why a calendar projection or deadline evaluation is unavailable,
  including a missing anchor, unavailable point/time conversion, unresolved
  block, or unsupported calendar relationship.

Initial capabilities:

- Derive projected task start and finish, milestone reach, and project finish
  from both the precedence lower bound and the heuristic resource schedule
  where the calendar contract permits it.
- Evaluate temporal start eligibility from `not_before`.
- Derive deadline feasibility, remaining margin or lateness, and overdue or
  at-risk state without concealing whether the result comes from precedence or
  heuristic resource scheduling.
- Carry temporal facts into next-task output and structured explanations.
  Any effect on recommendation eligibility, ranking, selection horizon, tier,
  or reason taxonomy requires an explicit algorithm/schema version change.

The first temporal extension does not accept:

- `project.deadline`; use the finish milestone deadline;
- temporal fields on resources or gates;
- milestone `not_before`, task planned-start/planned-finish fields, actual
  start/finish timestamps, recurrence, reminders, or percent complete;
- per-task or per-resource time zones, business calendars, holidays, shifts,
  working hours, or time-varying capacity;
- implicit day/hour conversion, conversion through the host locale, or
  conversion from Git timestamps; or
- automatic propagation of a milestone deadline to incoming tasks.

Compatibility:

- Grammar version 1 keeps its current field set and meaning. The new temporal
  fields require a new grammar version rather than silently widening version
  1.
- Grammar version 2 keeps its accepted temporal field set and finite-Decimal
  Duration syntax. Exact fraction Duration is introduced by grammar version 3
  rather than silently widening version 2.
- A version 1 document without the new fields retains byte-compatible
  validation behavior and the same base analysis and recommendation results
  under the existing algorithm versions.
- Result schemas that add temporal fields receive new schema identities.
  Existing schema identities do not gain conditionally present fields.
- The [Temporal and Unit Interface Contract](specs/temporal-unit-interface.md)
  version 2 selects grammar version 3, unit-migration version 2,
  `Perttool.UnitMigrationResult.v2`, and the unchanged future CLI Contract 4
  boundary. It introduces no compatibility aliases and does not silently
  reinterpret Contract 3 options.

### 7.7 Point and time-unit source migration

The first unit-migration extension rewrites one complete valid document
between `point` and the `day` or `hour` unit linked by an explicit project
velocity. It is distinct from read-only `velocity_forecast` output.

Must:

- Permit only `point -> day|hour` and matching `day|hour -> point`.
- Select one exact effective velocity from the project or from an explicit
  replacement supplied as part of the same atomic request.
- Require the effective velocity's period to match the time source or target.
  Never infer a `day <-> hour` relationship from a calendar constant,
  displayed forecast, locale, or wall clock.
- Convert `critical_epsilon`, `target_duration`, every task `duration`, and all
  three values of every task `estimate`, regardless of task status.
- Preserve omitted `critical_epsilon` as an omitted target-unit zero rather
  than inserting a field.
- Leave `as_of`, `deadline`, `not_before`, graph structure, resources, state,
  priority, and all other non-duration source values unchanged.
- Calculate every conversion as an exact Rational using the effective
  velocity. Do not use binary floating point or a rendered decimal.
- Serialize every exact converted Rational. Emit the shortest exact finite
  Decimal when the reduced denominator has no prime factor other than 2 or 5;
  otherwise emit a reduced fraction Duration under grammar version 3. Never
  round or expose a partial candidate.
- Retain grammar version 1 or 2 when every generated Duration is representable
  by its existing Decimal syntax. When any generated value requires a
  fraction, atomically upgrade the complete candidate to grammar version 3
  and report the grammar metadata change.
- Retain, replace, or insert velocity deterministically. A retained velocity
  preserves its source bytes; a replacement is explicit and atomic.
- Produce one source-preserving candidate, localized edits, and a deterministic
  unified diff, and revalidate only the final candidate.
- Treat a same-target request without replacement as a no-op and prevent a
  repeated request from scaling values twice.
- Guarantee exact inverse restoration of source Rational values when the same
  effective velocity is retained. Lexical Duration spelling need not be
  restored. Replacement velocity and a grammar-version upgrade must each be
  reported as metadata changes; migration does not automatically downgrade a
  version 3 document.
- Fail closed if a later grammar adds a base-unit-bearing field not inventoried
  by the active migration version.

The normative formulas, field inventory, representability rule, velocity
disposition, round-trip qualification, and stable semantic failure causes are
defined by the
[Point and Time-Unit Migration Semantics specification](specs/unit-migration.md).
The dependency-ordered
[Temporal and Unit Interface Contract](specs/temporal-unit-interface.md)
defines public Core/CLI names, result schemas, help, and diagnostic codes
before runtime implementation.

## 8. DSL requirements

### 8.1 Design principles

Must:

- It uses a line-oriented block syntax.
- Indentation represents ownership.
- A keyword explicitly identifies each block kind.
- References use stable IDs rather than display names.
- It supports UTF-8 titles and descriptions.
- An ID begins with an ASCII letter and may use ASCII alphanumerics, `-`, and `_`.
- The parser retains file, line, and column source spans for every semantic element.
- It supports standalone-line comments, which ordinary editing operations preserve.
- Declaration order does not affect semantics.
- A task definition is localized in one place, so its endpoint, estimate, and state can be edited locally.
- Resource capacity and task requirements can be edited locally by stable ID.

Should:

- The formatter preserves semantics and, as far as possible, declaration order and comments.
- Multiline text can be written as block text.
- Markdown fenced code blocks can use the language name `pert`.
- Unknown future fields produce an explicit diagnostic rather than being silently ignored.

MVP duration literals require a unit suffix, such as `2d`, `4h`, or `3p`. The DSL recognizes `day`/`d`, `hour`/`h`, and `point`/`p`; task estimates in one document use the project's base unit. Conversion between Points and days/hours uses only explicit velocity, and mixed units in a document without a calendar-conversion rule are an error.

### 8.2 Grammar specification and representative syntax

The [DSL grammar specification](specs/dsl-grammar.md) is authoritative for the complete EBNF, lexical rules, fields, defaults, error recovery, and formatter contract. The following is representative syntax.

```pert
project PERTTOOL_MVP:
  version 1
  title "perttool MVP"
  description |
    Build a document-based PERT task-management tool.
  as_of 2026-07-21
  duration_unit day
  finish RELEASED

resource DEVELOPERS:
  title "Development"
  capacity 2

resource RELEASE_ENV:
  title "Release environment"
  capacity 1

milestone NOW:
  title "Now"
  state reached

milestone REQUIREMENTS_DONE:
  title "Requirements complete"

milestone CORE_DONE:
  title "Analysis core complete"

milestone CONVERTERS_DONE:
  title "Conversion complete"

milestone RELEASED:
  title "MVP released"

task REQ NOW -> REQUIREMENTS_DONE:
  title "Finalize requirements and the DSL"
  estimate:
    optimistic 1d
    most_likely 2d
    pessimistic 4d
  status active
  tags [requirements, mvp]

task CORE REQUIREMENTS_DONE -> CORE_DONE:
  title "Implement the PERT/CPM analysis core"
  duration 5d
  status planned
  requires:
    DEVELOPERS 1

task CONVERT REQUIREMENTS_DONE -> CONVERTERS_DONE:
  title "Implement Mermaid conversion"
  estimate:
    optimistic 2d
    most_likely 3d
    pessimistic 6d
  status planned
  requires:
    DEVELOPERS 1

task INTEGRATE CORE_DONE -> RELEASED:
  title "Integrate the CLI and analysis core"
  duration 2d
  status planned
  requires:
    DEVELOPERS 1
    RELEASE_ENV 1

gate CONVERTER_RELEASE_GATE CONVERTERS_DONE -> RELEASED:
  reason "The release also requires conversion"
```

### 8.3 Grammar contract

Must:

- `project`, `resource`, `milestone`, `task`, `gate`, `estimate`, and `requires` conform to the grammar specification.
- Automated tests detect differences among the grammar, parser, formatter, and syntax help.
- A breaking grammar change includes a version and migration procedure.

## 9. State and current-boundary semantics

The formal definitions, diagnostics, and canonical advance rules in this chapter are defined by the [Graph Semantics specification](specs/graph-semantics.md).

### 9.1 Milestone reachability

The analyzer derives the effective state of a milestone by applying the following rules in DAG topological order.

1. A milestone with `state reached` is reached.
2. A `done` task satisfies the work condition for its edge.
3. A gate satisfies its condition if its source milestone is reached.
4. A milestone whose incoming-edge conditions are all satisfied becomes reached.
5. A milestone with no incoming edge and without `state reached` is a structural error.

When explicit and derived states differ, analysis may use the derived state but returns a warning that recommends `advance`.

### 9.2 Task states

| Stored state | Meaning | Weight in the remaining schedule |
| --- | --- | --- |
| `planned` | Not started | duration or expected value |
| `active` | In progress | currently recorded remaining duration or expected value |
| `blocked` | Cannot start or progress because of an external factor | duration or expected value; excluded from next |
| `done` | Work condition satisfied | 0 |

`ready` is not a stored state; it is derived from dependencies and stored state.

Task states are mutually exclusive, and only `active` tasks occupy resources at snapshot time zero. A `blocked` task is not executing and occupies no resources. Work that retains resources while stopped, and simultaneous `active` and `blocked` representation, are outside grammar version 1.

### 9.3 Advance

Must:

- Be able to set newly reached milestones to `state reached`.
- Be able to remove `done` tasks wholly before the current boundary, unnecessary gates, and isolated historical milestones.
- Not incorrectly remove `done` tasks still needed to determine a merge.
- Perform structural validation before changes.
- Revalidate the DAG, references, frontier, and finish reachability after changes.
- By default, show only the changed document and diff; do not write a file without an explicit request.
- When writing a file, use atomic replacement from a temporary file and retain the original file on failure.

## 10. Mechanical analysis requirements

An LLM may assist with document editing and explanation, but it MUST NOT generate the following calculation results. The shared analysis core performs the calculations.

The [Analysis specification](specs/analysis.md) defines numeric representation, PERT/CPM, resource schedules, resource arcs, and schedule critical paths.

### 10.1 Structural validation

Must:

- Detect duplicate IDs.
- Detect references to undefined milestones.
- Detect self-loops.
- Detect directed cycles and report the sequence of IDs that forms each cycle.
- Detect tasks, gates, and milestones that cannot reach finish.
- Treat multiple roots as a valid frontier only when all are explicitly `reached`; otherwise detect them.
- Detect roots that are not effectively reached.
- Validate `duration`, three-point estimates, and state-specific fields.
- Return diagnostics that distinguish tasks from gates.

### 10.2 PERT three-point estimates

For a task with a three-point estimate, calculate expected duration and variance as follows.

```text
expected = (optimistic + 4 * most_likely + pessimistic) / 6
variance = ((pessimistic - optimistic) / 6) ^ 2
```

Must:

- Do not round during calculation.
- Permit output options to control displayed rounding precision.
- Set variance for a deterministic duration to 0.
- Set remaining-schedule expected value and variance for a `done` task to 0.
- Normalize units before calculation.
- Report an error for non-convertible mixed units rather than implicitly converting them.
- Do not implicitly add external waiting time for a `blocked` task to duration, and state that the completion forecast is conditional and excludes block-resolution waiting time.

### 10.3 Forward and backward passes

Must:

- Set earliest time to 0 for every effectively reached frontier milestone.
- Determine each milestone's earliest time with a forward pass in topological order.
- Treat the finish milestone's earliest time as the remaining project expected duration.
- Determine each milestone's latest time with a backward pass from finish in reverse order.
- Determine ES, EF, LS, and LF for every task and gate.
- Determine total float and free float for every task and gate.

Use the following formulas.

```text
EF(edge) = E(from) + duration(edge)
E(node) = max(EF(incoming edge))
LS(edge) = L(to) - duration(edge)
L(node) = min(LS(outgoing edge))
total_float(edge) = L(to) - E(from) - duration(edge)
free_float(edge) = E(to) - E(from) - duration(edge)
```

### 10.4 Critical paths

Must:

- Treat an edge with `abs(total_float) <= critical_epsilon` as critical.
- Return all critical edges as the critical subgraph.
- Return one representative critical path using deterministic rules for display.
- Do not conceal the possibility of multiple critical paths.
- Limit path enumeration and state when it is truncated.
- Be able to calculate the total task variance on each critical path.

Could:

- Display the probability of completion by `target_duration` using a normal approximation.
- State approximation limitations when multiple paths compete and do not present the result as exact.

### 10.5 Determinism and complexity

Must:

- Order tied output using a specified tie-break, such as lexicographic stable ID order.
- Target `O(V + E)` for structural validation and basic analysis, excluding full path enumeration and rendering layout.
- Do not vary analysis results based on wall-clock time, random numbers, or network responses.

### 10.6 Resource-constrained schedule

Ordinary CPM considers dependencies only and returns a theoretical lower bound that ignores resource contention. For documents that declare resources, also generate a feasible schedule distinct from that lower bound.

Must:

- Return `precedence schedule` and `resource schedule` as separate results.
- Distinguish DAG edges as hard precedence and task priority as soft preference.
- Do not fix the order of tasks not connected by a dependency; choose it at execution time from resource capacity and the priority rule.
- Return the precedence-schedule makespan as the lower bound without resource constraints.
- Treat tasks as non-preemptive and hold every required resource from start through completion.
- Ensure total use at any time does not exceed capacity in the resource schedule.
- Use expected duration in resource schedules for PERT tasks.
- Have an `active` task occupy resources from time zero for its remaining duration.
- Report an error when resources used by concurrent active tasks exceed capacity.
- Ensure `done` tasks and gates occupy no resources.
- Do not infer external waiting time for blocked tasks, and indicate that the schedule is conditional on immediate block resolution.
- Generate the same schedule from the same input, capacity, and scheduler version.
- Generate a deterministic heuristic schedule in the MVP and do not describe it as optimal.
- Return resource waiting time, utilization by resource, resource makespan, and the difference from the precedence lower bound.
- Express resource waits on the chosen schedule as virtual resource dependencies and return a `schedule critical path`.
- Do not automatically persist virtual resource dependencies as hard dependencies in the authoritative DSL.
- Do not conflate the precedence critical path with the schedule critical path.
- Express in the output contract that a capacity change can change the schedule critical path.

Initial heuristic priority rules:

1. descending task `priority`
2. ascending precedence total float
3. descending expected duration
4. lexicographic task ID

At each time, scan eligible tasks in this order and start as many as possible whose required resources can be acquired. Even when one task cannot acquire resources, permit a later candidate to start if it fits within available capacity.

Should:

- Temporarily override resource capacity through a CLI option for what-if analysis without rewriting the document.
- Compare makespan and schedule-critical-path differences by capacity.
- Include the heuristic name and version in the result.

Could:

- Select an exact or near-optimal solver such as CP-SAT/MILP for bounded problems.
- Report the lower bound, best found result, optimality gap, and timeout.

### 10.7 Temporal projection and deadline evaluation

Temporal analysis is an additional projection over the relative schedules; it
does not replace the calculations in Sections 10.2 through 10.6.

Must:

- Map relative schedule time zero only from the declared `project.as_of`.
- Preserve separate projections for the precedence lower bound and the
  heuristic resource schedule and identify the source schedule in every
  temporal result.
- Apply `not_before` only through a versioned temporal-eligibility rule; keep
  the unqualified precedence CPM result available.
- Return projected dates/date-times and signed deadline margin or lateness
  without reusing display-rounded values.
- Distinguish a deadline that is currently overdue from one that is only
  forecast to be late.
- Qualify results that assume immediate block resolution and results obtained
  from a heuristic resource schedule.
- Return an explicit unavailable result rather than inventing a timezone,
  working calendar, day/hour conversion, actual completion time, or missing
  velocity.
- Use versioned deterministic calendar arithmetic specified before
  implementation.

The exact temporal release scheduling, current due/overdue state, signed
margin, precedence/resource feasibility meanings, non-probabilistic risk
state, block qualification, and unchanged recommendation-version boundary are
defined by the
[Temporal Deadline Semantics specification](specs/temporal-deadline.md).

## 11. Next-task determination

`perttool dag next` returns at least the following classifications.

1. `active`: currently in progress
2. `ready`: its source milestone is effectively reached, its state is `planned`, and it is not blocked
3. `blocked_now`: its source milestone is effectively reached, but its state is `blocked`
4. `upcoming`: an incomplete task that is not yet ready

For documents using resources, subtract current active-task occupancy from `ready` and return the subset that can start concurrently as `runnable_now`.

Must:

- Derive ready determination from the DAG and states rather than a stored label.
- Exclude `done` tasks from next-task candidates.
- Return, for every ready task, precedence/schedule critical status, priority, total float, expected duration, owner, block, and resource requirements.
- Explain missing resources and current occupying tasks for ready tasks excluded from runnable_now.
- Use this default ready-task ordering:
  1. descending priority
  2. precedence critical
  3. ascending total float
  4. ascending earliest start
  5. lexicographic task ID
- Explain unmet direct milestones and incomplete upstream tasks for each upcoming task.
- Return the same meaning in human-readable text and machine-readable JSON.
- Keep `ready` as the structural/state classification. When temporal
  properties are supported, a ready task before `not_before` is excluded from
  `runnable_now` with a distinct temporal-eligibility explanation rather than
  being reclassified as blocked.
- Expose applicable `not_before`, task deadline, destination-milestone
  deadline, projected start/finish, and qualified deadline state in next-task
  results.
- Keep recommendation algorithm version 1 unchanged for version 1 documents.
  Deadline-aware recommendation behavior requires a separately versioned
  ranking and explanation contract.

Should:

- Provide filtering by owner and tag.
- Explain why each task is not ready.
- When milestones can be `advance`d, report that fact before next tasks.

MVP next determination handles dependencies, explicit blocks, and declared renewable resource capacity. Do not infer capacity or concurrency from `owner` alone.

## 12. Task and DAG editing requirements

### 12.1 Text editing

Must:

- Add an edge solely by adding a task block.
- Change a connection solely by changing a task's `from` or `to`.
- Change title, estimate, state, and owner without changing the task ID.
- Remove an edge by deleting its task block.
- Locally add, change, and remove resource blocks and task requires.
- Diagnose invalid references, cycles, and unreachable elements after editing.

### 12.2 Structural editing through the CLI

The MVP provides the following operations.

```text
perttool project show <file>
perttool project set <file> --velocity <velocity> ...
perttool task add <file> <id> <from> <to> --title <text> ...
perttool task set <file> <task-id> --status active
perttool task set <file> <task-id> --from <id> --to <id>
perttool task remove <file> <task-id>
perttool task finish <file> <task-id>
perttool milestone add|set|remove ...
perttool resource add|set|remove ...
perttool mutation apply <file> --request <json-file|->
perttool dag advance <file>
```

Must:

- Inspect project ID, version, title, description, as_of, duration_unit, velocity, finish, critical_epsilon, and target_duration through CLI text/JSON without directly reading the source file.
- Locally change every project-declaration field through the CLI and explicitly clear optional fields.
- By default, emit the changed document to stdout and a summary to stderr, or emit an explicit diff.
- Update the input file only with `--write`.
- Provide `--dry-run` or an equivalent preview contract for every mutation.
- Identify edit targets with stable IDs.
- Do not write when the edited document fails parse or semantic validation.
- Fail when an edit expected to resolve one entity resolves zero or multiple entities.
- Preview multi-entity changes that cannot create a valid intermediate state as an atomic batch that validates only the final candidate.

Should:

- Safely write to a separate file with `--out <file>`.
- Preserve unrelated comments and ordering through source-span-based local edits.
- Accept a pre-change document digest and reject writes on conflict.

The accepted post-beta [CLI Contract 3](specs/cli-contract-3.md) adds two
maintenance capabilities without changing the file-first source of truth.

Must:

- Initialize the smallest valid project through an explicit preview-first
  `project init` command and exclusive `--out`, without silently creating
  tasks, gates, resources, or dependencies.
- Add, change, and remove gates through source-preserving typed mutations.
- Support connected gate/milestone/task changes in one atomic batch.
- Activate direct Contract 3 initialization and gate commands only as part of
  the atomic cutover, after their Core, output, and descriptor prerequisites
  pass their dedicated plan tasks and acceptance cases.
- When the temporal grammar version is implemented, add, change, and clear
  every accepted temporal property through typed preview-first mutations and
  atomic batch requests. File-first maintenance must not require manual source
  rewriting.

### 12.3 Owner-aware goal and DAG writes

The [governance semantics contract](specs/governance-authority.md) is
authoritative for change classification, preview/write decisions,
pre-change authorization, mixed-scope behavior, and the stable governance
denial. The [governance source
contract](specs/governance-source.md) is authoritative for Grammar 4,
declared/effective project metadata, and the digest-bound pre-change snapshot.
The [governance interface
contract](specs/governance-interface.md) is authoritative for Core caller
assertions, repeatable `--accepted-by-owner`, CLI Contract 5, project and
mutation result schemas, help, diagnostics, exits, and the atomic public
cutover.
The governance extension separates two authority scopes.

- `goal`: changing `project.finish`, `goal_owner`, or `goal_delegates`
- `dag`: adding or removing task, gate, or milestone structure; changing task
  or gate endpoints; importing a replacement graph; advancing away removed
  task, gate, or milestone structure; or changing `dag_owner` or
  `dag_delegates`

Ordinary maintenance remains outside these confirmation gates. This includes
task or milestone state, estimates, priorities, task owner, descriptions,
tags, block reasons, sources, temporal properties, task resource requirements,
resource declarations and capacities, project metadata other than
`project.finish` and governance fields, formatting, and exact unit migration.
A later requirement may add another authority scope, but an implementation
must not silently widen `goal` or `dag`.

Must:

- A governed preview, `--diff`, JSON preview, and read-only operation succeeds
  without an actor or owner-confirmation assertion and reports the authority
  scope, effective pre-change owner, and whether a corresponding write would
  require owner confirmation for the supplied actor. When no actor is
  supplied, the preview reports owner confirmation as required rather than
  inventing an actor.
- A governed write declares a caller-asserted actor. The effective owner or a
  declared delegate for that scope may write without a separate
  owner-confirmation assertion.
- Any other actor must supply a caller assertion naming the effective
  pre-change owner for every affected scope. A missing or mismatched assertion
  fails with a stable machine-readable governance diagnostic that identifies
  the required scope and owner without claiming authentication.
- Owner and delegate changes use only the pre-change owner and delegate state
  for authorization. An atomic request cannot self-authorize through values it
  introduces.
- Atomic batch authorization is evaluated over the union of governed
  mutations. When goal and DAG owners differ, the caller supplies both owner
  confirmations through repeatable `--accepted-by-owner` values or the write
  is rejected. Assertions are operation-level and cannot differ by batch
  member.
- Governed direct commands, atomic batch, graph import, and advance share the
  same Core authority determination. A CLI adapter must not reimplement or
  weaken it.
- Governance authorization does not replace source validation,
  final-candidate validation, expected-digest comparison, symlink/race
  rejection, atomic write, or post-write reanalysis.
- `project show` exposes declared and effective governance values. Applicable
  mutation results expose the actor, affected scopes, required owners, whether
  confirmation was required, and caller-asserted owner-confirmation values.
- Registry-driven text help, JSON help, `guide editing`, README maintenance
  guidance, normative examples, and generated/project-init documents describe
  the same boundary. Generated documents include a short leading comment
  warning that direct DSL editing bypasses owner-confirmation checks.
- Direct editing remains technically possible and receives no claim of
  governance enforcement. Existing `.pert` plans should normally be
  maintained through perttool commands when owner-aware governance is active.
- Focused Core, CLI, batch, safe-write, and installed-package tests cover
  omitted defaults, owner and delegate writes, missing and mismatched
  confirmation, pre-change self-authorization rejection, mixed-scope batches,
  stale-digest conflicts, and unaffected ordinary maintenance.

## 13. Visualization requirements

Must:

- Directly visualize DSL `milestone`s as nodes and `task`s and `gate`s as edges.
- Show task ID and title on task-edge labels.
- Optionally show status, expected duration, total float, and owner.
- Visually distinguish critical, active, blocked, and done tasks, and gates.
- Generate Mermaid and other output formats from the same semantic model.
- Do not require layout coordinates in the DSL semantic model.
- Visualize resource sharing in a separate representation that cannot be mistaken for dependency edges.
- In the resource view, inspect capacity, task requirements, and occupancy intervals in the selected schedule.

Should:

- For large DAGs, show subgraphs filtered by critical, ready, owner, and tag.
- Highlight tasks by resource ID and compare what-if results by capacity.
- Navigate from SVG or HTML preview to a source span.
- Separate the layout engine from the semantic analysis core.

## 14. Mermaid conversion

The [Mermaid Profile specification](specs/mermaid-profile.md) defines profile machine metadata, canonical form, integrity, projection, and import validation.

### 14.1 Export

Must:

- Generate Mermaid based on `flowchart LR`.
- Stably use Mermaid node IDs uniquely derived from milestone IDs.
- Represent task and gate IDs, titles, states, and calculation results.
- Preserve resource capacity, task requirements, and priority in reserved metadata.
- Correctly escape characters unavailable in Mermaid labels.
- Generate stable output from the same input and options.

Example output:

```mermaid
flowchart LR
  ptm_NOW(("NOW: Current"))
  ptm_REQUIREMENTS_DONE(("REQUIREMENTS_DONE: Requirements confirmed"))
  ptm_NOW -->|"REQ: Define requirements and DSL / E=2.17d"| ptm_REQUIREMENTS_DONE
```

### 14.2 Import

Do not target all Mermaid syntax; define the `perttool` Mermaid profile.

Must:

- Return a profile exported by `perttool` to DSL losslessly.
- Preserve information required for a lossless round trip as machine-readable metadata under the reserved `%% perttool:` comments.
- Define losslessness as normalized semantic-model equivalence under grammar version 1; do not conflate it with source trivia or byte identity.
- Validate integrity of profile metadata and visual projection.
- Do not silently fall back from corruption after profile-header detection to general Mermaid import.
- Best-effort import nodes and directed edges from general `flowchart`s.
- List unrecoverable estimates, states, task/gate distinctions, resource requirements, and similar items in the loss report.
- Do not infer and silently fill in unknown information.
- Report mappings between auto-numbered IDs and source elements.

Should:

- Fix `DSL -> Mermaid -> DSL` semantic-model equivalence with golden tests.
- Guarantee semantic equivalence within accepted profiles for `Mermaid -> DSL -> Mermaid`.

## 15. CLI requirements

Follow the resource-first pattern of existing DSL tools, separating top-level resources from actions.

The [CLI Interface specification](specs/interfaces.md) defines commands, options, streams, exit codes, and JSON fields.

Initial command surface:

```text
perttool dsl check <file>
perttool dsl format <file>
perttool dsl help [topic] [subtopic] [--level index|quick|detail]

perttool project show <file>
perttool project set <file> ...

perttool dag analyze <file>
perttool dag next <file>
perttool dag render <file> --to mermaid|svg|json
perttool dag import <file> --from mermaid
perttool dag advance <file>

perttool task add|set|remove|finish ...
perttool milestone add|set|remove ...
perttool resource add|set|remove ...
```

The active post-beta breaking interface is
[CLI Contract 3](specs/cli-contract-3.md). It replaces `dsl check|format` with
`document check|format`, separates hierarchical command `help` from domain
`guide`, replaces `mutation apply` with `batch apply`, and adds `project init`
and `gate add|set|remove`. The current source completed the versioned atomic
cutover. The already published `0.1.0` package remains the prior Contract 2
artifact. Suffix-free beta `0.2.0` is the selected first Contract 3 package,
subject to the separate release gate in Section 21.3.

Must:

- Provide default text output for people.
- Provide stable machine-readable output with `--format json`.
- Do not reimplement parse, validate, analyze, next, or convert semantics in the UI layer.
- Use stdout for data and stderr for diagnostics and progress information.
- Define exit codes distinguishable in CI.
- Do not silently accept unknown options, missing required arguments, or unknown actions.
- Show the relevant help topic on error.
- Do not require direct reading or hand editing of `.pert` source in ordinary workflows that inspect or update project metadata.

Recommended exit codes:

| Code | Meaning |
| --- | --- |
| 0 | Success; the target is valid |
| 1 | DSL or semantic-validation error |
| 2 | CLI usage error |
| 3 | Input/output error |
| 4 | Loss in a mode that does not permit conversion loss |
| 5 | Optimistic-lock conflict |

## 16. Help and diagnostics

Use `llmthink`'s shared help graph and `semdl`'s separation of operational and machine-readable help as references.

### 16.1 Help graph

Must:

- Make `perttool guide` the entry point for learning the DSL and domain
  concepts.
- Divide help topics at least into `syntax`, `analysis`, `next`, `editing`, `mermaid`, `workflows`, `errors`, and `samples`.
- Let each topic select index, quick, or detail information density.
- Have guide text and guide JSON share the same domain registry, reusable by
  future adapters.
- With `--format json`, return topic, summary, syntax, examples, and related topics.
- Refer to samples by stable sample ID rather than fixed absolute paths.

Contract 3 command discovery and domain guidance have separate authorities.

Must:

- Provide top-level, resource-level, and action-level command discovery through
  `perttool help` in text and JSON.
- Derive dispatch validation, text help, and JSON help from one complete typed
  command descriptor registry.
- Expose operand and option types, requiredness, repeatability, defaults,
  conflicts, input/stdin behavior, filesystem effects, result schemas, exit
  statuses, and examples.
- Move the existing domain topic graph to `perttool guide` without changing its
  stable topic IDs.
- Return the most specific structured command-help target for usage errors and
  derive suggestions only from registered commands and options.

### 16.2 Context-sensitive diagnostics

Must:

- Include stable code, severity, message, and source span in diagnostics.
- When possible, include cause, expected syntax, a repair suggestion, and a help topic.
- Direct syntax errors to local help rather than reproducing full help.
- Ensure text and JSON diagnostics have the same meaning.
- Permit a CLI option to control whether warnings count as success or failure.
- Recover multiple independent syntax errors and suppress derived diagnostics for the same error region and later validation phases.
- Permit a diagnostic-count limit and state truncation in text and JSON.

Example:

```text
PTDSL-012 error: task REQ estimate must satisfy optimistic <= most_likely <= pessimistic
  --> plan.pert:24:5
  help: perttool dsl help syntax estimate --level quick
```

## 17. AI, CLI, and future-adapter integration

### 17.1 Shared core

Adopt the following structure.

```mermaid
flowchart TD
  DOC[.pert document] --> CORE[Parser / Semantic Model / Analyzer]
  CORE --> CLI[CLI]
  CLI --> AI[AI agent via JSON]
  CORE -. post-MVP .-> MCP[MCP]
  CORE -. post-MVP .-> EDITOR[Editor / LSP]
  CORE --> CONVERT[Mermaid / JSON / SVG]
```

Must:

- Make the CLI a thin adapter that directly uses the shared core.
- Do not require starting an MCP server to use the CLI.
- Let AI use analysis results in CLI JSON without needing to generate PERT values in free text.
- Let AI obtain exact Rational values in the base unit and velocity forecasts in separate fields so that it does not mistake Points for time.
- Let AI obtain runnable tasks, recommended tasks, recommendation reasons, and higher-priority tasks from CLI JSON without needing to reassess priority from free text alone.
- Have future adapters use the same shared core and not reimplement calculation or validation rules.

### 17.2 MCP / LSP / VSIX (outside the MVP)

MCP servers, MCP tool schemas, MCP file writes, LSP servers, and VSIX/editor integration are not MVP acceptance criteria. Do not add MCP SDK, LSP transport, or VS Code extension dependencies to the MVP implementation.

When adding adapters after the MVP, do not wrap the CLI process as a subprocess; directly use the shared Application/Core API. Fix MCP-specific action names, tool schemas, write safety, and CLI parity in a separate versioned specification at that time.

Keep the following independent deliverables in the future backlog. None becomes a blocker for the first beta.

1. **LSP server**: Provide `.pert` diagnostics, completion, definition, rename, and formatting from the shared parser, validator, formatter, and TextEdit. Use UTF-16 code units for LSP positions and fix protocol capabilities and diagnostic mapping in a versioned specification.
2. **VSIX**: Provide a VS Code extension that supplies code highlighting through a TextMate grammar and starts/connects the LSP server as an LSP client. Do not duplicate language-server semantic rules in the extension; separately define VSIX packaging, supported VS Code versions, workspace trust, and server distribution.
3. **MCP server**: Start with read-only analysis/help and later provide preview mutation. Directly use the shared Application/Core API and fix tool schema, transport, capabilities, write safety, and CLI/Core parity in a versioned specification.

The LSP server and VSIX have a server/client dependency. The MCP server can be designed and implemented independently of both. Expand the priority, milestones, and estimates for each deliverable into future plans after first-beta acceptance.

## 18. JSON and schemas

The [Mutation Semantics specification](specs/mutation.md) is authoritative for
mutation Core requests, local TextEdits, comment ownership, and candidate
revalidation. The [CLI Interface specification](specs/interfaces.md) remains
the reference for Contract 2 payload meanings explicitly preserved by
Contract 3. The [CLI Contract 3 specification](specs/cli-contract-3.md)
remains authoritative for the command/operation namespace, command-help and
guide foundations, initialization result, and diagnostic links.
[Temporal and Unit Interface Contract](specs/temporal-unit-interface.md)
defines the Contract 4 temporal/unit schemas retained by Contract 5, and
[Owner-Aware Governance Interface Contract](specs/governance-interface.md)
defines the active repository-source `cli_contract_version`, ProjectResult v3,
MutationResult v2, governance decision, help, and write boundary.

Must:

- Provide JSON Schema for parse/validation reports, analysis results, next results, and conversion loss reports.
- Version JSON field names and enums.
- Include at least `schema_version`, `tool_version`, and `document_id` in JSON output that processes a document. Help/CLI usage results need not have document fields.
- Do not confuse values rounded for display with values used for calculation.
- Accompany breaking changes to JSON fields with a schema-version change.
- Keep exact base-unit values and calendar projections in distinct fields.
- Preserve the declared date/date-time form and offset where required by the
  temporal contract.
- Represent unavailable temporal projections and their reasons explicitly;
  absence, not-applicable, and invalid input must not collapse into the same
  state.

Should:

- Export the normalized graph model as JSON.
- Verify consistency between schemas and actual output with golden files.

## 19. Git workflow

Recommended workflow:

1. Edit `.pert`.
2. Run `perttool dsl check`.
3. Check `perttool dag analyze` and `perttool dag next`.
4. Generate Mermaid if needed.
5. Commit only `.pert` and the intended documents.
6. Preview `finish` when a task is complete and `advance` when a merge is established.
7. Review the diff and commit it.

Must:

- Do not create large diffs that do not require formatting or structural edits.
- Make generated artifacts distinguishable from sources of truth.
- Document that past tasks remain recoverable and comparable from Git even after they are removed.
- Make analysis itself usable in environments without Git.

Could:

- Compare changes in critical paths and expected durations between two Git revisions.
- Display structural diffs with `perttool dag diff <old> <new>`.

### 19.1 Self-use

Must:

- Start self-use with DSL grammar design and implementation tasks once the parser, structural checks, basic analysis, and next decisions are stable.
- Keep the normative grammar in `docs/specs/dsl-grammar.md`, current and future grammar work plans in `plans/grammar.pert`, and the past separately in Git history.
- Limit initial self-use to read-only check/analyze/next operations.
- Enable formatter and mutation writes only after regression tests for comment preservation, round trips, preview, revalidation, and atomic writes.
- Enable self-use of advance only after regression tests for done merges and frontier compaction.
- Do not distort the normative grammar or valid plans to accommodate tool defects.

The [self-use process](process/self-use.md) is authoritative for self-use phases and gates.

## 20. Quality requirements

### 20.1 Safety

Must:

- Do not automatically overwrite a document that fails parsing or validation.
- Have mutation operations verify target uniqueness.
- Support atomic writes and optimistic locks.
- Do not implicitly execute external commands or access the network.

### 20.2 Portability

Must:

- Run in a local CLI and CI on Linux.
- Handle UTF-8 documents.
- Do not incorporate path-separator or line-ending differences into the semantic model.

Should:

- Support macOS and Windows/WSL.
- Complete analysis of a single-project document without external services.

### 20.3 Testability

Must:

- Test the parser, validator, analyzer, formatter, and converter without a UI.
- Fix success and failure examples with manifests and golden output.
- Test cycles, diamonds, multiple critical paths, zero-duration gates, blocked tasks, done merges, and advance individually.
- Test exclusive resources, capacity of two or more, simultaneous requirements for multiple resources, active oversubscription, and schedule differences caused by capacity changes individually.
- Verify that CLI JSON and the direct Core API return semantically identical payloads for the same input.
- Regression-test the lossless Mermaid round-trip profile.

## 21. MVP acceptance criteria

MVP completion requires satisfying all of the following at a minimum.

1. Parse sample `.pert` documents and produce ASTs and source spans.
2. Model tasks as edges, milestones as nodes, gates as zero-duration edges, and resources as capacity constraints.
3. Detect duplicate IDs, undefined references, cycles, unreachable finish milestones, and invalid estimates.
4. Calculate forward/backward passes, expected values, variance, total/free float, and the critical subgraph.
5. Produce a deterministic heuristic schedule that respects renewable-resource capacity and a schedule critical path.
6. Deterministically classify active, ready, runnable_now, blocked_now, and upcoming tasks.
7. Produce analysis and next results in text and JSON.
8. Preview and safely write structural edits to projects, tasks, milestones, and resources.
9. Let advance retain done tasks required for merge decisions and remove only unneeded past portions.
10. Export to the Mermaid profile and import generated Mermaid without semantic loss.
11. Provide DSL help as topic/index/quick/detail and JSON.
12. Navigate from a parse error to the corresponding help topic.
13. Have CLI text/JSON use the shared parser/analyzer and return the same diagnostics and analysis values.
14. Fix major success cases, failure cases, and round trips with automated tests.
15. Calculate Point estimates as exact PERT values and return day/hour forecasts derived from declared velocity distinctly in text/JSON.
16. Deterministically return, in text/JSON, the task that should currently be prioritized and its reasons from project facts, and explain higher-priority tasks for tasks that are runnable but not recommended.

### 21.1 First-beta acceptance criteria

The first beta after MVP public-alpha acceptance is `0.1.0`, without a `-beta` suffix. Define the `0.x.x` series as beta and `1.0.0` or later as stable. Strict compatibility from alpha to the first beta is not required, and breaking changes necessary to clarify project semantics are allowed. However, update changed schemas, interfaces, specifications, migration methods, CHANGELOG, and regression tests in the same logical change.

Treat alpha dogfooding, local linking, GitHub prerelease, and isolated installation from the npm registry as sufficient evaluation, and do not require an additional soak period before beta begins.

The first beta includes the read-only AI Agent Guidance Registry v1 from [Issue #2](https://github.com/mako10k/perttool/issues/2) and requires at least the following.

1. Keep provider ID, support status, surface, source, and verification date for Codex, GitHub Copilot, Claude Code, Grok Build, and Antigravity as versioned snapshots.
2. Separate common surfaces for instructions, workflows, delegated agents, enforcement, prompts, and connectors from provider-specific names.
3. Return Core results with the same order and content for the same snapshot, query, and options.
4. Generate `agent help` text/JSON from the same Core result, so AI can mechanically determine availability and applicability boundaries of prompt-, skill-, agent-, and hook-equivalent facilities.
5. Complete offline without executing hooks, generating files, changing configuration, accessing the network, or writing to providers.
6. Do not unintentionally change the meaning of legacy `dsl help` or existing CLI surfaces.
7. Fix provider/source drift, aliases, unsupported/unknown states, byte determinism for identical input, and the package-installed CLI with automated tests.
8. For beta publication, use the same tarball for package checks, GitHub prerelease, the npm `beta` dist-tag, and isolated registry installation; do not change existing `latest` in that publish operation.
9. Treat promotion of `latest` after release acceptance as an independent dist-tag operation for which the user explicitly selects and authorizes the target version, not as a publish retry or stable declaration.

The [AI Agent Guidance Registry specification](specs/agent-guidance.md) is authoritative for provider/surface/guidance/risk taxonomy; structured evidence for support status; offline profiles; Core/text/JSON; diagnostics; staleness; project-guidance composition; and read-only migration boundaries. Fix conflict cases in the [normative examples](examples/agent-guidance.md).

Do not include Issue #3 backlog hierarchy/multi-plan composition, the LSP server, VSIX, MCP server, audit, scaffolding, hook execution, or enforcement as blockers for the first beta.

Migration of legacy surfaces under the English repository baseline is also excluded from this release gate. It proceeds after beta through `plans/english-baseline.pert`.

### 21.2 CLI Contract 3 acceptance criteria

CLI Contract 3 is a post-beta breaking change independent of first-beta
acceptance. It is accepted only when all of the following are true.

1. Requirements, Contract 3 specification, basic design, migration guide, and
   package documentation agree on one complete resource/action surface.
2. One command descriptor registry is authoritative for dispatch, validation,
   text help, JSON help, schemas, exits, effects, and examples.
3. `project init` creates the explicit smallest valid document through preview
   and exclusive output; its Core, result projection, exclusive-create
   composition, and internal descriptor are implemented before public
   activation.
4. Gate add/set/remove and connected atomic batches cover every gate field
   without an implicit cascade.
5. Command `help` is complete at top, resource, and action levels, while
   `guide` owns domain topics.
6. Usage errors return a stable exact help target and never suggest an
   unavailable surface.
7. All JSON envelopes identify Contract 3 and use the accepted operation
   mapping.
8. Contract 2 renamed spellings fail after the versioned cutover; no hidden
   compatibility alias remains.
9. An installed-package E2E initializes, reads, changes, analyzes, selects,
   advances, and validates a plan without manual source rewriting.
10. All `CLI3-*` normative cases in the Contract 3 specification pass.

Design-document acceptance alone does not satisfy these implementation
criteria.

### 21.3 CLI Contract 3 beta release acceptance criteria

The first package that publishes accepted CLI Contract 3 is suffix-free
`0.2.0`. It remains part of the `0.x.x` beta series, is a GitHub prerelease,
and is published to npm `beta`. The release must satisfy all of the following.

1. Align `package.json`, the lockfile root package, CLI/tool version, release
   commit, annotated `v0.2.0` tag, GitHub asset, and npm package identity.
2. Include the accepted Contract 3 command surface and installed-package
   file-first workflow without restoring Contract 2 aliases.
3. Pass `npm ci`, `npm run check`, `git diff --check`, package normalization,
   isolated installation, and file-first acceptance from the release source.
4. Establish before external mutation that `perttool@0.2.0` and `v0.2.0` are
   unused and record the current npm `beta` and `latest` baseline.
5. Push and verify one clean release commit and one annotated tag only after
   explicit user authorization for the named release batch.
6. Generate one tarball outside the worktree and distribute those exact bytes
   through the GitHub prerelease and npm `beta`.
7. Verify local, GitHub, and registry artifact identity and isolated
   installation from both public channels.
8. Verify that publication moves `beta` to `0.2.0` and leaves `latest`
   unchanged.
9. Record the durable release identity, artifact digests, registry metadata,
   public URLs, installation results, and restart observations before
   accepting the release.
10. Treat any later `latest` promotion as a separate post-acceptance mutation
    requiring an explicitly selected version and user authorization.

Planning or locally accepting this gate does not authorize Git, GitHub, npm,
or dist-tag writes. The authoritative procedure is
[`docs/process/0.2.0-release.md`](process/0.2.0-release.md).

### 21.4 CLI Contract 4 beta release acceptance criteria

The first package that publishes the accepted temporal, deadline, exact
unit-migration, and CLI Contract 4 surface is suffix-free `0.3.0`. It remains
part of the `0.x.x` beta series, is a GitHub prerelease, and is published to
npm `beta`. The release must satisfy all of the following.

1. Reach and advance the scheduling-and-units macro finish only after SU-M3
   target-Core acceptance and SU-M5 atomic public Contract 4 acceptance.
2. Publish Grammar 3, CLI Contract 4, `Perttool.AnalysisResult.v3`,
   `Perttool.NextResult.v4`, `Perttool.UnitMigrationResult.v2`, the complete
   migration guidance, and installed-package workflows together.
3. Make a complete, known, non-truncated `Perttool.NextResult.v4` the normal
   start-authority result and fail closed for unknown or incomplete results.
4. Align `package.json`, the lockfile root package, CLI/tool version, release
   commit, annotated `v0.3.0` tag, GitHub asset, and npm package identity.
5. Pass `npm ci`, `npm run check`, `git diff --check`, package normalization,
   isolated installation, temporal/deadline acceptance, exact unit migration,
   and the complete file-first Contract 4 workflow from the release source.
6. Establish before external mutation that `perttool@0.3.0` and `v0.3.0` are
   unused and record the current npm `beta` and `latest` baseline.
7. Push and verify one clean release commit and annotated tag only under
   explicit user authorization for the named `0.3.0` release batch.
8. Generate one tarball outside the worktree, distribute those exact bytes
   through the GitHub prerelease and npm `beta`, and verify isolated
   installation from both public channels.
9. Verify that publication moves `beta` to `0.3.0`, leaves `latest`
   unchanged, and does not imply stable product maturity.
10. Record durable identity, common artifact digests, registry metadata,
    public URLs, Contract 4 behavior, installation results, and restart
    observations before accepting the release.

Planning or locally accepting this gate does not authorize Git, GitHub, npm,
or dist-tag writes. The user's explicit request to proceed through
`RELEASE_030_PUBLISH` authorizes only the named `0.3.0` Git push, annotated
tag, GitHub prerelease, and npm `beta` publication batch after all preceding
gates pass. It does not authorize npm `latest` promotion. The authoritative
procedure is
[`docs/process/0.3.0-release.md`](process/0.3.0-release.md).

All ten criteria were accepted on 2026-07-26. Publication itself preserved
`latest=0.2.0` as required. After acceptance, the user separately selected
and authorized `perttool@0.3.0` for the independent `latest` dist-tag
operation; durable registry reads and an unqualified global installation
confirmed `beta=latest=0.3.0` without changing beta product maturity. The
evidence is recorded in
[`docs/process/0.3.0-release-acceptance.md`](process/0.3.0-release-acceptance.md).

### 21.5 CLI Contract 5 beta release acceptance criteria

The first package that publishes the accepted owner-aware goal/DAG mutation
governance and CLI Contract 5 surface is suffix-free `0.4.0`. It remains part
of the `0.x.x` beta series, is a GitHub prerelease, and is published to npm
`beta`. The release must satisfy all of the following.

1. Retain reached `GOVERNANCE_ACCEPTED` in `plans/governance.pert` and verify
   the accepted Grammar 4, Contract 5, public-root, safe-write, and installed
   package boundary without duplicating completed implementation task state.
2. Publish Grammar 4, declared/effective governance metadata,
   `Perttool.ProjectResult.v3`, `Perttool.MutationResult.v2`,
   `Perttool.GovernanceDecision.v1`, Contract 5 help/Guide, generated warning,
   and owner-aware persistence together.
3. Preserve Grammar 1/2/3 source compatibility through effective default
   owner `user` and empty delegates, while failing closed for unauthorized,
   malformed, invalid, or stale persistent goal/DAG mutations.
4. Retain authentication, verified identity, signatures, durable approval
   audit, direct-edit prevention, recommendation override apply, MIG-08, Git
   integration, Issue synchronization, and adapters as explicit non-goals.
5. Align `package.json`, the lockfile root package, CLI/tool version, release
   commit, annotated `v0.4.0` tag, GitHub asset, and npm package identity.
6. Provide explicit Contract 4-to-5 migration guidance for envelope/result
   schemas, owner fields, `--actor`, repeatable `--accepted-by-owner`, and the
   absence of a Contract 4 runtime switch or compatibility alias.
7. Pass `npm ci`, `npm run check`, `git diff --check`, package normalization,
   isolated installation, owner/delegate/default/stale-digest/batch
   acceptance, exact unit-migration preservation, complete NextResult v4,
   and the file-first Contract 5 workflow from one clean release source.
8. Establish before external mutation that `perttool@0.4.0`, `v0.4.0`, and
   the matching GitHub Release are unused; record npm `beta`, `latest`, and
   `alpha`; and verify the protected credential routes without displaying
   secrets.
9. Generate one immutable tarball outside the worktree, verify it before the
   first external write, distribute those exact bytes through the GitHub
   prerelease and npm `beta`, and verify isolated installation from both
   public channels.
10. Push and verify one clean release commit and annotated tag only under
    separate explicit user authorization for the named `0.4.0` external
    publication batch.
11. Verify that publication moves `beta` to `0.4.0`, leaves `latest`
    unchanged at `0.3.0`, and does not imply stable product maturity.
12. Record durable identity, common artifact digests, registry metadata,
    public URLs, Contract 5 behavior, installation results, and restart
    observations before accepting the release.

Planning or locally accepting this gate does not authorize Git, GitHub, npm,
dist-tag, or Issue writes. The user's 2026-07-27 requests authorized
`RELEASE_040_GATE_DESIGN` and `RELEASE_040_CONTRACT_5_READINESS`; the
first 2026-07-28 instruction to perform the next release task authorized
`RELEASE_040_PREPARATION`, and the later instruction to continue after the
candidate-only scope was stated authorized `RELEASE_040_CANDIDATE`.
After the PUBLISH boundary was stated again, the user's 2026-07-28
instruction to proceed separately authorized and completed only the named
`0.4.0` external publication batch. The release commit and peeled tag agree;
the candidate, GitHub, and npm tarballs are byte-identical; and npm reports
`beta=0.4.0` with unchanged `latest=0.3.0`. Release acceptance, npm `latest`
promotion, and Issue #4 closure remain distinct decisions. The authoritative
procedure and publication evidence are
[`docs/process/0.4.0-release.md`](process/0.4.0-release.md) and
[`docs/process/0.4.0-publish.md`](process/0.4.0-publish.md).

## 22. Mapping to the initial requirements

| Initial requirement | Coverage in this document |
| --- | --- |
| 1. Define DAG-generation notation | 2, 6, 7, 8 |
| 2. Perform PERT analysis mechanically | 10 |
| 3. Make task edges easy to change | 7.4, 8, 12 |
| 4. Make DAG notation easy to visualize | 2.1, 8, 13 |
| 5. Convert to and from Mermaid and similar formats | 14 |
| 6. Recalculate from documents | 2.2, 18, 19 |
| 7. Make the next task easy to understand | 2.4, 11 |
| 8. Represent the present and future and supplement the past with Git | 2.3, 9, 19 |
| 9. Follow existing DSL-tool help and AI pathways | 15, 16, 17, 19.1 |
| 10. Handle schedules that change with shared resources, exclusive execution, and concurrency | 7.2, 7.4, 10.6, 11 |
| 11. Convert AI estimates to time forecasts with custom Points and Velocity | 6, 7.1, 8, 10, 17 |
| 12. Detect and restrain AI local optimization and schedule deviation | 1, 2.4, 3, 4, 5.4, 11, 17, 21 |
| 13. Use English as the canonical repository language without i18n | 2.5, 4, 21.1 |

## 23. Items deferred until after the MVP

- Calendars with business days, holidays, and working hours
- Per-task calendars and time zones
- Actual task-start, task-finish, and milestone-reach event history
- Recurring deadlines, reminders, and external calendar synchronization
- Time-varying resource capacity and resource availability dates
- Advanced resource modeling including shifts, skills, and assignee calendars
- Exact optimization of resource-constrained schedules
- Include/import for multiple project documents
- Statistical analysis of actual time and forecast accuracy
- Velocity by team/resource, period, and history
- Plan-diff analysis between Git revisions
- Web UI and collaborative editing
- Broad import of arbitrary Mermaid syntax
- Project-completion probability by Monte Carlo simulation
- Bi-directional synchronization with external issue trackers
- MCP server, MCP tool schemas, MCP file writes, LSP server, and VSIX/editor adapters

## 24. Undecided design decisions

There are no undecided design decisions that currently prevent starting MVP implementation. If a new semantic decision is needed during implementation, update an ADR or an individual specification first rather than fixing it only in code.

The SU-M1 temporal and unit-migration extension has accepted its property
scope, deterministic calendar and deadline semantics, exact source-unit
migration semantics, public interface contract, dependency-ordered normative
examples, and
[cross-cutting review](process/scheduling-units-m1-acceptance.md).
The atomic Contract 4 acceptance gate is complete: Grammar 1, 2, and 3,
AnalysisResult v3, NextResult v4 normal authority, exact unit migration, and
the installed-package workflow are active in `0.3.0`.

Resolved design decisions:

- Adoption of AoA with task=edge: [ADR 0001](adr/0001-activity-on-arrow.md)
- Node.js 22 or later, npm, TypeScript ESM package: [ADR 0005](adr/0005-node-22-runtime-baseline.md)
- Suffix-free `0.x.x` beta, alpha compatibility boundary, and `v0.2.0`
  Contract 3 through `v0.4.0` Contract 5 release targets:
  [ADR 0003](adr/0003-beta-versioning.md)
- English repository baseline, migration boundary, and current i18n non-goal: [ADR 0004](adr/0004-english-repository-baseline.md)
- Separation of executability, resource selection, and recommendation level, and tier semantics: [Recommendation Semantics specification](specs/recommendation.md)
- Ranking inputs, selection horizon, priority rules, complete tie-breaking, and algorithm version: [Recommendation Ranking Policy specification](specs/recommendation-ranking.md)
- Stable reason codes, effect/role, typed fact categories, entity references, and taxonomy version: [Recommendation Reason Taxonomy specification](specs/recommendation-reasons.md)
- Typed facts, restricted expressions, comparisons, decision traces, and description projection: [Recommendation Structured Explanation specification](specs/recommendation-explanation.md)
- Core types, complete JSON, text summaries, and `NextResult.v3` migration: [Recommendation Interface Contract specification](specs/recommendation-interface.md)
- Override requirements, feasible replacements, human reasons, audit, and reanalysis: [Recommendation Human Override Contract specification](specs/recommendation-override.md)
- Mermaid semantic records, canonical JSON, digests, projection, and fail-closed import: [Mermaid Profile specification](specs/mermaid-profile.md)
- Provider/surface/guidance/risk taxonomy, support evidence, offline profile, and Core/text/JSON contracts: [AI Agent Guidance Registry specification](specs/agent-guidance.md)
- Complete command discovery, domain-guide separation, file-first initialization and gate maintenance, naming, effects, schemas, and breaking migration: [CLI Contract 3 specification](specs/cli-contract-3.md)
- Contract 3 package identity, authorization, artifact parity, distribution, and acceptance: [`v0.2.0` release procedure](process/0.2.0-release.md)
- Contract 4 package identity, authorization, artifact parity, distribution, and acceptance: [`v0.3.0` release procedure](process/0.3.0-release.md)
- Contract 5 package identity, authorization, artifact parity, distribution,
  and acceptance:
  [`v0.4.0` release procedure](process/0.4.0-release.md)
- Date/date-time comparison, `as_of`, exact day/hour/point projection, fixed-offset preservation, continuous-calendar boundaries, and `not_before` release bounds: [Temporal Calendar Semantics specification](specs/temporal-calendar.md)
- Temporal precedence/resource release scheduling, deadline state, exact margin/lateness, feasibility, blocked/heuristic qualification, risk, and recommendation-version boundary: [Temporal Deadline Semantics specification](specs/temporal-deadline.md)
- Permitted Point/time directions, effective velocity, complete field inventory, exact Decimal-or-fraction conversion, atomic grammar upgrade, and round-trip qualification: [Point and Time-Unit Migration Semantics specification](specs/unit-migration.md)
- Grammar versions 2 and 3, CLI Contract 4, Core boundaries, temporal/unit text and JSON projections, mutation, help, diagnostics, and authority migration: [Temporal and Unit Interface Contract](specs/temporal-unit-interface.md)
- Calendar, deadline, start-authority, exact-migration, failure, idempotence, and deterministic projection cases: [Normative Temporal and Unit-Migration Examples](examples/temporal-units.md)
- Complete requirements/specification/example/interface trace, resolved delivery sequencing, and implementation handoff: [SU-M1 Temporal and Unit-Migration Contract Acceptance Review](process/scheduling-units-m1-acceptance.md)
- Governance principal syntax, Grammar 4 fields, declared/effective defaults, source preservation, initialization warning, project metadata, and pre-change snapshot: [Governance Source and Effective-Metadata specification](specs/governance-source.md)
- Goal/DAG classification, pre-change authority, mixed-scope decisions, preview behavior, and stable denial: [Owner-Aware Mutation Governance Semantics specification](specs/governance-authority.md)
- Core assertions, CLI Contract 5, project/mutation schemas, help, diagnostics, exits, and atomic activation: [Owner-Aware Governance Interface Contract](specs/governance-interface.md)
- Defaults, preview, owner/delegate assertions, atomic batches, safe-write composition, ordinary operations, and direct-edit guidance: [Normative Owner-Aware Governance Examples](examples/governance.md)
- Complete Issue #4 criteria, interface invariants, non-goals, resolved cross-cutting findings, and implementation handoff: [Issue #4 Owner-Aware Governance Design Acceptance Review](process/governance-design-acceptance.md)
- Atomic Grammar 4 and CLI Contract 5 source/package-root activation, installed-package evidence, and retained release boundary: [Issue #4 Governance Implementation Acceptance](process/governance-acceptance.md)

## 25. Recommended next specification work

Before implementation, separate the specifications in the following order.

1. [x] `docs/specs/dsl-grammar.md`: complete EBNF, resource syntax, and normative samples
2. [x] [Graph Semantics specification](specs/graph-semantics.md): formal definitions of reached, ready, done, gate, advance, and resources
3. [x] [Analysis specification](specs/analysis.md): PERT/CPM, resource schedules, resource arcs, and tie-breaking
4. [x] [CLI Interface specification](specs/interfaces.md): CLI, JSON Schema, help, and write safety; MCP is outside the MVP
5. [x] [ADR 0001](adr/0001-activity-on-arrow.md): task=edge design decision
6. [x] [Issue #1](https://github.com/mako10k/perttool/issues/1): recommendation contract for the AI Project Control Plane
   - [x] Product vision, source of truth, global objective, determinism, and non-goals
   - [x] [Executability and recommendation model](specs/recommendation.md)
   - [x] [Deterministic ranking policy](specs/recommendation-ranking.md)
   - [x] [Stable reason-code taxonomy](specs/recommendation-reasons.md)
   - [x] [Structured reason descriptions and decision traces](specs/recommendation-explanation.md)
   - [x] [Core, text, and JSON contract](specs/recommendation-interface.md)
   - [x] [Human-override contract](specs/recommendation-override.md)
   - [x] [Normative examples and test perspectives](examples/recommendation.md)
   - [x] [Self-use and implementation-migration policy](process/recommendation-migration.md)
   - [x] [Cross-cutting design review and acceptance record](process/recommendation-design-review.md)
7. [x] Minimal parser/validator implementation and golden tests
8. [x] [Mutation Semantics specification](specs/mutation.md): project/task/gate/milestone/resource mutation, atomic batch, UTF-16 TextEdits, comment ownership, and candidate revalidation
9. [x] [Mermaid Profile specification](specs/mermaid-profile.md): `%% perttool:` semantic records, canonical JSON, integrity, projection, and lossless-import boundary
10. [x] Mermaid export: `exportMermaid`, `dag render --to mermaid`, profile/plain loss reports, analysis annotation, and exclusive `--out`
11. [x] Mermaid import: `importMermaid`, `dag import --from mermaid`, fail-closed profile restoration, plain loss reports, and round-trip E2E
12. [x] [CLI Contract 3 design](specs/cli-contract-3.md): complete target surface, descriptor registry, command help, domain guide, project initialization, gate maintenance, migration boundary, and normative acceptance cases
13. [x] Temporal properties, deadlines, and unit migration SU-M1 contract
    - [x] Temporal properties, entity scope, meanings, compatibility boundary, and non-goals
    - [x] [Deterministic date/date-time, `as_of`, timezone, and calendar semantics](specs/temporal-calendar.md)
    - [x] [Deadline-derived analysis and recommendation semantics](specs/temporal-deadline.md)
    - [x] [Exact point and time-unit source-migration semantics](specs/unit-migration.md)
    - [x] [Grammar, Core, CLI, help, diagnostics, and result-projection contract](specs/temporal-unit-interface.md)
    - [x] [Normative boundary examples and machine-readable acceptance cases](examples/temporal-units.md)
    - [x] [Cross-cutting SU-M1 contract review](process/scheduling-units-m1-acceptance.md)
14. [x] Exact rational Duration SU-M2R contract refinement
    - [x] Grammar version 3 Decimal-or-fraction Duration syntax and canonical serialization
    - [x] Unit-migration version 2 grammar-upgrade and reversibility semantics
    - [x] Temporal/unit interface version 2 and UnitMigrationResult v2 identities
    - [x] Revised TUI/TUE acceptance observations and machine baseline
15. [x] Atomic Contract 4 public cutover and installed-package acceptance
    - [x] Active Grammar 1/2/3 parsing, validation, formatting, and mutation
    - [x] Public AnalysisResult v3, NextResult v4, and UnitMigrationResult v2
    - [x] Registry, help, Guide, README, diagnostics, and normal start authority
    - [x] Installed-package file-first workflow and durable SU-M5 acceptance
16. [x] Owner-aware goal and DAG mutation governance
    - [x] Requirements and accidental-overreach threat boundary
    - [x] Goal/DAG change classification and pre-change authority semantics
    - [x] Grammar 4 source and declared/effective metadata contract
    - [x] [Core, CLI, help, JSON, and diagnostic interface contract](specs/governance-interface.md)
    - [x] [Normative authority and write-path examples](examples/governance.md)
    - [x] [Cross-cutting Issue #4 design acceptance](process/governance-design-acceptance.md)
    - [x] Source, evaluator, preview, write, guidance, and installed acceptance

Item 7 is complete. It fixed `dsl check`, source-backed CST/AST, resolver/validator, `dsl help syntax`, multiple-error recovery, validation-phase suppression, diagnostic limits, common indentation and UTF-16 spans for block text, the source-preserving formatter Core, formatter idempotence and AST-equivalence goldens, as well as syntax-help samples, related links, diagnostic `helpTopic`, and drift checks for parser fixtures, satisfying all grammar-acceptance items.

Item 8 completed its foundation with `TASK_MUTATION_CORE` and `ENTITY_MUTATION_CORE`, added gate add/set/remove Core through `MUT_002_GATE_MAINTENANCE`, and added read-only `project show` and source-preserving `project set` through project-metadata extensions. The Core contract also added an atomic batch that validates only the final candidate for connected-milestone task/gate additions, path replacements, and project-wide unit changes that cannot independently produce valid intermediate DAGs. `MUTATION_CLI_PREVIEW` exposed entity commands and the former `mutation apply` path through preview-first text/JSON surfaces, and `SAFE_WRITE_ACCEPTANCE` connected the same candidate to atomic `--write`, exclusive `--out`, and `--expect-digest`. The Contract 3 cutover now exposes direct gate commands and `batch apply` through that shared path. Item 10 fixed all semantic records in the profile, stable projection, both digests, exact values, and text/JSON parity with golden/unit/E2E tests. Item 11 fail-closedly verifies canonical profile JSON, record order, both digests, semantic-model and projection correspondence, and fixes stable generated IDs and loss reports for plain input, strict-loss, and exclusive `--out` in Core/CLI/E2E.

The analysis implementation has progressed through public `dag next` v4 and read-only `validateOverride`. In addition to Exact Rational values, PERT expected values/variance, precedence CPM, critical-path counts, deterministic resource schedules, capacity overrides, resource arcs, schedule critical paths, next classification, `runnable_now`, resource rejection, and upcoming explanations, it exposes exact temporal schedules, deadline evaluation, release eligibility, and the complete temporal start-authority graph through Core, CLI JSON/text, help, and package. A complete known non-truncated `Perttool.NextResult.v4` is normal authority, and override validation cannot bypass future or unavailable release eligibility. It also exposes `Perttool.OverrideDecision.v1` validation through the public library. It satisfies Slice 2's bootstrap gate, grammar acceptance, safe-write gate, and advance gate, and performs Stage 3 preview-first self-use of advance. Issue #1's product vision, requirement boundary, executability and recommendation model, ranking policy, reason-code taxonomy, structured explanation, Core/text/JSON interface, human-override contract, normative examples, test perspectives, and self-use and implementation-migration policy were accepted in the [cross-cutting design review](process/recommendation-design-review.md). The missing acceptance criterion 16 found by the [MVP release-readiness audit](process/mvp-release-readiness.md) was resolved with all 22 points of MIG-01 through MIG-07 in the [Recommendation implementation plan](../plans/recommendation.pert), five plan shadows, read-only override validation, normal-authority adoption, and an unknown-version safe-stop dry run. The provisional measured Velocity specific to Recommendation is `22p/1d`, with zero detail work remaining. MVP public-alpha acceptance is complete because the same `v0.1.0-alpha.2` artifact was published to the GitHub prerelease and npm `alpha`, including isolated installation from the registry.

[ADR 0003](adr/0003-beta-versioning.md) defines the first beta as suffix-free `0.1.0` and subsequent `0.x.x` versions as beta releases. Issue #2's read-only AI Agent Guidance Registry v1 and the [`v0.1.0` beta distribution](process/beta-release-acceptance.md) are accepted. The macro plan is complete and has no remaining task. The independent English-baseline plan has completed and advanced `SURFACE_INVENTORY`, `NORMATIVE_DOCS`, `PROCESS_AND_GUIDANCE_DOCS`, `RUNTIME_MESSAGES`, and `HELP_AND_USAGE`, and currently recommends `PERT_PLANS`. Issue #3, the LSP server, VSIX, and MCP server remain independent post-beta backlogs.

The accepted Contract 3 source and package workflow published suffix-free beta
`0.2.0` as the first Contract 3 package. All five tasks in
[`plans/release-0.2.0.pert`](../plans/release-0.2.0.pert) completed and
advanced after verifying release commit/tag identity, common local/GitHub/npm
tarball bytes, installed Contract 3 and file-first behavior, `beta=0.2.0`, and
unchanged publication-time `latest=0.1.0`. After acceptance, the user
separately authorized promotion of the accepted version, and npm now reports
`beta=latest=0.2.0`. The completed release plan has no recommendation and was
not changed by that independent dist-tag operation. The
[`v0.2.0` acceptance record](process/0.2.0-release-acceptance.md) preserves the
durable evidence.

The accepted Contract 4 source and package workflow published suffix-free beta
`0.3.0` from one byte-identical local, GitHub, and npm tarball. All six tasks
in [`plans/release-0.3.0.pert`](../plans/release-0.3.0.pert) are complete and
advanced; the plan has zero makespans and no recommendation at `19p/2d`.
Publication moved only `beta` and preserved `latest=0.2.0`. After acceptance,
the user separately authorized the default-tag mutation, and npm now reports
`beta=latest=0.3.0`; an unqualified global installation and light Contract 4
smoke passed. The
[`v0.3.0` acceptance record](process/0.3.0-release-acceptance.md) preserves the
durable evidence.

The accepted repository source and locally packed package now activate
Grammar 4 and CLI Contract 5 atomically. The independent
[`plans/release-0.4.0.pert`](../plans/release-0.4.0.pert) release workstream
selected and published suffix-free beta `0.4.0` after verifying the completed
governance acceptance, one clean candidate, and one immutable tarball. npm
reports `beta=0.4.0` with unchanged `latest=0.3.0`; durable release acceptance
remains the only release-plan task. npm `latest` promotion and Issue #4
closure remain independent post-acceptance decisions.
