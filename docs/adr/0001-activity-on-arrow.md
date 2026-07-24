# ADR 0001: Represent tasks as Activity-on-Arrow edges

- Status: Accepted
- Date: 2026-07-21
- Decision owners: perttool maintainers
- Related requirements: [Requirements](../requirements.md)
- Related specifications: [DSL Grammar](../specs/dsl-grammar.md), [Graph Semantics](../specs/graph-semantics.md)

## Context

perttool must treat task additions, changes, and removals as document diffs and mechanically recalculate PERT/CPM, the current frontier, and the shared-resource schedule from the same DAG.

Both Activity-on-Node, where tasks are nodes, and Activity-on-Arrow (AoA), where tasks are edges, can express common dependencies. However, the initial requirements for this project emphasize treating tasks as edges, making milestones and events explicit, and making dependencies easy to visualize as a PERT network.

## Decision

Adopt AoA as the canonical graph model.

- A task is a directed edge with a positive duration.
- A milestone is an event node.
- A gate is a dependency edge with duration 0.
- Only task and gate endpoint connections define hard precedence.
- Resource requirements, owners, and priorities are edge attributes or separate constraints; they are not converted into precedence edges.
- Resource arcs derived from resource conflicts explain a selected schedule and are not saved automatically to the canonical DSL.

The DSL uses the following canonical headers:

```pert
task IMPLEMENT READY -> IMPLEMENTED:
  title "Implement"
  duration 3d

gate RELEASE_GATE TESTED -> RELEASED:
  reason "Require completed testing before release"
```

## Consequences

Positive:

- Changing a task endpoint is a local `from` or `to` change.
- Milestone reachability, joins, and the frontier can be explicit node states.
- PERT/CPM forward and backward passes can be defined directly over edge durations.
- A Mermaid flowchart can naturally render milestones as nodes and tasks and gates as edges.
- A task's title, estimate, status, and resource requirements can change without changing its task ID.

Costs:

- A milestone and a zero-duration gate may be required to join or branch multiple tasks.
- Conversion to common AON tools requires dummy nodes or gates and a loss report.
- A task-centered UI must explicitly design edge selection and source-span navigation.

## Rejected alternatives

### Use Activity-on-Node as the canonical model

Although this would align well with common project-management UIs, it would violate the initial task-as-edge requirement, remove explicit milestones and events, and conflict with the existing DSL representation.

### Keep both AoA and AON as canonical models

This would require synchronization rules and duplicate ID and source mappings, leaving the source of truth unclear. If an AON view is needed, generate it as a derived view of the AoA graph.

## Validation

- The parser retains both endpoints of task and gate headers with source spans.
- The graph validator checks self-loops, cycles, and finish reachability across all task and gate edges.
- Tests ensure resource requirements do not affect cycle detection.
- Mermaid round trips preserve task and gate IDs and endpoints.
