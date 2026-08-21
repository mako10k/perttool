# Issue #23 Assurance-Recovery Acceptance

Status: Accepted locally on 2026-08-21.

## Decision

Keep the established `replan_and_reseal` required action and make its selected
CLI mutation executable for a newly added unsealed task. In an already enabled
model, `plan-assurance reseal --task ID` may establish that selected task's
first accepted basis. An entirely disabled model still requires the atomic
`plan-assurance seal` path.

## Compatibility boundary

The correction applies to both hash model 1 in Grammar 6/7 and hash model 2 in
Grammar 8. Existing selected seals continue to update in place; missing
selected seals are inserted without changing unselected seals or outcomes.
Dependency closure, validation, governance, persistence, result identities,
Grammar 8, CLI Contract 9, command and schema counts, and release authority
remain unchanged.

## Verification

Focused model-1 and model-2 regression cases prove that the emitted
`replan_and_reseal` action accepts the new task, preserves existing seal bytes,
and reaches complete coverage. The complete Node.js 22 repository gate passed
1,229 tests, static analysis with one obsolete complexity exception removed,
English and 338-Markdown checks, self-use, isolated LSP and MCP packages,
supported VS Code 1.101.0 host acceptance, temporary linking, and the 876-file
installed-package workflow.

Release selection, publication, npm dist-tag movement, Issue mutation, and
plan advance remain separate.
