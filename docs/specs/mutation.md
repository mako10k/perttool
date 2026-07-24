# perttool Mutation Semantics Specification

- Document status: Draft 0.3
- Mutation semantics version: 1
- Created: 2026-07-22
- Requirements: [../requirements.md](../requirements.md)
- DSL grammar: [dsl-grammar.md](dsl-grammar.md)
- Graph semantics: [graph-semantics.md](graph-semantics.md)
- CLI interface: [interfaces.md](interfaces.md)
- Basic design: [../basic-design.md](../basic-design.md)

## 1. Purpose and scope

This document defines the Core contract for source-preserving mutations of `.pert` documents. A mutation does not write an existing document directly; it returns localized UTF-16 `TextEdit` values, a revalidated candidate, a digest, and a unified diff.

The implementation scope of Mutation semantics version 1 is project `set`; task `add`, `set`, `remove`, and `finish`; milestone/resource `add`, `set`, and `remove`; and `batch`, which applies multiple atomic mutations to one candidate. Filesystem writing passes the candidate defined here to the safe-write adapter in the CLI Interface specification. `dag advance` is a subsequent slice that reuses this document's common invariants.

## 2. Normative precedence

Resolve inconsistencies between documents in the following order.

1. Must requirements in `docs/requirements.md`
2. Syntax, fields, and validation rules in the [DSL grammar specification](dsl-grammar.md)
3. State and DAG rules in the [Graph Semantics specification](graph-semantics.md)
4. Mutation requests, `TextEdit`, and comment-ownership rules in this document
5. Commands, options, and serialization rules in the [CLI Interface specification](interfaces.md)
6. `docs/basic-design.md` and help/samples

The CLI projects options to the Core requests in this document. A CLI adapter MUST NOT reimplement target resolution, field mutation, or candidate validation.

## 3. Core API

```ts
planMutation(
  text: string,
  mutation: Mutation,
  options?: MutationOptions,
): MutationResult
```

`MutationOptions` has `maxDiagnostics`, `originalLabel`, and `updatedLabel`. The default diff labels are `original` and `updated`. The Core does not inspect paths, clocks, or process state.

Conceptual request model:

```ts
type AtomicMutation =
  | {
      kind: "project.set";
      set?: ProjectFieldSet;
      clear?: ProjectClearableField[];
    }
  | {
      kind: "task.add";
      id: string;
      from: string;
      to: string;
      task: TaskDefinition;
    }
  | {
      kind: "task.set";
      id: string;
      from?: string;
      to?: string;
      set?: TaskFieldSet;
      clear?: TaskClearableField[];
      addTags?: string[];
      removeTags?: string[];
      upsertRequirements?: TaskRequirementInput[];
      removeRequirements?: string[];
    }
  | { kind: "task.remove"; id: string }
  | { kind: "task.finish"; id: string }
  | {
      kind: "milestone.add";
      id: string;
      milestone: MilestoneDefinition;
    }
  | {
      kind: "milestone.set";
      id: string;
      set?: MilestoneFieldSet;
      clear?: ("description" | "state" | "tags")[];
      addTags?: string[];
      removeTags?: string[];
    }
  | { kind: "milestone.remove"; id: string }
  | {
      kind: "resource.add";
      id: string;
      resource: ResourceDefinition;
    }
  | {
      kind: "resource.set";
      id: string;
      set?: ResourceFieldSet;
      clear?: "description"[];
    }
  | { kind: "resource.remove"; id: string };

type Mutation =
  | AtomicMutation
  | { kind: "batch"; mutations: AtomicMutation[] };
```

`TaskDefinition` requires `title` and exactly one of `duration` or `estimate`. Optional fields are `description`, `status`, `priority`, `requirements`, `owner`, `tags`, `blockedReason`, and `source`.

