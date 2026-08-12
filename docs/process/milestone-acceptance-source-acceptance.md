# Milestone Acceptance Source and Migration Acceptance

- Document status: Accepted 1.0
- Review date: 2026-08-12
- Plan: [`plans/milestone-acceptance.pert`](../../plans/milestone-acceptance.pert)
- Plan task: `MILESTONE_ACCEPTANCE_SOURCE`
- Source model: 1
- Target grammar: Grammar 7
- Active public runtime: Grammar 6, CLI Contract 7
- Public activation status: not implemented

## 1. Decision

Accept the internal Grammar 7 milestone-acceptance source capability and the
pure committed-source migration planner. The implementation owns only the
three source record identities, exact parsing and spans, structural and
commitment validation, canonical record formatting, migration proof binding,
and migration-baseline candidate construction.

The active parser, CLI, package root, 45-command registry, 21-schema catalog,
analysis, Next, mutation, advance, LSP, VSIX, and MCP remain unchanged. The
future public task must activate the accepted capability atomically; this task
does not make Grammar 7 an accepted input to current public commands.

## 2. Source boundary

`src/milestone-acceptance/source.ts` defines the identity-checked internal
capability and these exact records:

- `milestone_criterion_set` with one non-empty revision, at least one required
  criterion, unique criterion IDs, exact criterion commitments, and one exact
  set commitment;
- `milestone_acceptance_receipt` with exact current set and criterion binding,
  the closed action and evidence kinds, strict caller-asserted UTC `Z`
  provenance, reason-bearing waiver input, and exact revocation target; and
- `milestone_acceptance_migration` with repository, relative path, object
  format, commit, blob, source, semantic candidate commitment, and sorted
  grandfathered IDs.

Unknown or duplicate scalar fields, optional-only sets, duplicate criteria,
commitment mismatches, receipt-before-set ordering, evidence-kind mismatches,
invalid verifier time, unavailable revocation targets, malformed object IDs,
unsorted or duplicate grandfather IDs, and unknown milestones fail closed.
The parser retains exact UTF-16-compatible source spans and delegates the
unchanged document body to the existing Grammar 6 validator.

## 3. Migration boundary

`src/milestone-acceptance/migration.ts` plans preparation only. A successful
input binds an opaque repository identity, repository-relative path, SHA-1 or
SHA-256 object format, exact `HEAD` commit and blob, stage-0 blob equal to the
`HEAD` blob, and raw source digest equal to current bytes. The candidate:

1. changes only the project grammar version to 7;
2. inserts one compact versioned migration baseline;
3. records exactly the sorted milestones explicitly stored as `state reached`
   in the pre-migration source; and
4. creates no criterion set, receipt, waiver, or accepted state.

The semantic `candidate_digest` avoids a self-referential raw-byte digest. The
later Application result owns the ordinary raw final-candidate digest. A
separate exact recheck function detects repository, path, object, index, and
source races before the future safe-write composition. No Git command, file
write, clock, authentication, or external service is used by this pure slice.

## 4. Verification

[`milestone-acceptance-source-v1.json`](../../test/fixtures/milestone-acceptance-source-v1.json)
fixes twelve dependency-ordered cases. The focused implementation test covers
valid and invalid criterion commitments, required/optional validation, receipt
provenance, committed migration, dirty/staged/unbound/raced proof, exact
grandfathering, source spans, internal-only distribution, and unchanged public
catalog counts.

Acceptance requires:

```sh
npm run build
node --test test/milestone-acceptance-source.test.mjs
npm run check
git diff --check
```

The complete repository gate passed 990 tests, the English baseline over 808
text files, documentation checks over 228 Markdown files and seven PERT
examples, all 36 self-use plans, isolated LSP/MCP/VSIX and supported VS Code
1.101.0 host checks, temporary linking, and the 687-file isolated package
workflow. `git diff --check` also passed.

No task beyond
`MILESTONE_ACCEPTANCE_SOURCE`, plan advance, Git commit or remote write,
release, publication, dist-tag, Issue mutation, or editor installation is
authorized by this record.
