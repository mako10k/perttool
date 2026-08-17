# POSTDUE Check Projection Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-17
- Accepted candidate parent: `08d7e62`
- Plan task: `POSTDUE_CHECK`
- Target identity: `Perttool.CheckResult.v6`
- Active identity: unchanged `Perttool.CheckResult.v5`

## Decision

Accept the internal target Check projection that attaches the shared compact
schedule-alert object only after successful structural validation. Invalid
Check results cannot carry alerts. The projection verifies document identity
and the exact 64-step compact driver bound without invoking another parser,
scheduler, alert evaluator, or path implementation.

Alert occurrences are not diagnostics. Existing diagnostics and their
truncation remain unchanged, while alert summary, total, occurrence
truncation, typed unavailable causes, and exact full-analysis argv remain
independently visible. Alert presence preserves the successful result and
does not implement warnings-as-errors behavior.

Ten dependency-ordered `PDCHECK` cases cover target identity, validation-phase
suppression, compact limits, argv, independent truncation, diagnostic and exit
boundaries, document binding, evaluator ownership, and public non-activation.
Focused, static, documentation, English, and self-use gates pass before the
status-only mutation.

The target module remains outside public exports, CLI, schemas, and adapters.
Public text and JSON activation, release, remote writes, Issue mutation, and
plan advance remain separate.
