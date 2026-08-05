# Read-Only MCP Contract

- Document status: Accepted 1.0
- Date: 2026-08-05
- Workstream: `ADAPTER-001`
- Task: `MCP_READ_CONTRACT`
- MCP protocol model version: 1
- Parent contract: [adapter-platform.md](adapter-platform.md)
- Machine cases: [../../test/fixtures/mcp-read-contract-cases-v1.json](../../test/fixtures/mcp-read-contract-cases-v1.json)

## 1. Scope

This specification fixes the first fail-closed read-only MCP server before
implementation. It owns:

- the exact MCP protocol, SDK, runtime, transport, and lifecycle baseline;
- the closed resource and tool capability set;
- inline and launcher-registered document source identity;
- tool input, output, diagnostic, and protocol-error mapping;
- cancellation, concurrency, request, source, and result limits; and
- semantic parity with the shared Application services and CLI fixtures.

It does not implement or distribute the server. It does not add a public
package, root export, CLI command, CLI schema, network listener, remote source,
Git-ref source, preview mutation, persistent mutation, or write authority.
Connection state, client metadata, transport metadata, and local process
identity grant no governance, plan-assurance, task-selection, or mutation
authority.

## 2. Protocol, SDK, and runtime baseline

Protocol model 1 selects the final
[MCP 2026-07-28 specification](https://modelcontextprotocol.io/specification/2026-07-28)
and only the local
[stdio transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio).
The implementation input is exact
[`@modelcontextprotocol/server` `2.0.0`](https://github.com/modelcontextprotocol/typescript-sdk/releases/tag/%40modelcontextprotocol%2Fserver%402.0.0),
whose stable release aligns with that final protocol revision. The private
workspace is `adapters/mcp`, uses Node.js `>=22`, ESM/ES2024, and has the
repository-only package identity `perttool-mcp-private` with `private: true`.

The server supports only protocol revision `2026-07-28`. Negotiation that does
not select that revision fails before resources or tools become usable. A
later compatible revision, legacy fallback, Streamable HTTP, SSE, socket, or
custom transport requires a new protocol-model decision.

The local MCP client launches one server subprocess. The subprocess reads
newline-delimited JSON-RPC messages from stdin, writes only valid MCP messages
to stdout, and sends optional human logs only to stderr. It starts no listener,
performs no network discovery, and launches no child CLI. Client EOF terminates
the server; protocol shutdown and cancellation are honored. A malformed
message cannot be repaired from a later line.

Per-request client information, capabilities, and metadata are transport
context only. They do not select a project, source, result version, owner,
approval, or authority.

## 3. Capability closure and discovery

The server advertises exactly `resources` and `tools`. The resource capability
has neither subscriptions nor list-change notification. The tool capability
has no list-change notification. The server advertises no prompts,
completions, roots, sampling, elicitation, tasks, logging, or extensions.

`resources/list`, `resources/read`, and `tools/list` return complete,
deterministically ordered snapshots. There are no resource templates. A
resource or tool absent from those snapshots is unavailable even if a related
Application function or CLI command exists in the installed package. Package
exports and connection metadata are not capability-discovery inputs.

Every listed tool has these MCP annotations:

```json
{
  "readOnlyHint": true,
  "destructiveHint": false,
  "idempotentHint": true,
  "openWorldHint": false
}
```

The annotations describe the accepted implementation but do not grant or
replace perttool authority.

## 4. Resources

The exact static resource list is:

| URI | Name | Shared owner | Representation |
| --- | --- | --- | --- |
| `perttool://capabilities` | `perttool capabilities` | MCP adapter contract and neutral capability catalog | `Perttool.McpCapabilities.v1` |
| `perttool://help/commands` | `perttool command help` | Contract 7 command registry | top-level `Perttool.CommandHelpResult.v1` projection |
| `perttool://guide/index` | `perttool guide index` | Contract 7 Guide registry | index `Perttool.GuideResult.v1` projection |
| `perttool://schemas` | `perttool schema catalog` | bundled schema registry | catalog `Perttool.SchemaResult.v1` projection |

Every resource has media type `application/json` and returns one UTF-8 text
content item. Resource reads invoke the same in-process registries as the
package facade; they do not invoke the CLI, read a `.pert` document, or inspect
Git. Query parameters, fragments, alternate spellings, unknown URIs, and
resource templates are rejected as invalid resource identifiers. Resources
are immutable for the lifetime of one server process, have no subscription,
and are listed in the table order above.

`Perttool.McpCapabilities.v1` reports protocol model and revision, exact
resource and tool names, result identities, source-selector kinds, limits,
and all unavailable capability classes. It never reports an accepted owner,
current project, connection-derived authority, or registered absolute path.

## 5. Document source identity

The three document tools accept one closed `source` union.

```ts
type McpDocumentSourceV1 =
  | {
      kind: "inline";
      text: string;
      expectedDigest?: `sha256:${string}`;
    }
  | {
      kind: "registered";
      documentId: string;
      expectedDigest: `sha256:${string}`;
    };
```

An inline source is the exact UTF-8 encoding of `text`. The server computes
its SHA-256 digest and rejects a supplied non-matching `expectedDigest`. No
Unicode normalization, newline conversion, formatting, or source repair is
performed.

A registered source is a closed mapping injected by the trusted local launcher
before protocol service starts. Each record maps one non-empty ASCII
`documentId` to one absolute local path. Duplicate IDs, relative paths, and
more than the accepted registration limit make server startup fail. The wire
request contains only the ID and mandatory expected digest; the absolute path
is never listed or returned. The Node document-byte port performs one exact
read, the standard fatal UTF-8 decoder preserves the accepted BOM behavior,
and the digest is calculated over the raw bytes. Missing, unreadable,
non-UTF-8, oversized, or digest-mismatched input fails before Application
dispatch.

The registered mapping is local launcher configuration, not a permission,
approval, project catalog, or durable perttool setting. Model 1 accepts no
wire path, `file:` URI, cwd-relative lookup, glob, workspace root, Git
repository, Git ref, commit, remote URL, stdin alias, or server-side source
registration. A changed registered file requires the caller to observe and
send its new digest; there is no blind retry.

Every document-tool result echoes a public source binding containing only
`kind`, registered `document_id` or null, and computed `source_digest`.

## 6. Tools and input schemas

The exact tool list is:

| Tool | Neutral operation | Application result | MCP wire result |
| --- | --- | --- | --- |
| `perttool_check` | `document_check` | `Perttool.CheckResult.v4` | `Perttool.McpCheckResult.v1` |
| `perttool_analyze` | `dag_analyze` | `Perttool.AnalysisResult.v5` | `Perttool.McpAnalyzeResult.v1` |
| `perttool_next` | `dag_next` | `Perttool.NextResult.v6` | `Perttool.McpNextResult.v1` |
| `perttool_help` | `command_help` or `guide` | `Perttool.CommandHelpResult.v1` or `Perttool.GuideResult.v1` | `Perttool.McpHelpResult.v1` |
| `perttool_schema` | `schema_lookup` | `Perttool.SchemaResult.v1` | `Perttool.McpSchemaResult.v1` |

Each tool registers a Draft 2020-12 JSON input schema with `type: "object"`,
an exact `required` set, and `additionalProperties: false` at every object
boundary. Unions use closed discriminators. Schemas have no remote reference.

`perttool_check` accepts `source` and `max_diagnostics`. The default diagnostic
limit is 100; the accepted range is 1 through 1000.

`perttool_analyze` accepts `source`, `schedule`, `capacities`, `max_paths`,
`precision`, and `max_diagnostics`. Defaults are `both`, an empty capacity
list, 1, 3, and 100. `schedule` is `precedence`, `resource`, or `both`;
`max_paths` is 0 through 1000; `precision` is 0 through 9. Each capacity has a
non-empty resource ID and an integer from 1 through 2147483647; IDs are unique.

`perttool_next` accepts `source`, `capacities`, `explain_depth`, `precision`,
and `max_diagnostics`. Defaults are an empty capacity list, 1, 3, and 100.
`explain_depth` is 0 through 32; the other ranges and uniqueness rules match
analysis. The source digest is always supplied to the Application start-
authority evaluation.

`perttool_help` has discriminator `kind`. `command` accepts nullable
`resource` and `action`, with an action requiring a resource. `guide` accepts
nullable `topic_id` and level `index`, `quick`, or `detail`, subject to the
same combinations as Contract 7 Guide. It returns an explicit not-found
Application result rather than guessing a command or topic.

`perttool_schema` accepts nullable `schema_id`, view `full` or `outline`, and
nullable `ref`. A null schema ID permits only the default full catalog. A
reference requires one schema ID and outline view. Only the bundled twenty-
schema catalog is available.

`warnings-as-errors`, color, text output selection, CLI source labels, and CLI
exit statuses are adapter concerns and are not MCP semantic options. Unknown,
duplicate, out-of-range, or contradictory fields return `InvalidParams`
without Application dispatch.

## 7. Output, diagnostics, and errors

Every tool registers a self-contained Draft 2020-12 output schema in the
private adapter. It is closed, has no external or remote reference, and is not
added to the public CLI schema catalog. Local `$defs` references are permitted
only within that same schema closure; they are required for recursive JSON
values in `Perttool.SchemaResult.v1`. Each MCP result has exactly:

- its literal `Perttool.Mcp*Result.v1` `schema_version`;
- `mcp_protocol_model_version: 1`;
- the literal neutral `operation`;
- a source binding or null;
- the exact accepted Application `result_schema_version`; and
- a JSON-safe, closed semantic `result` projection.

The adapter projection uses the shared diagnostic, exact Rational, temporal,
actuals, assurance, recommendation, help, and schema meanings. It does not
serialize CST internals, JavaScript `Map`, `bigint`, absolute paths, process
metadata, or client metadata. MCP wire identities are adapter contracts: they
are not aliases for CLI result identities and are not inserted into the
twenty-schema CLI catalog.

For successful and domain-invalid calls, `structuredContent` is the complete
MCP result and `content` contains exactly one `application/json` text
serialization of the same object. A domain-invalid check, analysis, or next
result keeps all bounded Domain diagnostics and uses `isError: true`; it is not
converted into a transport error. In particular, an incomplete or truncated
`Perttool.NextResult.v6` remains visibly incomplete or truncated and cannot be
treated as start authority.

Source and adapter failures use closed `Perttool.McpSourceError.v1` structured
content with one of these stable diagnostics:

| Code | Meaning |
| --- | --- |
| `PTMCP-101` | registered document ID is unknown |
| `PTMCP-102` | source is unavailable or not valid UTF-8 |
| `PTMCP-103` | expected and computed source digests differ |
| `PTMCP-104` | request or source limit is exceeded |
| `PTMCP-105` | complete result exceeds the output limit |
| `PTMCP-106` | Application result identity or MCP output validation fails |
| `PTMCP-107` | adapter deadline or cancellation prevents a result |
| `PTMCP-108` | requested capability is unavailable in model 1 |

Malformed JSON-RPC or tool arguments use the protocol's parse or
`InvalidParams` (`-32602`) errors. Unknown methods and tool names use
`MethodNotFound` (`-32601`). Unknown resource identifiers use
`InvalidParams`. An internal invariant or output-schema failure uses
`InternalError` (`-32603`) and emits no partial semantic result. Protocol
errors and `PTMCP-*` diagnostics never replace a Domain diagnostic for a
completed Application result.

## 8. Limits, cancellation, and lifecycle safety

Protocol model 1 fixes these limits:

| Limit | Value |
| --- | ---: |
| JSON-RPC line before dispatch | 262144 bytes |
| inline or registered source | 2097152 bytes |
| complete serialized tool result | 8388608 bytes |
| launcher registrations | 64 |
| capacity overrides | 256 |
| concurrent tool calls | 8 |
| wall time before result eligibility expires | 30000 milliseconds |
| diagnostics | default 100, maximum 1000 |

The server rejects an over-limit request; it never truncates source, tool
arguments, capability lists, resource JSON, semantic arrays, or authority
traces to fit. Domain diagnostic truncation occurs only through the explicit
accepted diagnostic limit and preserves its truncation flag. An over-limit
complete result returns `PTMCP-105` without partial `structuredContent`.

Cancellation observed before dispatch prevents Application invocation.
Cancellation, client EOF, or deadline expiry observed after a synchronous
Application call discards the completed value and emits no stale semantic
result. Model 1 does not claim preemptive interruption inside synchronous Core
calculation. A cancelled or expired result is never cached and never retried
automatically.

No request changes the registration catalog, another request's options, or a
process-global semantic default. Concurrent requests own independent immutable
source bytes, source bindings, options, and cancellation state.

## 9. Parity and safety invariants

For the same raw source bytes, digest, explicit options, and injected Host
evidence, each MCP tool calls the same Application function as the package
facade. A parity comparison removes only the documented MCP outer fields and
compares the complete JSON-safe semantic projection. The adapter must not
invoke the CLI, parse CLI output, repair source, recalculate PERT values, alter
diagnostic severity, reorder entities, or manufacture recommendation
authority.

The first server exposes no operation corresponding to format, init, set,
add, remove, start, suspend, resume, finish, batch, migrate, advance, import,
export, render, override, history mutation, or safe persistence. It does not
call the Node Host's Git-evidence or safe-persistence ports. It does not read
environment credentials, execute workspace code, fetch remote content, emit
telemetry, stage or modify Git, or write a `.pert` or artifact file.

Building, packing, linking, installing, or testing the private workspace does
not publish it, publish the root package, create a tag or release, move a
dist-tag, install globally, or modify user MCP configuration.

## 10. Normative cases

| Case | Boundary | Required result |
| --- | --- | --- |
| `MCR-001` | Protocol | exact 2026-07-28, Node.js 22, SDK 2.0.0, and local stdio baseline |
| `MCR-002` | Lifecycle | stdout closure, stderr logging, EOF, shutdown, and no listener or child CLI |
| `MCR-003` | Discovery | only resources and tools are advertised with complete deterministic lists |
| `MCR-004` | Resources | exact four immutable JSON resources and no templates or subscriptions |
| `MCR-005` | Inline source | exact UTF-8 text and optional digest assertion bind one request |
| `MCR-006` | Registered source | launcher-only ID, mandatory digest, hidden absolute path, and no wire registration |
| `MCR-007` | Check | closed input and `Perttool.McpCheckResult.v1` map to CheckResult v4 |
| `MCR-008` | Analyze | closed bounded options and `Perttool.McpAnalyzeResult.v1` map to AnalysisResult v5 |
| `MCR-009` | Next | exact digest, complete authority trace, and `Perttool.McpNextResult.v1` map to NextResult v6 |
| `MCR-010` | Help | command and Guide lookup retain the two accepted shared registries |
| `MCR-011` | Schema | full, outline, and detail lookup remain inside the bundled catalog |
| `MCR-012` | Results | local closed output schemas and exact content/structured-content identity |
| `MCR-013` | Diagnostics | Domain, source, adapter, and protocol failures retain distinct ownership |
| `MCR-014` | Limits | requests, sources, registrations, options, concurrency, time, and output fail closed |
| `MCR-015` | Parity | one Application result underlies MCP and CLI/Core semantic projections |
| `MCR-016` | Side effects | no mutation, arbitrary source, Git, network, telemetry, publication, or authority inference |

The machine fixture preserves this dependency order and the exact values used
by implementation acceptance.

## 11. Acceptance boundary

This contract is accepted when:

1. requirements, parent architecture, Basic Design, backlog, plan, this
   specification, and all sixteen machine cases agree;
2. the official protocol and stable SDK input are current and explicit;
3. resource, tool, source, schema, result, error, cancellation, and limit
   behavior is closed and implementable through accepted Core and Node ports;
4. CLI/Core parity has an exact comparison boundary without invoking the CLI;
5. focused tests, documentation, English baseline, self-use plan checks, and
   the complete repository gate pass; and
6. no adapter implementation, dependency, root export, command, CLI schema,
   release selection, publication, remote write, Issue mutation, or plan
   advance is included.

Implementation begins only in `MCP_READ_ADAPTER` after both
`MCP_CONTRACT_READY` and `NODE_PORTS_READY` are reached. MCP mutation,
arbitrary path or Git-ref sources, Streamable HTTP, public distribution, and
release work remain separate decisions.
