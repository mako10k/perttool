# Recommendation Structured Explanation Specification

- Document status: Normative 1.0
- Explanation model version: 1
- Expression version: 1
- Description registry version: 1
- Created: 2026-07-22
- Related requirements: [../requirements.md](../requirements.md)
- Recommendation semantics: [recommendation.md](recommendation.md)
- Recommendation ranking: [recommendation-ranking.md](recommendation-ranking.md)
- Reason taxonomy: [recommendation-reasons.md](recommendation-reasons.md)
- Recommendation interface: [recommendation-interface.md](recommendation-interface.md)
- Human override: [recommendation-override.md](recommendation-override.md)
- Related issue: [Issue #1](https://github.com/mako10k/perttool/issues/1)

## 1. Purpose

This specification defines a structured explanation model so that a recommendation conclusion is not limited to stable reason codes and AI agents and people can answer "why this task rather than another task?" without re-deriving the ranking.

It defines the following:

- typed facts with exact values and provenance
- restricted boolean expressions over facts
- decision steps showing application of versioned rules
- comparisons with a winner, alternative, decisive rule, and contributing rules
- decision traces that reproduce recommended-set selection and tier assignment
- derived text from stable description keys and typed parameters
- boundaries for determinism, versioning, integrity, and truncation

This specification defines the semantic model. The [Recommendation Interface Contract Specification](recommendation-interface.md) defines Core type names, JSON field names, text layout, CLI options, and schema migration.

## 2. Normative position

Resolve semantic or design conflicts in the following order:

1. Must requirements in `docs/requirements.md`
2. [Recommendation Semantics Specification](recommendation.md)
3. Ranking semantics in the [Recommendation Ranking Policy Specification](recommendation-ranking.md)
4. Reason-code and fact-category semantics in the [Recommendation Reason Taxonomy Specification](recommendation-reasons.md)
5. This specification
6. Analysis, Interface, basic design, examples, tests, help, and implementation

This specification does not redefine ranking-factor precedence, reason-code emission conditions, or recommendation tiers.

## 3. Scope

In scope:

- normal recommendation decisions for each actual `ready` task
- selection of the result-level recommended set `R`
- explanation of ranking, selection horizon, resource feasibility, and tier classification
- reference relationships among stable reason occurrences, facts, comparisons, and decision steps
- the non-text contract from which human-readable descriptions are derived
- a contract that lets AI agents mechanically read comparison subjects and decision conditions

Out of scope:

- changing recommendation ranking
- adding codes to the reason taxonomy
- audit traces for human overrides
- concrete Core, CLI, or JSON schemas
- actual per-locale templates and translation catalogs
- explanation levels, byte limits, and default text-display volume
- replacing lifecycle upcoming explanations for non-ready tasks
- recommendation implementation

## 4. Model identity and overall structure

Version 1 has the following identity:

```text
explanation_model_version     = 1
expression_version            = 1
description_registry_version  = 1
```

The conceptual model has the following reference graph:

```text
Recommendation explanation
├── result decision
├── task decisions[]
│   ├── decision steps[]
│   ├── reason occurrences[]
│   ├── comparison references[]
│   └── description projection
├── facts[]
└── comparisons[]
```

Facts are values derived from a project snapshot or versioned analysis; expressions are evaluable conditions over facts; a decision step is one application of a versioned rule; a reason occurrence is a Taxonomy code and its role in the decision; and a comparison represents a contrast between tasks or between set/resource decisions.

Natural-language descriptions are derived projections from this graph and MUST NOT be inputs from which to reconstruct the graph.

## 5. Stable identity

Within each request, assign fact IDs, decision IDs, decision-step IDs, reason-occurrence IDs, comparison IDs, and description-projection IDs.

Derive identities deterministically from the following semantic components:

- subject entity kind and stable ID
- fact kind or rule ID
- ranking phase or tier phase
- the alternative entity's stable ID, when an alternative entity exists
- the canonical occurrence index defined by the versioned rule when the same semantic key occurs more than once

Do not use random UUIDs, array insertion order, locale text, display decimals, or memory addresses for identity. The [Recommendation Interface Contract Specification](recommendation-interface.md) defines encoding into external strings.

## 6. Typed fact

### 6.1 Fact occurrence

A fact occurrence has at least the following semantics:

```text
fact_id
fact_kind
subject_entity
value
unit
provenance
```

`fact_kind` references a typed fact or factor registered in the Reason Taxonomy or Ranking Policy. `subject_entity` is a kind-qualified entity reference. Apply `unit` only when a Rational or integer represents a quantity with a unit; it does not apply to dimensionless values.

### 6.2 Value type

Version 1 fact values are limited to the following finite types:

- boolean
- arbitrary-precision integers
- exact Rationals
- finite enums
- kind-qualified entity references
- finite ordered lists of values of the same type above
- finite sets of values of the same type above
- finite maps from stable keys such as resource IDs to values of the same type above

Do not use binary floating point, NaN, numeric infinity, locale-formatted strings, free-form text, or opaque objects as fact values. Treat structural-distance `infinity` as a finite enum sentinel defined by the Ranking Policy.

Sets are semantically unordered. Canonical projections stabilize them by value type, entity kind, stable ID, and exact value, in that order. Use an ordered list only when a rule explicitly gives order semantic meaning.

### 6.3 Provenance

Provenance identifies the value's derivation source as one of the following:

- `document`: explicit fields, stored state, and dependencies of DSL entities
- `precedence_analysis`: analysis version and source entity
- `ranking_algorithm`: ranking algorithm ID/version and rule/factor ID
- `resource_snapshot`: applied capacity options, active allocations, and selected-set snapshots
- `recommendation_model`: set membership, tiers, and derived invariants

Provenance MUST identify the source digest, related entity reference, and algorithm/model version either on the fact itself or by reference to result-level context. Source spans may apply only to document facts according to the [Recommendation Interface Contract Specification](recommendation-interface.md), but the distinction between a document fact and an analysis fact MUST NOT be lost.

## 7. Restricted expression

### 7.1 Purpose and restrictions

An expression is a boolean AST that mechanically re-evaluates the conditions that emitted a reason and the result of a decision step. Version 1 has only the following nodes:

```text
ScalarTerm = FactReference | Literal

Expression =
  Compare(ScalarTerm, relation, ScalarTerm)
  All(Expression[])
  Any(Expression[])
```

`Literal` is a value of a type defined in section 6.2. `FactReference` refers to a fact ID in the same explanation graph.

### 7.2 Relations

Version 1 limits relations to the following:

| Relation | Applicable types | Meaning |
| --- | --- | --- |
| `equal` | all values of the same type | exactly equal |
| `not_equal` | all values of the same type | not exactly equal |
| `less_than` | integer, Rational, registered ordered enum | left is less than right |
| `less_or_equal` | integer, Rational, registered ordered enum | left is less than or equal to right |
| `greater_than` | integer, Rational, registered ordered enum | left is greater than right |
| `greater_or_equal` | integer, Rational, registered ordered enum | left is greater than or equal to right |
| `contains` | set or map and element/key | left contains right |

Treat comparisons between values of different types, numeric values with different units, and ordering comparisons on unordered enums as expression invariant failures.

### 7.3 Evaluation

- `Compare` resolves both terms and evaluates their exact relation.
- `All` requires at least one child and is true if and only if every child is true.
- `Any` requires at least one child and is true if and only if at least one child is true.
- Treat `All` or `Any` with empty children as an expression invariant failure.
- Do not convert a missing fact, unknown relation, or type mismatch to false.
- An emission expression referenced by a reason occurrence MUST be true.
- A decision step has the observed result of its expression, which MUST match its re-evaluated result.

The AST is an acyclic tree with maximum depth 8. Function calls, variables, assignments, arithmetic, regexes, scripts, current time, external lookups, and natural-language predicates are not permitted. Derive necessary computed values beforehand as typed facts in versioned analysis/ranking.

## 8. Comparison

A comparison has at least the following semantics:

```text
comparison_id
scope
subject_task
alternative_task
winner_task
loser_task
decisive_rule
decisive_expression
prior_tied_rules
contributing_rules
fact_references
```

`scope` is one of `ranking | selection_horizon | resource_selection | tier`. For a resource rejection caused only by active allocation, where no comparison between tasks applies, `alternative_task`, `winner_task`, and `loser_task` do not apply; show the active blocker entity and resource witness through fact references. Do not fabricate a task winner.

`decisive_rule` is the registered rule ID that first separated the result. `prior_tied_rules` are rules evaluated before the decisive rule that tied, and `contributing_rules` are rules after the decisive rule that support the winner. The Ranking Policy's `supporting_rules` correspond in the Reason Taxonomy to reason occurrences with `effect=supporting` and `role=contributing`.

A comparison does not imply that its winner is recommended. Keep ranking winner, horizon membership, resource-scan selection, and final tier independent.

## 9. Decision trace

### 9.1 Decision

The result-level decision covers recommended set `R` and joint feasibility; a task-level decision covers a ready task's set membership and tier. A task decision has at least the following semantics:

```text
decision_id
subject_task
action = start
classification = ready
recommendation_tier
recommended_set_membership
steps
decisive_step
reason_occurrences
comparison_references
primary_higher_priority_task
description_projection
```

`primary_higher_priority_task` applies only in the following cases:

- task outside the horizon: the first task in the candidate order within the horizon
- resource rejection within the horizon: the first ready-task contributor defined by the Ranking Policy
- modeled negative fact: does not apply
- rejection caused only by active allocation: does not apply

When it does not apply, do not infer or fill in another task.

### 9.2 Decision step

A decision step has the following semantics:

```text
step_id
phase
rule_reference
input_fact_references
expression
result
effect
role
reason_occurrence_references
comparison_references
depends_on_steps
```

`phase` has the following fixed order:

1. `eligibility`
2. `negative_fact_filter`
3. `selection_horizon`
4. `candidate_ranking`
5. `resource_selection`
6. `set_membership`
7. `tier_classification`

`effect` and `role` use the definitions in the Reason Taxonomy. `depends_on_steps` is a DAG that references only prior steps and does not permit cycles. A trace is invalid if a complete typed fact cannot be reached from the `decisive_step` or tier conclusion.

### 9.3 Required trace by tier

`recommended`:

- an eligibility step for `task_ready`
- a ranking-support step showing selection-horizon membership
- a set-membership step for `recommended_set_selected`
- a reference to result-level `recommended_set_feasible`

`allowed`:

- an eligibility step for `task_ready`
- a decisive comparison with the primary higher-priority task or horizon rule
- a set-membership step for `recommended_set_not_selected`
- an addition-feasibility step for `startFeasible(R union {t}) == true`

`deferred`:

- an eligibility step for `task_ready`
- a set-membership step for `recommended_set_not_selected`
- a decisive step for `policyDefers(t) == true` or `startFeasible(R union {t}) == false`
- for a resource conflict, all violated resource witnesses and active/selected contributors

`discouraged`:

- an eligibility step for `task_ready`
- a set-membership step for `recommended_set_not_selected`
- a decisive step for a registered negative fact and applied rule

Because Taxonomy version 1.0 has no registered negative facts, normal results do not generate a `discouraged` trace.

### 9.4 Minimal comparison witness

Every non-recommended task has at least one comparison or resource/negative witness that determined its non-selection.

- an allowed/deferred task outside the horizon has a direct comparison with the first horizon task
- a resource rejection within the horizon has the preceding selected contributor and a resource-capacity witness
- a rejection caused only by active allocation has an active task and resource witness, but no ready-task winner
- a negative fact has the relevant fact/rule and does not point to an unrelated higher-priority task

Additional comparisons between any two tasks can be deterministically derived from the Ranking Policy's complete order. The Version 1 result defined by the [Recommendation Interface Contract Specification](recommendation-interface.md) completely includes comparisons and minimal witnesses that occurred in actual set/tier decisions, but does not include all-pairs comparisons for every task pair not used in the decision or query options. Do not omit a minimal witness and require consumers to re-derive the full ranking.

## 10. Reason occurrence

A reason occurrence has at least the following meaning.

```text
reason_occurrence_id
reason_code
subject_entity
effect
role
fact_references
emission_expression
decision_step_reference
comparison_references
description_projection_if_applicable
```

- The `subject_entity` of a task-level reason is the task; the result-level `recommended_set_feasible` is the derived set `R`.
- `reason_code` is registered in the declared Taxonomy version.
- `effect` and `role` are a combination permitted by the code.
- `emission_expression` can be re-evaluated as true from facts.
- A `decisive` reason always connects to the decisive step or one of its ancestor steps.
- Do not mix outcome codes and causal codes in the same occurrence.
- Require a description projection only when the Version 1 registry has a corresponding reason-level description key. Always require a summary description for a task decision.
- Do not use natural-language text as a substitute for a fact reference or expression.

Stabilize reason-occurrence order by decision phase, rule order, subject entity kind, subject stable ID, alternative task ID, reason code, and occurrence ID.

## 11. Description projection

A description projection is input for deterministically generating human-facing text and has the following meaning.

```text
description_key
description_registry_version
parameters
source_reason_occurrences
source_comparisons
```

Parameter values are limited to the types in Section 6.2, and names use ASCII lower snake case. Stabilize maps in ASCII lexical order of parameter names. Task titles and resource titles may be added as display entity lookups, but do not use them as substitutes for stable IDs.

### 11.1 Version 1 key registry

| Description key | Applicability | Required parameters |
| --- | --- | --- |
| `recommendation.summary.recommended` | task tier is `recommended` | `task_id`, `decisive_rule_id` |
| `recommendation.summary.allowed` | task tier is `allowed` | `task_id`, `higher_priority_task_id`, `decisive_rule_id` |
| `recommendation.summary.deferred_resource` | `deferred` by a resource conflict | `task_id`, `resource_ids`, `higher_priority_task_ids`, `active_blocker_task_ids`. At least one of the latter two is nonempty. |
| `recommendation.summary.deferred_policy` | `deferred` by a policy defer | `task_id`, `decisive_rule_id` |
| `recommendation.summary.discouraged` | `discouraged` by a modeled negative fact | `task_id`, `negative_fact_kind`, `decisive_rule_id` |
| `recommendation.reason.ranking_comparison` | ranking comparison between tasks | `winner_task_id`, `alternative_task_id`, `rule_id`, `winner_value`, `alternative_value`, `relation` |
| `recommendation.reason.resource_conflict` | set addition is resource-infeasible | `task_id`, `resource_id`, `capacity`, `used`, `required`, `deficit`, `occupant_task_ids` |
| `recommendation.reason.policy_deferral` | `policyDefers(t) == true` | `task_id`, `rule_id` |
| `recommendation.reason.negative_fact` | a registered negative fact applies | `task_id`, `negative_fact_kind`, `rule_id` |

The `decisive_rule_id` of a `recommended` summary identifies the rule that decided membership during the selection horizon or resource scan. Do not merely use the `recommended_set_selected` outcome code instead of a rule.

When a parameter name ends in `task_id`, `resource_id`, `rule_id`, `negative_fact_kind`, or their plural forms, its value is not a bare string but the corresponding kind-tagged entity reference or finite collection of such references. `relation` is a registered enum; quantitative values use the same exact numeric value and unit as the facts.

The Version 1 Ranking Policy does not produce a case where an allowed task has no defined primary higher-priority task. If a future algorithm permits that case, update the description registry version rather than silently omitting a required parameter.

### 11.2 Derived text

The renderer produces text by applying typed parameters to the versioned template for the description key.

- Locale selection changes only the presentation of the same typed input, not the tier, reason, comparison, or step.
- A Rational preserves its exact numerator and denominator; display precision is derived information.
- Do not infer a conversion from an unknown description key to another key.
- When a template or locale is unavailable, make the raw key and typed parameters displayable; do not fabricate meaning.
- Do not retain only text and discard source occurrences and comparisons.

The [Recommendation Interface Contract Specification](recommendation-interface.md) fixes the canonical default locale, template wording, and default text/JSON presentation.

## 12. Deterministic ordering and deduplication

The canonical order of the semantic model is as follows.

1. task decision: complete candidate order of the Ranking Policy; task ID order when not applicable
2. decision step: the phase from Section 9.2, rule order, then step ID
3. comparison: scope, subject task ID, alternative task ID, decisive rule ID, then comparison ID
4. fact: fact kind, subject entity kind, subject stable ID, then fact ID
5. reason occurrence: the order from Section 10
6. description parameter: parameter name

Do not deduplicate occurrences with the same reason code when their subject, role, expression, or comparison differs. Collapse only occurrences whose semantic identity components all match.

## 13. Completeness and truncation boundary

The Core semantic explanation completely contains the tier-required traces in Section 9.3 and the minimal comparison witnesses in Section 9.4. Do not silently omit any part of a decisive chain, a required fact, or a resource-conflict witness.

An adapter may truncate a display projection only when permitted by the [Recommendation Interface Contract Specification](recommendation-interface.md). Even then, it satisfies the following.

- Do not truncate the source semantic model.
- State that truncation occurred and how many items were omitted.
- Retain the tier, primary reason, decisive rule, and primary higher-priority task or blocker.
- Provide a means to retrieve the details.
- Do not present truncated text as a complete decision trace.

The [Recommendation Interface Contract Specification](recommendation-interface.md) fixes size limits, explanation levels, pagination, and CLI defaults.

## 14. Integrity and re-analysis

An explanation producer verifies at least the following.

1. Every reference target exists in the same result or a declared registry.
2. Fact type, unit, and provenance agree with the fact kind.
3. Expressions are type-correct and re-evaluable.
4. A reason emission expression is true.
5. A step result agrees with the expression result.
6. Every required fact is reachable from a decisive step.
7. The winner/alternative of a comparison agrees with the complete order of the Ranking Policy.
8. The reason code, effect, role, and required facts agree with the Taxonomy.
9. Task tier and set membership agree with Recommendation Semantics.
10. A task decision has a summary description, and no required parameter is missing from an applied description key.
11. A non-ready task has no task recommendation decision.
12. The same snapshot, options, and versions return the same identity, order, and trace.

Do not silently continue by treating a violation as a missing description or unknown reason; treat it as an analysis invariant failure. The [Recommendation Interface Contract Specification](recommendation-interface.md) fixes diagnostics and exit codes.

In addition to the re-analysis conditions in the Recommendation Semantics Specification, do not reuse an old explanation when any of the Ranking algorithm version, Taxonomy version, Explanation model version, Expression version, or Description registry version changes. A change only to a description template does not invalidate a decision trace, but derived text is regenerated.

## 15. Conceptual example

The following is a semantic example of a minimal explanation, not a wire schema.

```text
Task: TASK_A
Tier: recommended
Reason: ranking_rule_supports_task (decisive)
Rule: lower_total_float
Expression: fact(TASK_A.total_float) less_than fact(TASK_B.total_float)
Facts: TASK_A.total_float = 0p, TASK_B.total_float = 3p
Comparison: winner=TASK_A, alternative=TASK_B
Description key: recommendation.reason.ranking_comparison
Description params:
  winner_task_id = TASK_A
  alternative_task_id = TASK_B
  rule_id = lower_total_float
  winner_value = 0p
  alternative_value = 3p
  relation = less_than

Task: TASK_B
Tier: allowed
Higher priority: TASK_A
Reason: ranking_rule_opposes_task (decisive)
Additional capacity: startFeasible(R union {TASK_B}) = true
```

For example, a renderer can derive the text “TASK_A was prioritized because its total float is 0p, lower than TASK_B's 3p.” This text is illustrative; the authoritative comparison is the rule, expression, typed facts, and comparison.

## 16. Versioning

The following changes require an Explanation model version change.

- Changes to required meaning for fact occurrences, decisions, steps, comparisons, or reason occurrences
- Changes to completeness of the decisive chain or minimal witnesses
- Addition, removal, or reordering of phases
- Changes to semantic identity or canonical order

The following changes require an Expression version change.

- Changes to nodes, relations, value types, evaluation, or depth limits

Adding a description key may be treated as a minor-compatible update to the Description registry, but changing or removing the meaning of an existing key, or breaking compatibility of a required parameter, is a major update. The [Recommendation Interface Contract Specification](recommendation-interface.md) fixes the external version representation.

## 17. Items handed off to subsequent design tasks

### [`INTERFACE_CONTRACT`](recommendation-interface.md) (settled)

- Core type names and the `NextResult.v3` serialization schema
- Breaking migration from `NextResult.v2`
- Fixed projections for complete JSON and summary text
- Canonical locale `en` and Version 1 templates
- The decision not to include pagination, size limits, or JSON truncation in Version 1
- Adapter behavior for unknown versions and keys
- `PTREC-*` invariant diagnostics and exit 70

### `NORMATIVE_EXAMPLES`

The [Recommendation normative examples](../examples/recommendation.md) establish the following.

- Critical-versus-priority, resource conflict, parallel recommended tasks, and allowed tasks outside the horizon
- The case where a rejection caused only by active allocation does not fabricate a task winner
- A tie before the decisive rule and contributing rules after it
- Derived text from description keys and parameters
- Separation of summary projections from complete Core traces

### [`HUMAN_OVERRIDE_CONTRACT`](recommendation-override.md) (settled)

- Separate the normal recommendation trace from the override decision artifact.
- Reference normal decision, reason, and comparison IDs rather than copying them.
- Use restricted expressions for resource witnesses of a replacement set.
- Do not convert human reason text back into normal ranking facts.

## 18. Acceptance for this slice

- Defined typed fact values, provenance, and identity.
- Defined a restricted Boolean-expression AST and exact evaluation.
- Defined comparisons for winners, alternatives, and decisive/contributing rules.
- Defined result/task decisions, phases, and step dependencies.
- Defined tier-required traces and minimal comparison witnesses.
- Connected to the Reason Taxonomy code/effect/role/fact contract.
- Defined the boundary for deriving text from stable description keys and typed parameters.
- Separated completeness of the Core semantic model from adapter truncation.
- Defined versioning of the model, expression, and description registry.
- Did not change the current interface or implementation.
