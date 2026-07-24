# AI Agent Guidance Provider baseline

- Document status: Active 0.1
- Verification date: 2026-07-23
- Issue: [#2 Mechanism to output AI development guidance](https://github.com/mako10k/perttool/issues/2)
- Implementation plan: [../../plans/agent-guidance.pert](../../plans/agent-guidance.pert)
- Machine-readable input: [../../test/fixtures/agent-guidance/provider-baseline.v1.json](../../test/fixtures/agent-guidance/provider-baseline.v1.json)
- Public contract: [../specs/agent-guidance.md](../specs/agent-guidance.md)

## 1. Purpose

Reverify official documentation for Codex, GitHub Copilot, Claude Code, Grok Build, and Antigravity from the same perspective, and establish the inputs for designing the common contract for Issue #2.

This document and fixture are not normative interfaces. The subsequent [AI Agent Guidance Registry specification](../specs/agent-guidance.md) is the source of truth for published surface IDs, support statuses, schemas, projections, and diagnostics. `maturity_evidence` here is also not perttool's support determination; it is evidence recording the state stated by official documentation at the time of investigation.

## 2. Investigation method and boundary

- Use only official documentation for each provider as of 2026-07-23 as evidence
- Limit web references to this design-time investigation; a future runtime registry reads only versioned offline snapshots
- When official documentation does not state an artifact path, use an empty array and do not fill it from similarities to other providers
- When identically named features differ between providers, retain `provider_terms` and factual descriptions rather than force-converting them to common terminology
- For surfaces with execution capability, such as hooks, shells within skills, MCP, and delegated agents, retain risk for trust, permissions, and side effects as well as artifact paths
- When product surfaces differ, as for GitHub Copilot and Antigravity, do not generalize them to one entire product

Fixture sources contain URLs and verification dates. Do not connect to the web during implementation to update them, nor automatically update dates alone. For revalidation, a human reviews differences from official documentation and updates the fixture as a normal source change.

## 3. Comparison results

| Provider | Instruction | Workflow | Delegated agent | Enforcement | Prompt | Connector |
| --- | --- | --- | --- | --- | --- | --- |
| Codex | `AGENTS.md` / override | Agent Skills | Subagents / custom agent TOML | hooks | custom prompts are deprecated | MCP in `config.toml` |
| GitHub Copilot | Copilot instructions, path instructions, agent instructions | Agent Skills | custom agent profile | hooks depend on Coding Agent/CLI | `*.prompt.md` is public preview in some IDEs | MCP differs by surface between CLI files and GitHub settings |
| Claude Code | `CLAUDE.md` / rules | Skills | subagent Markdown | hooks in settings | Skills, compatible custom commands | `.mcp.json`, etc. |
| Grok Build | `AGENTS.md` family and Claude-compatible instructions | Skills | subagents, plugin/Claude-compatible agents | hooks and permission rules | user-invocable skills/commands | Grok config and MCP-compatible files |
| Antigravity | global `GEMINI.md` / workspace rules | Skills / Workflows | built-in and in-conversation dynamic custom subagents | `hooks.json` | slash-invoked Workflows | `mcp_config.json` |

This table is an index; the fixture is the source of truth for paths, scope, maturity, risk, and evidence.

## 4. Areas where inference was avoided

### 4.1 Antigravity

Official Rules/Workflows documentation explains that Workflows are Markdown at global or workspace scope, but does not state storage paths. Therefore the `prompt` artifact is an empty array. Because custom subagents are defined during a conversation with `define_subagent` and can be reused until the conversation ends, `delegated_agent` also has no persistent artifact path.

### 4.2 Grok Build

Official documentation describes subagents, plugins containing agents, and compatibility with Claude Code agents. However, because no native loose custom-agent-file path could be confirmed, the `delegated_agent` artifact is an empty array. Claude-compatible paths are not copied as Grok-native paths.

### 4.3 GitHub Copilot

Instructions, skills, custom agents, hooks, prompt files, and MCP differ in support scope and storage method across Copilot Coding Agent, CLI, and IDE. The fixture retains the verified surfaces and scopes in its descriptions and does not treat all Copilot features as reading the same artifact.

### 4.4 Codex

Custom prompts are officially deprecated, and Skills are recommended. Record the `prompt` surface as deprecated rather than omitting it, so that future guidance does not recommend the old method. Project-local hooks and MCP have a trusted-project boundary, and hooks can execute commands; do not treat them as mere safe help text.

## 5. Inputs to the subsequent contract

`GUIDANCE_CONTRACT` established the following from this baseline in the [public contract](../specs/agent-guidance.md).

1. Stable IDs for provider, surface, guidance, risk, and alias
2. Support statuses `native`, `compatible`, `preview`, `deprecated`, `unsupported`, and `unknown`, plus conversion rules from maturity evidence in this baseline
3. Versioned results that retain provider product-surface differences, empty artifact paths, and staleness
4. Composition order for project guidance and provider guidance
5. Text/JSON projections, diagnostics, and exit codes
6. The boundary between read-only v1 and future audit, scaffold, enforcement, and runtime refresh

This baseline phase did not implement the public contract, Core, CLI, file generation, hook execution, or provider-connector connections. The public contract was added in a subsequent design phase, but Core, CLI, file generation, hook execution, and provider-connector connections remained later tasks.
