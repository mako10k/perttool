# POSTDUE Alert Core Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-17
- Accepted candidate parent: `bdc4db6`
- Plan: [`plans/temporal-schedule.pert`](../../plans/temporal-schedule.pert)
- Plan task: `POSTDUE_ALERT_CORE`
- Contract: [Temporal Schedule Contract](../specs/temporal-schedule.md)
- Algorithm: `perttool.schedule-alert@1`
- Active public runtime: unchanged Grammar 7 and CLI Contract 8

## 1. Accepted implementation

Accept the internal pure schedule-alert evaluator over explicit accepted
Source, forward schedule, required schedule, target, and event-completion
facts. It performs no file, clock, Git, locale, network, command, or source
mutation operation and does not invoke another parser or scheduler.

The evaluator implements strict current POSTDUE, precedence-first
POSTDUE_FORECAST, optimal-false resource qualification, matching-key
deduplication, stable source-bound occurrence IDs, deterministic ordering,
known totals, alert truncation, and typed forward-schedule unavailability.
Completed or incomparable events do not acquire inferred warnings.

## 2. Driver implementation

The driver evaluator walks only exact-driving incoming AoA edges in the
target predecessor cone with stable lexical tie-breaking. Project finish uses
the same complete cone rule; intermediate task or milestone targets cannot
receive an unrelated global path. Resource proof adds explicit
`resource_wait` steps only where the accepted resource schedule reports a
positive wait and retains `optimal=false` on the alert proof.

Driver state is `available`, `not_computed`, or `unavailable`. Compact and
full limits retain a deterministic prefix, exact step count, truncation, and
the original operand as one element of exact `dag analyze --schedule both`
argv data.

## 3. Verification and boundaries

Sixteen dependency-ordered cases cover capability and source identity,
strictness, completion, both forecast proofs and priority, target identity,
deduplication, project and target drivers, resource waits, recovery argv,
stable ordering, alert and driver limits, unavailable projection, and public
non-activation.

Focused alert, contract, required-schedule, constraint, and dependency tests;
static type, duplication, and complexity gates; documentation and English
checks; self-use; adapter/package boundaries; temporary link; and the isolated
package gate are required for completion. The package exports remain closed:
the internal evaluator is compiled for repository tests but is not exported
from the root, Core, or Node public facades.

The complete aggregate retains only the independently known
`recommendation-self-use-shadow.test.mjs` mismatch for
`plans/editor-mutations.pert`: live source recommends
`EDITOR_RECOVERABLE_CONTRACT`, while its unrelated retained golden expects
`EDITOR_REPAIR_ACCEPTANCE`. Neither artifact is changed by this task. The
first supported VS Code host invocation aborted in the host Node/V8 module
resolver before extension execution; one bounded identical rerun passed the
complete trusted/untrusted install, replacement, and uninstall gate.

After verification, a status-only plan mutation marks `POSTDUE_ALERT_CORE`
done. The three command-projection tasks become the next parallel frontier.
No plan advance is performed.

Check, Analysis, and Next integration, public result schemas and exports,
Grammar 8 and CLI Contract 9 activation, release, publication, remote writes,
Issue mutation, and plan advance remain separate.