`ProjectFieldSet` can contain `id`, `version`, `title`, `description`, `asOf`, `durationUnit`, `velocity`, `finish`, `criticalEpsilon`, and `targetDuration`. The clearable fields are `description`, `as_of`, `velocity`, `critical_epsilon`, and `target_duration`. Because a project is exactly one, a request has no target ID and resolves to the current project declaration. Changing `id` still targets that same project.

`TaskFieldSet` can contain `title`, `description`, `duration` or `estimate`, `status`, `priority`, `owner`, `blockedReason`, and `source`. Its clearable fields are the same as the CLI contract: `description`, `status`, `priority`, `owner`, `blocked_reason`, `source`, `tags`, and `requires`.

An `estimate` contains all of `optimistic`, `mostLikely`, and `pessimistic`. A requirement contains `resourceId` and `units`. Duration is accepted as a DSL literal with a suffix; the candidate parser and validator validate the project unit.

`MilestoneDefinition` requires `title` and can contain `description`, `state`, and `tags`. `MilestoneFieldSet` contains `title`, `description`, and `state`. `ResourceDefinition` requires `title` and `capacity` and can contain `description`. `ResourceFieldSet` contains `title`, `description`, and `capacity`. Resource `tags` are retained as a DSL field but are not mutable by version 1 resource-mutation requests.

A `kind` or field absent from the request model, or a field of the wrong type, is `PTMUT-301`. Input from JavaScript callers is also handled at the same request-diagnostic boundary rather than terminating with an exception.

## 4. Common processing and result

The processing order is fixed:

1. `checkDocument` the original text
2. Set `originalDigest` to the SHA-256 of the UTF-8 bytes
3. Validate request shape and conflicting options
4. Resolve exactly one target
5. Create `TextEdit` values for source spans. A batch plans every atomic mutation against the same original spans
6. Combine batch insertions at the same document end in request order
7. Normalize edits into ascending `startOffset`, `endOffset` order and reject overlap
8. Apply edits in descending offset order
9. `checkDocument` the final candidate
10. Publish updated text, digest, diff, and edits only when the candidate is valid

Core result:

```ts
interface MutationResult {
  ok: boolean;
  documentId: string | null;
  changed: boolean;
  originalDigest: string;
  updatedDigest: string | null;
  updatedText: string | null;
  diff: string | null;
  edits: readonly TextEdit[];
  diagnostics: readonly Diagnostic[];
  diagnosticsTruncated: boolean;
}
```

Rules:

- If the original is invalid, return its diagnostics and no candidate or edits
- For a request/target error, return `PTMUT-*` diagnostics and no candidate or edits
- If the candidate is invalid, return its diagnostics and no candidate or edits
- A valid no-op has `ok=true`, `changed=false`, `updatedText=original`, the same digest, `diff=""`, and `edits=[]`
- A valid change preserves candidate warnings. Warnings alone do not make `ok=false`
- The digest representation is `sha256:<64 lowercase hex digits>`
- `TextEdit` offsets are zero-based UTF-16 code units and ranges are half-open
- I/O, path resolution, write mode, and optimistic locking are not part of the Core
- Do not validate atomic mutations in a batch at intermediate states. Validate only the final candidate

Serialize a unified diff with LF, beginning with `--- <originalLabel>` and `+++ <updatedLabel>`. Return one hunk with three lines of context before and after the changed region. The same input, request, and options return byte-identical diffs.

## 5. Source-preserving TextEdit

### 5.1 Common rules

- Preserve BOM, prevailing line endings, existing declaration order, and existing field order
- Do not include unchanged declarations, fields, comments, or blank lines in replacements
- For a header's `from`/`to`, replace only the corresponding `fromSpan`/`toSpan`
- For a scalar field, normally replace only its `valueSpan`
- Replace block text and timing-kind changes by field span. Replace existing estimate values and requirement units only by child spans
- Insert new fields at their position in the DSL grammar specification's canonical field order without reordering existing fields
- When inserting multiple fields at the same offset, combine them into one edit in canonical field order
- Do not expose internally produced edits in a result unless candidate validation succeeds

