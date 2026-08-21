# Issue #6 History-Provenance Public Acceptance

Status: Accepted on 2026-08-21.

## Public surface

`project history` and `project observe-velocity` add the closed option
`--history-provenance automatic|new-root`. The default is compatible
`automatic`. Help and the `actuals` Guide provide a command-line path to the
explicit recovery and state that it is read-only.

`Perttool.ProjectHistoryResult.v1` and
`Perttool.VelocityObservationResult.v1` retain their identities. Their shared
history metadata add one required `provenance` object with request/effective
mode, override flag, root binding, and ordered excluded-predecessor evidence.
Text and JSON are projections of the same value, and velocity observation
reuses the exact history evidence. Explicit evidence failure uses `PTHIS-105`.

Grammar 8, CLI Contract 9, command and schema counts, package exports,
automatic behavior, mutation authority, and write behavior are unchanged.
Release selection, publication, remote writes, Issue mutation, and Git
integration remain separate.
