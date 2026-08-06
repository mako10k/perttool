# JSON Schema Artifact Contract

- Document status: Normative 1.0
- Schema artifact contract: 1
- JSON Schema dialect: Draft 2020-12
- Active CLI contract version: 7
- Created: 2026-07-30
- Requirements: [../requirements.md](../requirements.md)
- Related issue: [Issue #5](https://github.com/mako10k/perttool/issues/5)

## 1. Scope

This specification defines the machine-readable JSON Schema artifacts for
every result identity advertised by the active Contract 7 command registry
and the supported public library-only override result. It also defines
catalog discovery, package layout, reusable definitions, and compatibility
rules.

This contract does not change an existing result payload merely to simplify
its schema. It does not define command-line argument schemas, MCP tools, LSP
messages, VSIX messages, or a hosted schema service.

## 2. Dialect, identity, and layout

Every artifact MUST use JSON Schema Draft 2020-12:

```text
https://json-schema.org/draft/2020-12/schema
```

A root result artifact has this stable identity and package-relative path:

```text
$id:
  https://github.com/mako10k/perttool/schemas/<schema-id>.schema.json
path:
  schemas/<schema-id>.schema.json
package export:
  perttool/schemas/<schema-id>.schema.json
```

`$id` is a stable identifier, not an instruction to fetch a network
resource. Validation MUST resolve the bundled files locally. The package MUST
also include `schemas/Perttool.Common.v1.schema.json`, which supplies relative
Draft 2020-12 references shared by root artifacts.

Every root artifact fixes its exact `schema_version` with `const`, fixes
`cli_contract_version=7` for CLI envelopes, and rejects unknown root fields.
Nullable and unavailable states remain explicit in the owning result schema.

Every nested object that represents a versioned result record MUST enumerate
its concrete `properties`, declare the applicable `required` fields, and set
`additionalProperties=false`. A schema MUST NOT use a bare `type: object` as
a placeholder for a nested contract. An intentionally extensible JSON map is
permitted only when `additionalProperties` contains the schema for every map
value; diagnostic `data` uses the recursive JSON-value definition for this
purpose. Arrays of records follow the same rule through their `items`
schemas.

## 3. Closed result inventory

The command registry and schema catalog MUST remain symmetric. Every
descriptor `result_schemas` identity resolves to exactly one root artifact,
and every cataloged command result is advertised by at least one descriptor.

| Schema identity | Contract role |
| --- | --- |
| `Perttool.AgentGuidanceResult.v1` | `agent help` result |
| `Perttool.AnalysisResult.v5` | `dag analyze` result with plan assurance |
| `Perttool.AdvanceResult.v2` | history- and assurance-aware `dag advance` result |
| `Perttool.CheckResult.v4` | `document check` result with plan assurance |
| `Perttool.CliError.v1` | shared structured usage error |
| `Perttool.CommandHelpResult.v1` | command discovery result |
| `Perttool.ExportResult.v1` | Mermaid export result |
| `Perttool.FormatResult.v1` | formatter result |
| `Perttool.GuideResult.v1` | domain Guide result |
| `Perttool.HistoricalGraphResult.v1` | bounded read-only historical DAG result |
| `Perttool.ImportResult.v1` | Mermaid import result |
| `Perttool.InitResult.v1` | project initialization result |
| `Perttool.MutationResult.v4` | direct, lifecycle, batch, and assurance mutation result |
| `Perttool.NextResult.v6` | next-task result and assurance-aware start authority |
| `Perttool.PlanAssuranceResult.v1` | assurance show and pinpoint hash result |
| `Perttool.ProjectHistoryResult.v1` | read-only project history result |
| `Perttool.ProjectResult.v4` | project metadata with assurance model identity |
| `Perttool.SchemaResult.v1` | schema catalog and lookup result |
| `Perttool.UnitMigrationResult.v3` | exact unit-migration result |
| `Perttool.VelocityObservationResult.v1` | observed-velocity result |
| `Perttool.OverrideDecision.v1` | supported public library-only result |

The first twenty identities are command results. OverrideDecision is not a
CLI command result, but its public root projection is a supported contract and
therefore has a root artifact.

`Perttool.GovernanceDecision.v2` and actuals records are nested contracts, not
independent result envelopes. Governance is defined by
`Perttool.Common.v1.schema.json#/$defs/governanceDecision`; actuals inputs,
lifecycle, history, and observation records are defined inside their owning
root schemas. Their embedded schema or model identifiers remain fixed, but
they are not separate catalog entries.

## 4. Discovery and resolution

The active registry contains the additive, read-only command:

```text
perttool schema [schema-id]
  [--view full|outline] [--ref <URI-reference>]
  [--format text|json]
```

Without an operand it returns the complete sorted catalog. With a known
identity it returns the same catalog and the selected schema object in
`schema`. JSON output uses `Perttool.SchemaResult.v1`.

The default and explicit `--view full` selection return the complete bundled
artifact, including its `$defs`. The default selection preserves the original
`query` projection exactly; an explicitly selected view is reported in the
optional `query.view` field.

`--view outline` returns a display projection rather than changing the
bundled validation artifact. The projection:

1. retains the selected layer's scalar, array, composition, and property
   shape;
2. replaces a nested object with concrete `properties` by an absolute `$ref`
   to its location in a bundled complete artifact;
3. omits the selected layer's `$defs` and rewrites every retained relative
   `$ref` as an absolute reference to the complete artifact; and
4. uses a projection-specific `$id`, so it cannot shadow the complete
   artifact's stable identity.

`--view outline --ref <URI-reference>` resolves one referenced detail and
returns that detail as the selected outline layer. A local JSON Pointer such
as `#/$defs/recommendation`, a relative bundled Common reference, or an
absolute reference copied from an outline is accepted. Resolution is limited
to the selected root artifact and `Perttool.Common.v1`; it performs no
network access. `--ref` requires `--view outline` and a schema identity.

An unknown identity returns exit 1, `ok=false`, `schema=null`, and
`PTSCH-001`. An invalid, unavailable, or non-bundled reference returns exit
1, `ok=false`, `schema=null`, and `PTSCH-002`. Extra operands, a view without
a schema identity, or an invalid option combination use the ordinary
`Perttool.CliError.v1` usage boundary and exit 2.

The public package root exports:

```text
getJsonSchemaCatalog()
getJsonSchema(schemaId)
getJsonSchemaResult(schemaId, options?)
```

The first two provide direct in-process catalog and artifact access. Loaded
schema values and catalog entries are immutable. Lookup performs local file
I/O only when a selected artifact is first requested; listing the catalog
does not read a project and performs no network access. The optional result
options select the same `full` or `outline` view and optional outline
reference as the CLI. `getJsonSchema(schemaId)` always returns the complete
artifact.

## 5. Versioning and compatibility

The result `schema_version`, not the tool version, is the compatibility
authority. An incompatible field removal, meaning change, or enum narrowing
requires a new result schema identity. A compatible optional field may retain
the same identity only when the owning normative result contract permits it.

Changing the dialect, `$id` convention, catalog semantics, or package layout
requires a new artifact-contract decision and migration guidance. Reusable
definitions are implementation dependencies; consumers SHOULD start
validation from a root result artifact rather than treating
`Perttool.Common.v1` as a result.

Published `perttool@0.5.0` predates these artifacts. This source-level
addition does not retroactively change that tarball and does not authorize a
new package release or npm dist-tag movement.

## 6. Verification

Repository tests MUST:

1. compare the complete descriptor result-identity set with the catalog;
2. reject missing, duplicate, or unreachable root artifacts;
3. compile every artifact with a strict Draft 2020-12 validator;
4. validate representative success, invalid, unavailable, usage-error, and
   truncated results;
5. cover the public OverrideDecision projection;
6. verify schema lookup and unknown-identity behavior; and
7. reject unknown fields in representative nested records and statically
   reject a bare or unclosed nested object contract;
8. verify that full lookup remains unchanged, outline lookup is shorter and
   uses resolvable absolute references, and a referenced detail can be
   selected independently; and
9. prove catalog, artifact, CLI, and public-library access from an isolated
   packed installation.