### 5.2 Comment ownership and removal

Consecutive comments at the same structural level immediately before a declaration or field, with no intervening blank line, are that element's leading comments.

- Declaration removal also removes its column-0 leading comments
- Field removal also removes its 2-space-indented leading comments
- Do not remove blank lines before leading comments
- Do not remove comments after an element, comments at another indentation, or `#` inside block text
- Changing a field value does not change its leading comments
- Insert a new field before the leading comments of a subsequent field; do not move comment ownership

### 5.3 Serialization

New tasks and new fields follow the canonical serializer in the DSL grammar specification.

- Indentation is 2 spaces and nested fields use 4 spaces
- Strings use JSON-compatible escapes
- Single-line text uses a String; text containing a newline uses block text. If leading/trailing newlines cannot be retained in block text, use an escaped String
- Omit unnecessary leading and trailing zeroes in duration decimals
- Serialize a tag that cannot be a bare tag as a String
- Task field order is `title`, `description`, `duration|estimate`, `status`, `priority`, `requires`, `owner`, `tags`, `blocked_reason`, `source`
- Milestone field order is `title`, `description`, `state`, `tags`
- Resource field order is `title`, `description`, `capacity`, `tags`
- Estimate order is `optimistic`, `most_likely`, `pessimistic`
- Requirement order preserves request order or existing source order

## 6. `task.add`

- Require the added ID to be unused among all entity IDs in the original document
- Canonically serialize the task header and required/optional fields
- Append the new declaration to the document end
- If there is no blank line between existing final trivia and the new declaration, add one line; do not turn a trailing comment into the new task's leading comment
- Preserve the text and order of trailing standalone comments and blank lines
- Validate endpoints, resources, duration units, blocked state, and other validity through the validator for the entire candidate

## 7. `task.set`

`task.set` requires at least one requested change. The same field MUST NOT be specified in both `set` and `clear`.

### 7.1 Duration and estimate

- `set.duration` and `set.estimate` are mutually exclusive
- When changing to duration, replace existing `duration` or `estimate` with a duration field
- When changing to estimate, replace existing `duration` or `estimate` with an estimate block
- The timing field is required, so it is not clearable

### 7.2 Tags

- `addTags` preserves existing order and appends only absent tags in request order
- `removeTags` removes specified tags; absent tags are a no-op
- Specifying the same tag in both add and remove is a request error
- `clear tags` cannot be combined with add/remove
- If the result is empty, remove the `tags` field itself

### 7.3 Requirements

- `upsertRequirements` replaces units for existing resources at their existing positions and appends absent resources in request order
- `removeRequirements` removes specified resources; absent resources are a no-op
- Specifying the same resource in both upsert and remove is a request error
- `clear requires` cannot be combined with upsert/remove
- If the result is empty, remove the `requires` field itself

The candidate's `status=blocked` and `blocked_reason`, required fields, DAG, and resource constraints are validated by the normal document validator. The Core does not implicitly correct invalid combinations.

## 8. `task.remove` and `task.finish`

### 8.1 Remove

`task.remove` removes only the task declaration and its leading comments. It does not cascade-remove endpoint milestones, resources, or other edges. If removal would leave roots, finish reachability, joins, resources, or another graph rule invalid, reject the entire mutation as a candidate-validation error.

### 8.2 Finish

`task.finish` sets status to `done`. If no status field exists, add it at the canonical position. An existing `blocked_reason` is incompatible with `done` and is removed in the same mutation. If it is already `done` with no `blocked_reason`, it is a valid no-op.

## 9. Milestone/resource mutations and batch

### 9.1 Milestones

- `milestone.add` requires `title` and appends a canonical declaration to the document end
- `milestone.set` requires at least one change and changes title, description, state, or tags locally
- `milestone.remove` removes only the milestone and its leading comments; it does not cascade-change task/gate endpoints or project finish
- If a standalone add/remove final candidate violates reachability, roots, finish, or reference rules, reject it with the existing graph diagnostics

