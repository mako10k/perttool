# Issue #6 History Provenance Contract Acceptance

Date: 2026-08-21

The contract in `docs/specs/history-provenance-choice.md` is accepted as the
bounded implementation authority for `ISSUE6_PROVENANCE_CONTRACT`.

It preserves automatic fail-closed rename inference and adds only one explicit,
read-only `new-root` interpretation. The request and result bind repository,
path, revision, HEAD, project identity, source digests, root commit, and
excluded predecessor evidence. Twelve dependency-ordered cases fix success,
failure, race, compatibility, packaging, and no-write behavior.

Reviewed-predecessor acceptance, similarity policy, durable receipts, and Git
mutation remain separately unselected in `SCM-002`. Release selection,
publication, Issue mutation, and plan advance remain separate.

The accompanying llmthink RCA has no fatal, error, warning, info, or hint
finding.
