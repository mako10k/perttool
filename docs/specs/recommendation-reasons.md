# Recommendation Reason Taxonomy Specification

- Document status: Normative 1.0
- Taxonomy version: 1.0
- Created: 2026-07-22
- Applicable requirements: [../requirements.md](../requirements.md)
- Recommendation semantics: [recommendation.md](recommendation.md)
- Recommendation ranking: [recommendation-ranking.md](recommendation-ranking.md)
- Structured explanation: [recommendation-explanation.md](recommendation-explanation.md)
- Recommendation interface: [recommendation-interface.md](recommendation-interface.md)
- Human override: [recommendation-override.md](recommendation-override.md)
- Analysis specification: [analysis.md](analysis.md)
- Related issue: [Issue #1](https://github.com/mako10k/perttool/issues/1)

## 1. Purpose

This specification is normative: it decomposes the reasons used for recommendation set selection and tier assignment into stable machine-readable codes and project facts.

It defines the following:

- stable lower snake case reason codes
- occurrence conditions for each code
- the effect and decision role of a reason
- the typed facts and entity references required by each code
- the relationship to recommended-set selection and the four tiers
- the boundary that prevents unmodeled facts from entering reasons
- taxonomy and unknown-code compatibility
- inputs passed to structured expressions, decision traces, and description projections

A reason code alone does not explain why a task was selected instead of another task. A code classifies a reason; it does not replace the applicable rule, typed facts, alternatives, or decision conditions.

## 2. Normative position and scope

Resolve conflicts in meaning or design in the following order:

1. Must requirements in `docs/requirements.md`
2. [Recommendation Semantics Specification](recommendation.md)
3. [Recommendation Ranking Policy Specification](recommendation-ranking.md) for ranking meaning, and this specification for reason meaning
4. [Analysis Specification](analysis.md)
5. [Recommendation Structured Explanation Specification](recommendation-explanation.md) and [Recommendation Interface Contract Specification](recommendation-interface.md)
6. examples, tests, help, and implementation

In scope:

- normal recommendations for actual `ready` tasks
- selection into or exclusion from the recommended set `R`
- determination of the `recommended`, `allowed`, `deferred`, and `discouraged` tiers
- fact and rule categories derivable from the project model and versioned policy
- a reason vocabulary interpreted consistently by AI, humans, and adapters

Out of scope:

- precedence, weights, selection horizon, and tie-breaks of ranking factors
- calculation rules for criticality, float, priority, successor impact, and gate/milestone distance
- natural-language descriptions, localization, templates, and message IDs
- expression ASTs and the structure and evaluation rules of decision-trace nodes
- Core types, JSON fields, schemas, text layouts, ordering, and size limits
- human override reasons and audit storage; [Recommendation Human Override Contract Specification](recommendation-override.md) is authoritative
- replacement of existing resource-rejection lifecycle diagnostics, `blocked_reason`, or `runnable_now`
- interface or implementation changes

[Recommendation Ranking Policy Specification](recommendation-ranking.md) defines the meaning and comparison rules of ranking factors. This specification defines the categories that refer to them through stable codes and the conditions that connect them to set and tier decisions.

## 3. Reason composition

A reason occurrence conceptually contains the following information:

```text
reason occurrence
├── stable reason code
├── effect
├── decision role
├── typed facts
└── entity references
```

This is not a wire schema. The Structured Explanation Model and the [Recommendation Interface Contract Specification](recommendation-interface.md) define field names, nesting, arrays, and cardinality.

### 3.1 Effect

Effect expresses the direction a reason has for the decision to start the evaluated task now.

| Effect | Meaning |
| --- | --- |
| `supporting` | Supports selecting or starting the task. |
| `opposing` | Weakens selection of the task relative to other facts or rules, but does not by itself mean that the task cannot be started. |
| `blocking` | Prevents a particular set membership or start authority in a normal recommendation. |
| `neutral` | Represents decision context without direction, such as a tie, applicability domain, or set invariant. |

`blocking` does not mean that a task is permanently impossible to execute. For example, a resource conflict only prevents simultaneous start while retaining `R`; it can be resolved when the project state or selected set changes.

### 3.2 Decision role

Decision role expresses how an occurrence contributed to the current conclusion.

| Role | Meaning |
| --- | --- |
| `decisive` | Without this condition or rule, the conclusion about set membership or tier could change. |
| `contributing` | Supports or opposes the conclusion, but does not by itself determine the current conclusion. |
| `context` | Indicates a domain, invariant, tie, or similar condition without directly creating a selection difference. |

The taxonomy table restricts the roles permitted for the same code. Actual roles are determined by the application order of the versioned ranking rules and the classification order in the Recommendation Semantics Specification; presentation layers MUST NOT infer them.

## 4. Code identifiers and stability

Reason codes use ASCII lower snake case and satisfy:

```text
[a-z][a-z0-9]*(?:_[a-z0-9]+)*
```

- A code MUST NOT embed a locale, task ID, resource ID, rule ID, or numeric value.
- The same code MUST NOT be reused for another occurrence condition or effect.
- Code names MUST NOT be split, translated, or paraphrased as natural-language descriptions.
- Dynamic codes MUST NOT be generated from project-specific tags, titles, or free-form text.
- A consumer receiving only a code MUST NOT re-infer missing facts, rules, or alternatives.

Typed facts and entity references carry entity-specific information and values.

## 5. Typed fact categories

This specification defines semantic fact kinds passed to subsequent schemas. It does not define their wire representation.

| Fact kind | Required meaning | Referenced entities |
| --- | --- | --- |
| `task_classification` | Classification of a task derived from the snapshot. | task |
| `recommendation_set_membership` | Whether a task is included in the derived recommended set `R`. | task, derived set |
| `set_start_feasibility` | Whether `startFeasible(S)` is true or false for a specified task set. | task set, resource set, derived set |
| `resource_capacity_witness` | Per-resource capacity, active usage, selected usage, requirement of the subject task, available amount, deficit, and occupants. | resource, subject task, active/selected tasks |
| `ranking_rule_application` | Which versioned rule was applied to which task and whether it supported, opposed, or tied. | policy rule, subject task, alternative task when needed |
| `ranking_comparison` | Subject value, alternative value, relation, and winner/loser compared under the same rule/factor. | policy rule, ranking factor, two or more tasks |
| `policy_deferral` | The value of `policyDefers(t)` and the versioned rule that derived it. | policy rule, task |
| `modeled_negative_fact` | Whether a registered negative fact kind applies to the current start of the subject task. | negative fact kind, task, entities referenced by the fact |

Values of `ranking_rule_application` and `ranking_comparison` retain their types as booleans, integers, exact Rationals, finite enums, entity references, or finite collections thereof. Display decimals and natural-language text MUST NOT be authoritative comparison values.

### 5.1 Entity references

Entity references distinguish at least the following kinds:

- `project`
- `task`
- `milestone`
- `gate`
- `resource`
- `policy_rule`
- `ranking_factor`
- `negative_fact_kind`
- `derived_set`

The project entity refers to the authoritative ID. Tasks, milestones, gates, and resources refer to stable DSL IDs. Policy rules, ranking factors, and negative fact kinds refer to stable IDs registered in their respective versioned specifications. The recommended set refers to the symbolic set `R` derived from the snapshot; titles and display order MUST NOT be used as identity.

Because the same string can exist for different kinds, entity kind MUST NOT be inferred from an ID alone.

## 6. Stable reason code taxonomy

### 6.1 Applicability and set outcome

| Code | Exact occurrence condition | Effect | Permitted roles | Required facts | Correspondence |
| --- | --- | --- | --- | --- | --- |
| `task_ready` | `classification(t) == ready` | `neutral` | `context` | `task_classification` | Evaluation domain for all tiers |
| `recommended_set_selected` | `t in R` | `supporting` | `decisive` | `recommendation_set_membership(present=true)` | `recommended`, set inclusion |
| `recommended_set_not_selected` | `t not in R` | `opposing` | `decisive` | `recommendation_set_membership(present=false)` | `allowed`, `deferred`, `discouraged`, set exclusion |
| `recommended_set_feasible` | `startFeasible(R) == true` | `neutral` | `context` | `set_start_feasibility(R, true)` | Invariant for the entire recommended set |

`recommended_set_selected` and `recommended_set_not_selected` are membership outcomes; they do not by themselves explain the cause of selection. Associate at least one causal reason from 6.2 or 6.3 with every unselected task.

### 6.2 Ranking rule category

| Code | Exact occurrence condition | Effect | Permitted roles | Required facts | Correspondence |
| --- | --- | --- | --- | --- | --- |
| `ranking_rule_supports_task` | Applying a registered versioned ranking rule favors selection of the subject task. | `supporting` | `decisive`, `contributing` | `ranking_rule_application`; comparative rules also require `ranking_comparison` | Primarily set inclusion; also used for alternative comparisons |
| `ranking_rule_opposes_task` | Applying a registered versioned ranking rule favors an alternative or policy condition over the subject task. | `opposing` | `decisive`, `contributing` | `ranking_rule_application`; comparative rules also require `ranking_comparison` | Set exclusion and explanation of higher-ranked tasks |
| `ranking_rule_tied` | A registered versioned ranking rule makes the subject and alternative equal, so that rule does not determine their order. | `neutral` | `context` | `ranking_rule_application` and `ranking_comparison(relation=equal)` | Trace that proceeds to a subsequent rule or tie-break |

Do not embed ranking-factor names in reason codes. For example, when criticality, float, or priority is used, use the codes in this table and distinguish the applicable factor, value, relation, and rule with typed facts. This preserves which project fact ranked task A above task B without proliferating codes.

To emit `ranking_rule_supports_task` or `ranking_rule_opposes_task`, the referenced rule and factor MUST be registered in the versioned Ranking Policy, and its input values and relation MUST be recomputable. A reason containing only a rule ID, score, or free-form text is insufficient.

### 6.3 Tier and start authority

| Code | Exact occurrence condition | Effect | Permitted roles | Required facts | Correspondence |
| --- | --- | --- | --- | --- | --- |
| `recommended_set_addition_feasible` | `t not in R` and `startFeasible(R union {t}) == true` | `supporting` | `decisive`, `contributing` | `set_start_feasibility(R union {t}, true)` | Capacity condition for `allowed`; it can also contribute to `deferred` when policy defers. |
| `recommended_set_resource_conflict` | `t not in R` and `startFeasible(R union {t}) == false` | `blocking` | `decisive`, `contributing` | `set_start_feasibility(R union {t}, false)` and `resource_capacity_witness` for every violated resource | Resource condition for `deferred` |
| `policy_defers_start` | `policyDefers(t) == true` | `blocking` | `decisive`, `contributing` | `policy_deferral(true)` and the `ranking_rule_application` used for the decision | Policy condition for `deferred`; it can be contributing when a preceding negative fact exists. |
| `modeled_negative_fact_applies` | `explicitNegativeFact(t) == true` for a registered negative fact kind | `blocking` | `decisive` | One or more `modeled_negative_fact` values and the applicable rule | Negative condition for `discouraged` |

`recommended_set_resource_conflict` MUST NOT show only one violated resource as a representative. If multiple resources violate capacity constraints, retain all witnesses as typed facts. The [Recommendation Interface Contract Specification](recommendation-interface.md) defines the boundary between natural-language presentation and complete JSON.

## 7. Relationship to set selection

For the recommended set `R`, all of the following hold:

1. Every task where `t in R` has `task_ready`, `recommended_set_selected`, and `ranking_rule_supports_task` that shows membership in the selection horizon or scan selection.
2. Every ready task where `t not in R` has `task_ready` and `recommended_set_not_selected`.
3. The result as a whole has `recommended_set_feasible`.
4. Every `recommended_set_not_selected` is accompanied by at least one of `ranking_rule_opposes_task`, `policy_defers_start`, `recommended_set_resource_conflict`, or `modeled_negative_fact_applies`.
5. Even when the Ranking Policy permits an empty `R`, show the versioned rule or resource witness applied to the exclusion of every ready task with one of `ranking_rule_opposes_task`, `policy_defers_start`, or `recommended_set_resource_conflict`.
6. When set selection depends on comparison among multiple tasks, make the winner and alternative referable through the same `ranking_comparison`.

Membership outcome alone, task-ID order alone, or an opaque score MUST NOT be used as the reason for exclusion. If a task-ID tie-break is used, register it as a policy rule/factor and record its value and relation.

## 8. Relationship to tiers

Following the classification order in the Recommendation Semantics Specification, associate the following reasons with each tier:

| Tier | Required reasons | Conditional reasons | Prohibited decisive reasons |
| --- | --- | --- | --- |
| `recommended` | `task_ready`, `recommended_set_selected`, `ranking_rule_supports_task`, and result-level `recommended_set_feasible` | Zero or more `ranking_rule_tied` values | `recommended_set_not_selected`, `policy_defers_start`, `modeled_negative_fact_applies` |
| `allowed` | `task_ready`, `recommended_set_not_selected`, `recommended_set_addition_feasible` | `ranking_rule_opposes_task`, `ranking_rule_tied` | `policy_defers_start`, `modeled_negative_fact_applies`, `recommended_set_resource_conflict` |
| `deferred` | `task_ready`, `recommended_set_not_selected`, and one or more of `policy_defers_start` or `recommended_set_resource_conflict` | ranking evidence, addition feasibility | `modeled_negative_fact_applies` as a decisive reason |
| `discouraged` | `task_ready`, `recommended_set_not_selected`, `modeled_negative_fact_applies` | ranking evidence, resource feasibility/conflict | None, provided the negative fact is the decisive reason in classification order |

When a `deferred` task has both policy deferral and a resource conflict, only the condition that occurs first in the classification order in the Recommendation Semantics Specification is `decisive`; the other is `contributing`. A `discouraged` task can retain policy deferral or resource conflict as `contributing`, but `modeled_negative_fact_applies` determines its tier.

The reason an allowed task is unselected MUST NOT end with `recommended_set_not_selected` alone; it MUST include at least one `ranking_rule_opposes_task`. This enables AI to answer comparisons between a recommended task and an allowed alternative without re-inference.

## 9. Unmodeled facts

In Taxonomy version 1.0, zero concrete fact kinds are registered as `modeled_negative_fact`. Therefore, normal analysis for Grammar/Semantics version 1 satisfies all of the following:

- It does not emit `modeled_negative_fact_applies`.
- It treats `explicitNegativeFact(t)` as false for every ready task.
- It does not emit the `discouraged` tier.

In particular, the following MUST NOT be inferred from chats, issue bodies, task titles, tags, source text, or free-form text and used as reasons:

- release-specific semantics or release gates
- rework risk or possible future replacement
- information sufficiency, missing specifications, or insufficient investigation
- task interest, implementation ease, or general code-quality value

The DSL `gate` is a modeled dependency edge, but the business semantics of a “release gate” are not modeled. Do not generate a release-specific reason merely because a gate entity exists.

To add a negative fact in the future, specify the authoritative field, validation, applicability predicate, entity reference, and impacts on ranking/override, then register the concrete `negative_fact_kind` in the taxonomy before emitting it. Unknown information MUST NOT enter authoritative decisions as generic `other`, `unknown_risk`, or free-form reasons.

## 10. Versioning and unknown-code compatibility

The taxonomy version uses `major.minor`. The [Recommendation Interface Contract Specification](recommendation-interface.md) defines the wire field that returns the version.

- Minor updates add codes or fact kinds without changing the meaning of existing codes.
- Major updates remove codes, change occurrence predicates, change effects, or make incompatible changes to required facts.
- Including typo corrections, renaming a published code is treated as removal plus addition.
- Do not reuse a retired code with a different meaning.
- Do not treat Ranking algorithm version and Taxonomy version as the same version.

When a consumer receives an unknown code, it follows all of the following:

1. Retain the unknown code and any typed facts/entity references it can understand as far as possible.
2. Do not speculatively convert an unknown code into a known code, generic reason, or natural language.
3. If an unknown code is `decisive`, do not reclassify the tier itself to another tier; state that the explanation cannot be fully understood.
4. Do not discard the entire result solely because of an unknown code. However, actions that the consumer can safely execute MUST NOT exceed the authority of known tiers.
5. When no human-facing description is available, display the raw code recognizably and do not fabricate its meaning.

The same principles apply to unknown fact kinds, entity kinds, and rule IDs. A producer performing strict validation MUST NOT output an unregistered code or fact kind for its declared Taxonomy version.

## 11. Input boundary for structured explanations

The [Recommendation Structured Explanation Specification](recommendation-explanation.md) receives the following inputs from this specification:

- stable reason code
- effect and actual decision role
- typed fact kind and exact value
- kind-qualified entity reference
- ranking rule/factor reference
- relationships among subject, winner, and alternative
- set membership and resource-feasibility witnesses
- separation of Taxonomy version and Ranking algorithm version

The Structured Explanation Specification and [Recommendation Interface Contract Specification](recommendation-interface.md) define the following:

- expression-AST nodes, operators, and evaluation
- parent-child relationships among reason occurrences and the decision trace
- comparison IDs, fact IDs, and rule-application IDs
- description keys, parameters, templates, locales, and fallback text
- JSON fields, schemas, ordering, deduplication, and truncation

Subsequent tasks MUST NOT silently change the occurrence predicate or effect of a code. Following the [Structured Explanation Specification](recommendation-explanation.md), natural-language descriptions are deterministically derived from codes, typed facts, comparisons, and the decision trace; description text MUST NOT feed back into ranking input.

## 12. Invariants

Reason generation verifies at least all of the following:

1. The reason code is registered for the declared Taxonomy version.
2. Required typed facts and entity references for the code are present.
3. The fact can be used to re-evaluate the occurrence predicate of the code.
4. The effect/role combination is permitted by the taxonomy.
5. Only ready tasks have recommendation reasons.
6. Every ready task has exactly one set-membership outcome.
7. The set of `recommended_set_selected` tasks equals `R`.
8. A result where `recommended_set_feasible` is false is not treated as successful.
9. Tiers and required/prohibited reasons match the matrix in section 8.
10. Set exclusion has a causal reason and any required alternative/rule reference.
11. Do not generate `discouraged` from an unregistered negative fact.
12. The same snapshot, options, Ranking algorithm version, and Taxonomy version return the same reason multiset and roles.

Do not continue silently by treating a violation as a missing description; treat it as an analysis invariant failure. The [Recommendation Interface Contract Specification](recommendation-interface.md) defines concrete diagnostic codes and the external schema.

## 13. Acceptance for this slice

- Stable lower snake case codes and invariant meanings are defined.
- Occurrence predicates, effects, and permitted roles are defined for every code.
- Typed fact categories and kind-qualified entity references are defined.
- Recommended-set inclusion/exclusion is connected to causal reasons.
- Required and prohibited reasons are defined for all four tiers.
- Ranking-factor-specific meaning is separated into the Ranking Policy.
- Generation of unmodeled release semantics, rework risk, and information sufficiency is prohibited.
- Taxonomy versioning and unknown-code compatibility are defined.
- Inputs passed to the Structured Explanation Model are separated from matters first determined there.
- Natural-language descriptions, JSON schemas, interfaces, and code are unchanged.
