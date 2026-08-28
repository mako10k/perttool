# Planning Pool request schema examples

These examples are low-level request documents for automation and integration
authors. Discover the complete closed Draft 2020-12 contract with
`perttool schema SCHEMA_ID`. Routine interactive use should prefer the
human-oriented planning intent options described by `perttool help`.

## Reshape request

Validate this document against `Perttool.PlanningReshapeRequest.v1` before
passing it to `work reshape preflight` or `work reshape apply` with
`--request`.

```json
{
  "request_schema_version": "Perttool.PlanningReshapeRequest.v1",
  "normalization_contract": "perttool.planning-reshape-normalization@1",
  "source_digest": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
  "intent": "reshape",
  "affected_work_ids": [],
  "created_works": [],
  "removed_work_ids": [],
  "semantic_elements": [],
  "planning_entity_dispositions": [],
  "association_dispositions": [],
  "projection_link_dispositions": [],
  "dependency_dispositions": [],
  "window_membership_dispositions": [],
  "final_work_order": [],
  "add_residual_description": [],
  "strict_fragment": null,
  "window_close": null
}
```

## Window mutation request

Validate this document against `Perttool.WindowMutationRequest.v1` before
passing it to `window add`, `window set`, or `window close` with `--request`.

```json
{
  "request_schema_version": "Perttool.WindowMutationRequest.v1",
  "source_digest": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
  "operation": "add",
  "window_id": "SPRINT",
  "final": {
    "title": "Sprint",
    "objective": "Deliver one explicit outcome",
    "start": null,
    "end": null,
    "work_ids": []
  },
  "objective_disposition": null,
  "carry_over_work_ids": [],
  "carry_over_target": null
}
```

## Observation request

Validate this document against `Perttool.PlanningObservationRequest.v1`
before passing it to `work observe` or `window observe` with `--request`.

```json
{
  "request_schema_version": "Perttool.PlanningObservationRequest.v1",
  "source_digest": "sha256:0000000000000000000000000000000000000000000000000000000000000000",
  "selection": {
    "kind": "pool"
  },
  "observation_at": null,
  "close_dispositions": []
}
```

Every request root and nested object is closed. Unknown fields, unsupported
enum values, and a mismatched `request_schema_version` are validation errors.