### 9.2 Resources

- `resource.add` requires `title` and `capacity` and appends a canonical declaration to the document end
- `resource.set` requires at least one change and changes title, description, or capacity locally
- `resource.remove` removes only the resource and its leading comments; it does not cascade-change task requirements
- Revalidate requirements and active allocations after a capacity change using the candidate validator
- Preserve existing resource tags byte-for-byte when changing other fields

### 9.3 Project

- `project.set` requires at least one change
- Change the project header ID and every project field locally by source span
- `title`, `duration_unit`, and `finish` are not clearable. Candidate validation permits `version` only when the grammar accepts its value
- `description`, `as_of`, `velocity`, `critical_epsilon`, and `target_duration` are clearable
- Revalidate consistency among `duration_unit`, `velocity`, duration fields, and `finish` with the candidate parser/validator; do not expose an inconsistent candidate
- A project-wide unit change that cannot be valid alone can be applied as a batch that also changes related task durations/estimates

### 9.4 Batch

Adding a milestone and its connecting edges in sequence creates an intermediate document with either an undefined endpoint or no path to finish, regardless of which is performed first. Therefore, when necessary, combine structural changes into one candidate with `batch`.

- A batch contains one or more atomic mutations in request order
- Reject nested batches and batches that change the same target more than once. The project target is the exactly-one project declaration; other targets are identified by entity ID
- Each atomic mutation resolves its target in the original document. Do not set/remove an entity added in the same batch
- A milestone/resource added in a batch can be referenced by a task add/set in that same batch
- When declaration additions concentrate at the same document-end offset, combine them into one edit in request order. If that offset also has a field insertion on an existing final declaration, place fields first and new top-level declarations afterward
- If atomic edit ranges conflict, reject the entire batch with `PTMUT-301`
- Do not publish or validate intermediate states; submit only the final candidate to the normal document validator

## 10. Mutation diagnostics

| Code | Severity | Meaning |
| --- | --- | --- |
| `PTMUT-301` | error | Invalid request shape, no requested change, or mutually exclusive violation |
| `PTMUT-302` | error | Target ID does not exist |
| `PTMUT-303` | error | Target ID exists but is not the entity kind requested |
| `PTMUT-304` | error | Added ID duplicates an existing entity |

Use `PTMUT-*` only for mutation request/target errors. Do not wrap a candidate's syntax, field, or graph errors as `PTMUT-*`; preserve existing `PTDSL-*`, `PTSEM-*`, and `PTDAG-*` diagnostics.

## 11. Acceptance invariants

Automatically verify at least the following.

1. add adds one canonical task and preserves BOM, line endings, and trailing trivia
2. set returns non-overlapping localized `TextEdit` values for headers, scalars, estimates, tags, and requirements
3. clear removes only comments owned by the element
4. finish sets status to done, removes `blocked_reason`, and becomes a no-op when run again
5. remove does not cascade and accepts only valid removals
6. reject missing/wrong-kind/duplicate/no-change-option with stable `PTMUT-*`
7. do not expose candidate/edits for an invalid original or invalid candidate
8. the candidate's target fields equal the request and semantic values of unrelated declarations/fields remain unchanged
9. `TextEdit` values are ascending UTF-16 offsets, non-overlapping, and their application equals `updatedText`
10. digest and unified diff are deterministically reproducible from the same input/request/options
11. milestone/resource set preserves unrelated declarations, fields, comments, and order
12. milestone/resource remove does not cascade and rejects a candidate that breaks reference or capacity constraints
13. batch returns connected-milestone addition, path replacement, and simultaneous resource/requirement addition as one valid candidate
14. reject an empty/nested/duplicate-target/conflicting-edit batch with `PTMUT-301`
15. project set deterministically handles localized set/clear for all fields, header ID changes, and no-ops
16. include a project-wide unit change with related entities in the same batch and validate only the final candidate
