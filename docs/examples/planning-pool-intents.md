# Planning Pool Intent Workflows

These examples target the unreleased Grammar 9 and CLI Contract 10 source.
They use `jq` only to copy exact result values. Every JSON request remains
source-bound, every mutation previews by default, and no example infers
semantic meaning.

## Migrate Grammar 8 and create the first Work

Start from a valid Grammar 8 `PLAN.pert`. Read its exact digest, review the
Grammar 9 migration, and then write only that reviewed candidate:

```sh
SOURCE_DIGEST=$(perttool document check PLAN.pert --format json | jq -r .source_digest)
perttool document migrate PLAN.pert --target-grammar 9 --diff
perttool document migrate PLAN.pert --target-grammar 9 \
  --write --expect-digest "$SOURCE_DIGEST"
```

Read the new Grammar 9 digest and create one explicit routine intent:

```sh
SOURCE_DIGEST=$(perttool work list PLAN.pert --format json | jq -r .source_digest)
cat > create-first-work.json <<JSON
{
  "request_schema_version": "Perttool.PlanningIntentRequest.v1",
  "source_digest": "$SOURCE_DIGEST",
  "action": {
    "kind": "create_work",
    "work_id": "EXAMPLE::FIRST",
    "title": "Define the first outcome",
    "description": "State the first result that must remain true",
    "insert_after_work_id": null
  }
}
JSON

perttool work reshape preflight PLAN.pert \
  --intent-request create-first-work.json --format json > first-preflight.json
jq '.normalized_request, .candidate_text, .authority_impact, .diagnostics' first-preflight.json

perttool work reshape apply PLAN.pert \
  --intent-request create-first-work.json \
  --preflight-hash "$(jq -r .preflight_hash first-preflight.json)" \
  --preflight-token "$(jq -r .preflight_token first-preflight.json)" \
  --diff
```

After reviewing the diff, repeat the same apply command with `--write` and the
current `--expect-digest`. Do not rebuild or edit the request between preflight
and apply.

## Create the first Window

After writing the Work candidate, refresh the digest. Window mutations use the
same intent identity and the unchanged Window mutation candidate path:

```sh
SOURCE_DIGEST=$(perttool work list PLAN.pert --format json | jq -r .source_digest)
cat > create-window.json <<JSON
{
  "request_schema_version": "Perttool.PlanningIntentRequest.v1",
  "source_digest": "$SOURCE_DIGEST",
  "action": {
    "kind": "create_window",
    "window_id": "EXAMPLE::NOW",
    "title": "Now",
    "objective": "Clarify the first explicit outcome",
    "start": null,
    "end": null,
    "work_ids": ["EXAMPLE::FIRST"]
  }
}
JSON

perttool window add PLAN.pert NOW --intent-request create-window.json --diff
perttool window add PLAN.pert NOW --intent-request create-window.json \
  --write --expect-digest "$SOURCE_DIGEST"
```

Select or remove one Work without reproducing the complete Window definition:

```json
{
  "request_schema_version": "Perttool.PlanningIntentRequest.v1",
  "source_digest": "sha256:CURRENT_SOURCE_DIGEST",
  "action": {
    "kind": "set_window_membership",
    "window_id": "EXAMPLE::NOW",
    "work_id": "EXAMPLE::SECOND",
    "selected": true
  }
}
```

Use `selected: false` for explicit removal. A persisted Window cannot become
empty.

## Other routine Work actions

Use one action per request. The accepted action shapes are:

```json
{"kind":"update_work","work_id":"EXAMPLE::FIRST","title":"Revised title","description":"Revised residual meaning"}
{"kind":"move_work","work_id":"EXAMPLE::FIRST","insert_after_work_id":"EXAMPLE::SECOND"}
{"kind":"set_dependency","dependent_work_id":"EXAMPLE::SECOND","prerequisite_work_id":"EXAMPLE::FIRST","present":true}
{"kind":"archive_work","work_id":"EXAMPLE::EMPTY"}
{"kind":"project","event_ids":["EXAMPLE::READY"],"activity_ids":["EXAMPLE::BUILD"]}
{"kind":"defer","task_ids":["EXAMPLE::BUILD"],"milestone_ids":["EXAMPLE::READY"]}
```

Wrap one action with `request_schema_version` and the current `source_digest`,
then use `work reshape preflight`. Projection and deferral remain explicit,
narrow, strict-DAG mutations. Review `authority_impact`; supply the exact
candidate-bound `--actor` and `--accepted-by-owner` response only when the
result requests it. The token is not owner approval.

Close and carry over a Window by enumerating every Work and target. No omitted
Work is carried automatically:

```json
{
  "request_schema_version": "Perttool.PlanningIntentRequest.v1",
  "source_digest": "sha256:CURRENT_SOURCE_DIGEST",
  "action": {
    "kind": "close_window",
    "window_id": "EXAMPLE::NOW",
    "carry_over_work_ids": ["EXAMPLE::FIRST"],
    "carry_over_target": {
      "kind": "new",
      "window_id": "EXAMPLE::NEXT",
      "title": "Next",
      "objective": "Continue the enumerated outcome",
      "start": null,
      "end": null
    }
  }
}
```

## Final Milestone acceptance with retained Work

Suppose a team accepts the Final Milestone for its strict MVP DAG while Work
named `Add offline export` remains in the Planning Pool. Both facts are valid:
the accepted Final Milestone records the reviewed outcome of the strict DAG,
and the retained Work preserves an advisory planning option.

This does not prove that the export is unnecessary, that a Window objective
was achieved, or that every Final Milestone Goal obligation is covered or the
Final Goal is complete. Remaining Work does not block `project.finish`.

To make the export part of execution scope, use an explicit `project` intent
and review the resulting governed strict-DAG candidate before persistence.
Leaving the Work in the Pool does not project it, cancel it, or satisfy it.
[Issue #24](https://github.com/mako10k/perttool/issues/24) separately owns the
future Goal Obligation, Goal Coverage, and Goal Seal model.

## Recovery

- Stale source digest: read the current document again, decide whether the
  intent is still correct, rebuild it against the new digest, and rerun
  preflight. Never patch only the digest onto an unreviewed old intention.
- Failed preflight: no token authority and no write exist. Correct the explicit
  action or source problem and run a new preflight.
- Expired or mismatched token: keep the source unchanged, rerun preflight with
  the same intent, review the reproduced candidate, and use only the newly
  returned hash and token.
- Owner response required: review the exact strict-DAG candidate, then repeat
  apply with the requested candidate-bound owner assertion. A token, green
  validation, or ordinary Work intent does not substitute for that response.
- History unavailable or overlapping: make the source recoverable in the same
  Git path and rerun, or use a separately reviewed `--out` candidate. Do not
  bypass the canonical-history failure by manually deleting declarations.
- Interrupted write: retry the exact apply input. Token recovery distinguishes
  the unchanged source from an already committed candidate; do not mint a
  different request until readback is complete.
