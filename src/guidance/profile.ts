import {
  AGENT_GUIDANCE_PROVIDER_IDS,
  AGENT_GUIDANCE_SCOPE_IDS,
  AGENT_GUIDANCE_SURFACE_IDS,
  type AgentGuidanceArtifactProfile,
  type AgentGuidanceEvidenceKind,
  type AgentGuidanceProfile,
  type AgentGuidanceProviderId,
  type AgentGuidanceProviderProfile,
  type AgentGuidanceRecordProfile,
  type AgentGuidanceRiskProfile,
  type AgentGuidanceScopeId,
  type AgentGuidanceSourceProfile,
  type AgentGuidanceSupportStatus,
  type AgentGuidanceSurfaceId,
  type AgentGuidanceSurfaceProfile,
  type GuidanceDescription,
} from "./types.js";
import {
  compareAgentGuidanceUtf8,
  createAgentGuidanceProfileSnapshot,
} from "./validator.js";

const SNAPSHOT_AS_OF = "2026-07-23";
const DEFAULT_REVIEW_AFTER = "2026-10-23";

const evidenceKinds: Readonly<
  Record<AgentGuidanceSupportStatus, AgentGuidanceEvidenceKind>
> = {
  native: "official_native_documentation",
  compatible: "official_compatibility_documentation",
  preview: "official_preview_notice",
  deprecated: "official_deprecation_notice",
  unsupported: "official_unsupported_notice",
  unknown: "insufficient_official_evidence",
};

const statusDescriptions: Readonly<
  Record<AgentGuidanceSupportStatus, string>
> = {
  native: "Official documentation identifies a provider-native surface.",
  compatible:
    "Official documentation identifies compatibility with another provider format.",
  preview: "Official documentation identifies this surface as preview.",
  deprecated: "Official documentation identifies this surface as deprecated.",
  unsupported:
    "Official documentation explicitly identifies this surface as unavailable.",
  unknown:
    "The inspected official documentation is insufficient to classify support.",
};

function description(key: string, text: string): GuidanceDescription {
  return {
    key,
    parameters: [],
    text,
  };
}

export const AGENT_GUIDANCE_GUIDANCE_REGISTRY_V1: readonly AgentGuidanceRecordProfile[] =
  [
    {
      guidanceId: "project_plan_is_authority",
      origin: "project_control",
      directive: "must",
      surfaceIds: [],
      description: description(
        "guidance.project_plan_is_authority",
        "Treat the project model as the source of task priority.",
      ),
    },
    {
      guidanceId: "consult_dag_next_before_start",
      origin: "project_control",
      directive: "must",
      surfaceIds: [],
      description: description(
        "guidance.consult_dag_next_before_start",
        "Consult the project recommendation before starting new work.",
      ),
    },
    {
      guidanceId: "recompute_after_state_change",
      origin: "project_control",
      directive: "must",
      surfaceIds: [],
      description: description(
        "guidance.recompute_after_state_change",
        "Recompute the project after advancing project state.",
      ),
    },
    {
      guidanceId: "require_explicit_human_override",
      origin: "project_control",
      directive: "must",
      surfaceIds: [],
      description: description(
        "guidance.require_explicit_human_override",
        "Record non-recommended work as an explicit human override.",
      ),
    },
    {
      guidanceId: "keep_provider_priority_identical",
      origin: "project_control",
      directive: "must",
      surfaceIds: [],
      description: description(
        "guidance.keep_provider_priority_identical",
        "Keep project priority rules identical across providers.",
      ),
    },
    {
      guidanceId: "use_narrowest_durable_surface",
      origin: "common_surface",
      directive: "should",
      surfaceIds: AGENT_GUIDANCE_SURFACE_IDS,
      description: description(
        "guidance.use_narrowest_durable_surface",
        "Use the narrowest durable surface that satisfies the required scope.",
      ),
    },
    {
      guidanceId: "preserve_scope_and_precedence",
      origin: "common_surface",
      directive: "must",
      surfaceIds: AGENT_GUIDANCE_SURFACE_IDS,
      description: description(
        "guidance.preserve_scope_and_precedence",
        "Preserve provider scope and instruction precedence.",
      ),
    },
    {
      guidanceId: "review_executable_customization",
      origin: "common_surface",
      directive: "must",
      surfaceIds: AGENT_GUIDANCE_SURFACE_IDS,
      description: description(
        "guidance.review_executable_customization",
        "Review customization that can execute code or external tools.",
      ),
    },
    {
      guidanceId: "treat_unknown_as_unavailable",
      origin: "common_surface",
      directive: "must",
      surfaceIds: AGENT_GUIDANCE_SURFACE_IDS,
      description: description(
        "guidance.treat_unknown_as_unavailable",
        "Treat unknown support or placement as unavailable until verified.",
      ),
    },
    {
      guidanceId: "review_stale_profile_before_adoption",
      origin: "common_surface",
      directive: "should",
      surfaceIds: AGENT_GUIDANCE_SURFACE_IDS,
      description: description(
        "guidance.review_stale_profile_before_adoption",
        "Review stale profile evidence before adopting a new artifact.",
      ),
    },
  ];

export const AGENT_GUIDANCE_RISK_REGISTRY_V1: readonly AgentGuidanceRiskProfile[] =
  [
    {
      riskId: "instruction_precedence_changes_effective_policy",
      kind: "scope",
      surfaceIds: ["instruction"],
      mitigationGuidanceIds: ["preserve_scope_and_precedence"],
      description: description(
        "risk.instruction_precedence_changes_effective_policy",
        "Instruction precedence can change the effective project policy.",
      ),
    },
    {
      riskId: "instruction_truncation_hides_policy",
      kind: "scope",
      surfaceIds: ["instruction"],
      mitigationGuidanceIds: ["use_narrowest_durable_surface"],
      description: description(
        "risk.instruction_truncation_hides_policy",
        "Instruction truncation can hide required project policy.",
      ),
    },
    {
      riskId: "workflow_executes_commands",
      kind: "execution",
      surfaceIds: ["workflow"],
      mitigationGuidanceIds: ["review_executable_customization"],
      description: description(
        "risk.workflow_executes_commands",
        "A reusable workflow can execute commands.",
      ),
    },
    {
      riskId: "delegation_loses_parent_context",
      kind: "delegation",
      surfaceIds: ["delegated_agent"],
      mitigationGuidanceIds: [
        "project_plan_is_authority",
        "consult_dag_next_before_start",
      ],
      description: description(
        "risk.delegation_loses_parent_context",
        "A delegated agent can lose required parent context.",
      ),
    },
    {
      riskId: "parallel_writes_conflict",
      kind: "delegation",
      surfaceIds: ["delegated_agent"],
      mitigationGuidanceIds: ["preserve_scope_and_precedence"],
      description: description(
        "risk.parallel_writes_conflict",
        "Parallel delegated work can create conflicting writes.",
      ),
    },
    {
      riskId: "hook_executes_code",
      kind: "execution",
      surfaceIds: ["enforcement"],
      mitigationGuidanceIds: ["review_executable_customization"],
      description: description(
        "risk.hook_executes_code",
        "An enforcement hook can execute code.",
      ),
    },
    {
      riskId: "hook_can_block_or_mutate_flow",
      kind: "execution",
      surfaceIds: ["enforcement"],
      mitigationGuidanceIds: [
        "review_executable_customization",
        "require_explicit_human_override",
      ],
      description: description(
        "risk.hook_can_block_or_mutate_flow",
        "An enforcement hook can block or mutate the agent workflow.",
      ),
    },
    {
      riskId: "prompt_not_persistent",
      kind: "scope",
      surfaceIds: ["prompt"],
      mitigationGuidanceIds: ["use_narrowest_durable_surface"],
      description: description(
        "risk.prompt_not_persistent",
        "A manually invoked prompt may not persist project policy.",
      ),
    },
    {
      riskId: "connector_accesses_external_data",
      kind: "external_access",
      surfaceIds: ["connector"],
      mitigationGuidanceIds: ["review_executable_customization"],
      description: description(
        "risk.connector_accesses_external_data",
        "A connector can access external data.",
      ),
    },
    {
      riskId: "connector_can_execute_external_action",
      kind: "external_access",
      surfaceIds: ["connector"],
      mitigationGuidanceIds: [
        "review_executable_customization",
        "require_explicit_human_override",
      ],
      description: description(
        "risk.connector_can_execute_external_action",
        "A connector can execute an external action.",
      ),
    },
    {
      riskId: "provider_surface_availability_varies",
      kind: "compatibility",
      surfaceIds: AGENT_GUIDANCE_SURFACE_IDS,
      mitigationGuidanceIds: ["treat_unknown_as_unavailable"],
      description: description(
        "risk.provider_surface_availability_varies",
        "Surface availability can vary across provider products and releases.",
      ),
    },
    {
      riskId: "profile_may_be_stale",
      kind: "staleness",
      surfaceIds: AGENT_GUIDANCE_SURFACE_IDS,
      mitigationGuidanceIds: ["review_stale_profile_before_adoption"],
      description: description(
        "risk.profile_may_be_stale",
        "The bundled provider profile can become stale.",
      ),
    },
    {
      riskId: "artifact_path_unknown",
      kind: "compatibility",
      surfaceIds: AGENT_GUIDANCE_SURFACE_IDS,
      mitigationGuidanceIds: ["treat_unknown_as_unavailable"],
      description: description(
        "risk.artifact_path_unknown",
        "The durable artifact path is not established by official evidence.",
      ),
    },
    {
      riskId: "compatibility_not_native",
      kind: "compatibility",
      surfaceIds: AGENT_GUIDANCE_SURFACE_IDS,
      mitigationGuidanceIds: ["preserve_scope_and_precedence"],
      description: description(
        "risk.compatibility_not_native",
        "A compatible artifact is not a provider-native artifact.",
      ),
    },
  ];

interface ArtifactDefinition {
  readonly key: string;
  readonly path: string;
  readonly scopes: readonly AgentGuidanceScopeId[];
  readonly status?: AgentGuidanceSupportStatus;
}

interface SurfaceDefinition {
  readonly surfaceId: AgentGuidanceSurfaceId;
  readonly providerTerms: readonly string[];
  readonly scopes: readonly AgentGuidanceScopeId[];
  readonly sourceIds: readonly string[];
  readonly artifacts: readonly ArtifactDefinition[];
  readonly status?: AgentGuidanceSupportStatus;
  readonly fact?: string;
}

function evidence(
  status: AgentGuidanceSupportStatus,
  sourceIds: readonly string[],
  fact: string,
) {
  return {
    evidenceKind: evidenceKinds[status],
    sourceIds,
    facts: [fact],
    description: description(`status.${status}`, statusDescriptions[status]),
  };
}

const scopeRank = new Map(
  AGENT_GUIDANCE_SCOPE_IDS.map((scopeId, index) => [scopeId, index]),
);

function compareArtifacts(
  left: AgentGuidanceArtifactProfile,
  right: AgentGuidanceArtifactProfile,
): number {
  return (
    Number(right.primary) - Number(left.primary) ||
    (scopeRank.get(left.scopeIds[0]!) ?? Number.MAX_SAFE_INTEGER) -
      (scopeRank.get(right.scopeIds[0]!) ?? Number.MAX_SAFE_INTEGER) ||
    compareAgentGuidanceUtf8(left.path, right.path) ||
    compareAgentGuidanceUtf8(left.artifactId, right.artifactId)
  );
}

function makeSurface(
  providerId: AgentGuidanceProviderId,
  definition: SurfaceDefinition,
): AgentGuidanceSurfaceProfile {
  const artifacts = definition.artifacts
    .map((artifact, index): AgentGuidanceArtifactProfile => {
      const status = artifact.status ?? definition.status ?? "native";
      return {
        artifactId: `${providerId}.${definition.surfaceId}.${artifact.key}`,
        path: artifact.path,
        scopeIds: artifact.scopes,
        primary: index === 0,
        supportStatus: status,
        statusEvidence: evidence(
          status,
          definition.sourceIds,
          status === "compatible"
            ? `Official documentation identifies ${artifact.path} as a compatible artifact.`
            : (definition.fact ??
                `Official documentation identifies ${providerId} ${definition.surfaceId} support.`),
        ),
      };
    })
    .sort(compareArtifacts);
  const surfaceStatus =
    artifacts.find(({ primary }) => primary)?.supportStatus ??
    definition.status ??
    "native";
  const artifactResolution = artifacts.length === 0 ? "unknown" : "known";
  const riskIds = AGENT_GUIDANCE_RISK_REGISTRY_V1.filter(
    ({ riskId, surfaceIds }) =>
      surfaceIds.includes(definition.surfaceId) &&
      (riskId !== "artifact_path_unknown" || artifactResolution === "unknown") &&
      (riskId !== "compatibility_not_native" ||
        artifacts.some(({ supportStatus }) => supportStatus === "compatible")),
  ).map(({ riskId }) => riskId);
  return {
    surfaceId: definition.surfaceId,
    supportStatus: surfaceStatus,
    primaryArtifactId:
      artifacts.find(({ primary }) => primary)?.artifactId ?? null,
    artifactResolution,
    providerTerms: definition.providerTerms,
    scopes: definition.scopes,
    artifacts,
    guidanceIds: AGENT_GUIDANCE_GUIDANCE_REGISTRY_V1.filter(
      ({ surfaceIds }) =>
        surfaceIds.length === 0 || surfaceIds.includes(definition.surfaceId),
    ).map(({ guidanceId }) => guidanceId),
    riskIds,
    statusEvidence: evidence(
      surfaceStatus,
      definition.sourceIds,
      definition.fact ??
        `Official documentation identifies ${providerId} ${definition.surfaceId} support.`,
    ),
    verifiedAt: SNAPSHOT_AS_OF,
    reviewAfter: DEFAULT_REVIEW_AFTER,
  };
}

function makeProvider(
  providerId: AgentGuidanceProviderId,
  displayName: string,
  aliases: readonly string[],
  definitions: readonly SurfaceDefinition[],
): AgentGuidanceProviderProfile {
  return {
    providerId,
    displayName,
    aliases,
    surfaces: definitions.map((definition) =>
      makeSurface(providerId, definition),
    ),
  };
}

const sources: readonly AgentGuidanceSourceProfile[] = [
  {
    sourceId: "codex-agents-md",
    providerId: "codex",
    title: "Custom instructions with AGENTS.md",
    url: "https://learn.chatgpt.com/docs/agent-configuration/agents-md.md",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "codex-skills",
    providerId: "codex",
    title: "Build skills",
    url: "https://learn.chatgpt.com/docs/build-skills.md",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "codex-subagents",
    providerId: "codex",
    title: "Subagents",
    url: "https://learn.chatgpt.com/docs/agent-configuration/subagents.md",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "codex-hooks",
    providerId: "codex",
    title: "Hooks",
    url: "https://learn.chatgpt.com/docs/hooks.md",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "codex-custom-prompts",
    providerId: "codex",
    title: "Custom Prompts",
    url: "https://learn.chatgpt.com/docs/custom-prompts.md",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "codex-mcp",
    providerId: "codex",
    title: "Model Context Protocol",
    url: "https://learn.chatgpt.com/docs/extend/mcp.md",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "github-response-customization",
    providerId: "github-copilot",
    title: "About customizing GitHub Copilot responses",
    url: "https://docs.github.com/en/copilot/concepts/prompting/response-customization",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "github-agent-skills",
    providerId: "github-copilot",
    title: "About agent skills",
    url: "https://docs.github.com/en/copilot/concepts/agents/about-agent-skills",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "github-custom-agents-cli",
    providerId: "github-copilot",
    title: "Creating and using custom agents for GitHub Copilot CLI",
    url: "https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-custom-agents-for-cli",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "github-hooks",
    providerId: "github-copilot",
    title: "About hooks",
    url: "https://docs.github.com/en/copilot/concepts/agents/hooks",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "github-prompt-files",
    providerId: "github-copilot",
    title: "Adding repository custom instructions for GitHub Copilot in your IDE",
    url: "https://docs.github.com/en/copilot/how-tos/configure-custom-instructions-in-your-ide/add-repository-instructions-in-your-ide",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "github-cli-config",
    providerId: "github-copilot",
    title: "GitHub Copilot CLI configuration directory",
    url: "https://docs.github.com/en/copilot/reference/copilot-cli-reference/cli-config-dir-reference",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "claude-directory",
    providerId: "claude-code",
    title: "Explore the .claude directory",
    url: "https://code.claude.com/docs/en/claude-directory",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "claude-skills",
    providerId: "claude-code",
    title: "Extend Claude with skills",
    url: "https://code.claude.com/docs/en/slash-commands",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "claude-subagents",
    providerId: "claude-code",
    title: "Create custom subagents",
    url: "https://code.claude.com/docs/en/sub-agents",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "claude-hooks",
    providerId: "claude-code",
    title: "Hooks reference",
    url: "https://code.claude.com/docs/en/hooks",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "claude-mcp",
    providerId: "claude-code",
    title: "Connect Claude Code to tools via MCP",
    url: "https://code.claude.com/docs/en/mcp",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "grok-extensions",
    providerId: "grok-build",
    title: "Skills, Plugins and Marketplaces",
    url: "https://docs.x.ai/build/features/skills-plugins-marketplaces",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "grok-permissions",
    providerId: "grok-build",
    title: "Permissions",
    url: "https://docs.x.ai/build/features/permissions",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "grok-mcp",
    providerId: "grok-build",
    title: "MCP Servers",
    url: "https://docs.x.ai/build/features/mcp-servers",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "grok-release-notes",
    providerId: "grok-build",
    title: "Release Notes",
    url: "https://docs.x.ai/developers/release-notes",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "antigravity-rules-workflows",
    providerId: "antigravity",
    title: "Rules and Workflows",
    url: "https://www.antigravity.google/docs/rules-workflows",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "antigravity-skills",
    providerId: "antigravity",
    title: "Agent Skills",
    url: "https://www.antigravity.google/docs/skills",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "antigravity-subagents",
    providerId: "antigravity",
    title: "Asynchronous Subagents",
    url: "https://www.antigravity.google/docs/subagents",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "antigravity-hooks",
    providerId: "antigravity",
    title: "Hooks",
    url: "https://www.antigravity.google/docs/hooks",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "antigravity-mcp",
    providerId: "antigravity",
    title: "Model Context Protocol",
    url: "https://www.antigravity.google/docs/mcp",
    verifiedAt: SNAPSHOT_AS_OF,
  },
  {
    sourceId: "antigravity-plugins",
    providerId: "antigravity",
    title: "Plugins",
    url: "https://www.antigravity.google/docs/plugins",
    verifiedAt: SNAPSHOT_AS_OF,
  },
];

const providers: readonly AgentGuidanceProviderProfile[] = [
  makeProvider("codex", "Codex", [], [
    {
      surfaceId: "instruction",
      providerTerms: ["AGENTS.md", "AGENTS.override.md"],
      scopes: ["repository", "directory", "user"],
      sourceIds: ["codex-agents-md"],
      artifacts: [
        {
          key: "agents",
          path: "AGENTS.md",
          scopes: ["repository", "directory"],
        },
        {
          key: "agents-override",
          path: "AGENTS.override.md",
          scopes: ["repository", "directory"],
        },
        {
          key: "user-agents",
          path: "~/.codex/AGENTS.md",
          scopes: ["user"],
        },
        {
          key: "user-agents-override",
          path: "~/.codex/AGENTS.override.md",
          scopes: ["user"],
        },
      ],
    },
    {
      surfaceId: "workflow",
      providerTerms: ["Agent Skills"],
      scopes: ["repository", "directory", "user", "admin", "system", "plugin"],
      sourceIds: ["codex-skills"],
      artifacts: [
        {
          key: "project-skill",
          path: ".agents/skills/<skill-name>/SKILL.md",
          scopes: ["repository", "directory"],
        },
        {
          key: "user-skill",
          path: "~/.agents/skills/<skill-name>/SKILL.md",
          scopes: ["user"],
        },
      ],
    },
    {
      surfaceId: "delegated_agent",
      providerTerms: ["subagent", "custom agent"],
      scopes: ["repository", "user", "session"],
      sourceIds: ["codex-subagents"],
      artifacts: [
        {
          key: "project-agent",
          path: ".codex/agents/<agent-name>.toml",
          scopes: ["repository"],
        },
        {
          key: "user-agent",
          path: "~/.codex/agents/<agent-name>.toml",
          scopes: ["user"],
        },
      ],
    },
    {
      surfaceId: "enforcement",
      providerTerms: ["hooks"],
      scopes: ["repository", "user", "managed", "plugin"],
      sourceIds: ["codex-hooks"],
      artifacts: [
        {
          key: "project-hooks",
          path: ".codex/hooks.json",
          scopes: ["repository"],
        },
        {
          key: "project-config",
          path: ".codex/config.toml",
          scopes: ["repository"],
        },
        {
          key: "user-hooks",
          path: "~/.codex/hooks.json",
          scopes: ["user"],
        },
        {
          key: "user-config",
          path: "~/.codex/config.toml",
          scopes: ["user"],
        },
      ],
    },
    {
      surfaceId: "prompt",
      providerTerms: ["custom prompts"],
      scopes: ["user"],
      sourceIds: ["codex-custom-prompts"],
      status: "deprecated",
      fact: "Official documentation marks custom prompts deprecated and recommends Skills.",
      artifacts: [
        {
          key: "user-prompt",
          path: "~/.codex/prompts/<prompt-name>.md",
          scopes: ["user"],
        },
      ],
    },
    {
      surfaceId: "connector",
      providerTerms: ["MCP"],
      scopes: ["repository", "user", "plugin"],
      sourceIds: ["codex-mcp"],
      artifacts: [
        {
          key: "project-config",
          path: ".codex/config.toml",
          scopes: ["repository"],
        },
        {
          key: "user-config",
          path: "~/.codex/config.toml",
          scopes: ["user"],
        },
      ],
    },
  ]),
  makeProvider("github-copilot", "GitHub Copilot", [], [
    {
      surfaceId: "instruction",
      providerTerms: [
        "repository custom instructions",
        "path-specific custom instructions",
        "agent instructions",
      ],
      scopes: ["repository", "directory", "user", "organization"],
      sourceIds: ["github-response-customization"],
      artifacts: [
        {
          key: "repository-instructions",
          path: ".github/copilot-instructions.md",
          scopes: ["repository"],
        },
        {
          key: "path-instructions",
          path: ".github/instructions/<instruction-name>.instructions.md",
          scopes: ["repository"],
        },
        {
          key: "agents-compatible",
          path: "AGENTS.md",
          scopes: ["repository", "directory"],
          status: "compatible",
        },
      ],
    },
    {
      surfaceId: "workflow",
      providerTerms: ["Agent Skills"],
      scopes: ["repository", "user", "organization"],
      sourceIds: ["github-agent-skills"],
      artifacts: [
        {
          key: "github-skill",
          path: ".github/skills/<skill-name>/SKILL.md",
          scopes: ["repository"],
        },
        {
          key: "agents-compatible-skill",
          path: ".agents/skills/<skill-name>/SKILL.md",
          scopes: ["repository", "compatibility"],
          status: "compatible",
        },
        {
          key: "claude-compatible-skill",
          path: ".claude/skills/<skill-name>/SKILL.md",
          scopes: ["repository", "compatibility"],
          status: "compatible",
        },
        {
          key: "user-skill",
          path: "~/.copilot/skills/<skill-name>/SKILL.md",
          scopes: ["user"],
        },
        {
          key: "user-compatible-skill",
          path: "~/.agents/skills/<skill-name>/SKILL.md",
          scopes: ["user", "compatibility"],
          status: "compatible",
        },
      ],
    },
    {
      surfaceId: "delegated_agent",
      providerTerms: ["custom agent", "subagent"],
      scopes: ["repository", "user", "organization", "enterprise", "session"],
      sourceIds: ["github-custom-agents-cli"],
      artifacts: [
        {
          key: "project-agent",
          path: ".github/agents/<agent-name>.agent.md",
          scopes: ["repository"],
        },
        {
          key: "user-agent",
          path: "~/.copilot/agents/<agent-name>.agent.md",
          scopes: ["user"],
        },
      ],
    },
    {
      surfaceId: "enforcement",
      providerTerms: ["hooks"],
      scopes: ["repository", "user"],
      sourceIds: ["github-hooks"],
      artifacts: [
        {
          key: "project-hook",
          path: ".github/hooks/<hook-name>.json",
          scopes: ["repository"],
        },
        {
          key: "user-hook",
          path: "~/.copilot/hooks/<hook-name>.json",
          scopes: ["user"],
        },
      ],
    },
    {
      surfaceId: "prompt",
      providerTerms: ["prompt files"],
      scopes: ["repository", "workspace"],
      sourceIds: ["github-prompt-files"],
      status: "preview",
      fact: "Official documentation marks prompt files as public preview in selected IDEs.",
      artifacts: [
        {
          key: "project-prompt",
          path: ".github/prompts/<prompt-name>.prompt.md",
          scopes: ["repository", "workspace"],
        },
      ],
    },
    {
      surfaceId: "connector",
      providerTerms: ["MCP"],
      scopes: ["repository", "user", "organization"],
      sourceIds: ["github-cli-config"],
      artifacts: [
        {
          key: "workspace-mcp",
          path: ".mcp.json",
          scopes: ["repository"],
        },
        {
          key: "github-mcp",
          path: ".github/mcp.json",
          scopes: ["repository"],
        },
        {
          key: "user-mcp",
          path: "~/.copilot/mcp-config.json",
          scopes: ["user"],
        },
      ],
    },
  ]),
  makeProvider("claude-code", "Claude Code", [], [
    {
      surfaceId: "instruction",
      providerTerms: ["CLAUDE.md", "rules"],
      scopes: ["repository", "directory", "user", "managed"],
      sourceIds: ["claude-directory"],
      artifacts: [
        {
          key: "claude",
          path: "CLAUDE.md",
          scopes: ["repository", "directory"],
        },
        {
          key: "project-rule",
          path: ".claude/rules/<rule-name>.md",
          scopes: ["repository"],
        },
        {
          key: "user-claude",
          path: "~/.claude/CLAUDE.md",
          scopes: ["user"],
        },
        {
          key: "user-rule",
          path: "~/.claude/rules/<rule-name>.md",
          scopes: ["user"],
        },
      ],
    },
    {
      surfaceId: "workflow",
      providerTerms: ["Skills"],
      scopes: [
        "repository",
        "directory",
        "user",
        "enterprise",
        "plugin",
      ],
      sourceIds: ["claude-skills"],
      artifacts: [
        {
          key: "project-skill",
          path: ".claude/skills/<skill-name>/SKILL.md",
          scopes: ["repository", "directory"],
        },
        {
          key: "user-skill",
          path: "~/.claude/skills/<skill-name>/SKILL.md",
          scopes: ["user"],
        },
      ],
    },
    {
      surfaceId: "delegated_agent",
      providerTerms: ["subagent"],
      scopes: ["repository", "user", "session", "plugin"],
      sourceIds: ["claude-subagents"],
      artifacts: [
        {
          key: "project-agent",
          path: ".claude/agents/<agent-name>.md",
          scopes: ["repository"],
        },
        {
          key: "user-agent",
          path: "~/.claude/agents/<agent-name>.md",
          scopes: ["user"],
        },
      ],
    },
    {
      surfaceId: "enforcement",
      providerTerms: ["hooks", "permissions"],
      scopes: ["repository", "user", "managed", "plugin"],
      sourceIds: ["claude-hooks"],
      artifacts: [
        {
          key: "project-settings",
          path: ".claude/settings.json",
          scopes: ["repository"],
        },
        {
          key: "project-local-settings",
          path: ".claude/settings.local.json",
          scopes: ["repository", "user"],
        },
        {
          key: "user-settings",
          path: "~/.claude/settings.json",
          scopes: ["user"],
        },
      ],
    },
    {
      surfaceId: "prompt",
      providerTerms: ["Skills", "custom commands"],
      scopes: ["repository", "directory", "user", "plugin"],
      sourceIds: ["claude-skills"],
      artifacts: [
        {
          key: "project-skill",
          path: ".claude/skills/<skill-name>/SKILL.md",
          scopes: ["repository", "directory"],
        },
        {
          key: "project-command",
          path: ".claude/commands/<command-name>.md",
          scopes: ["repository"],
          status: "compatible",
        },
        {
          key: "user-skill",
          path: "~/.claude/skills/<skill-name>/SKILL.md",
          scopes: ["user"],
        },
        {
          key: "user-command",
          path: "~/.claude/commands/<command-name>.md",
          scopes: ["user", "compatibility"],
          status: "compatible",
        },
      ],
    },
    {
      surfaceId: "connector",
      providerTerms: ["MCP"],
      scopes: ["repository", "user", "managed", "local", "plugin"],
      sourceIds: ["claude-mcp"],
      artifacts: [
        {
          key: "project-mcp",
          path: ".mcp.json",
          scopes: ["repository"],
        },
        {
          key: "user-local-config",
          path: "~/.claude.json",
          scopes: ["user", "local"],
        },
      ],
    },
  ]),
  makeProvider("grok-build", "Grok Build", ["grok"], [
    {
      surfaceId: "instruction",
      providerTerms: [
        "AGENTS.md instruction-file family",
        "Claude Code compatibility instructions",
      ],
      scopes: ["repository", "directory", "user", "compatibility"],
      sourceIds: ["grok-extensions"],
      artifacts: [
        {
          key: "agents",
          path: "AGENTS.md",
          scopes: ["repository", "directory"],
        },
        {
          key: "agents-case",
          path: "Agents.md",
          scopes: ["repository", "directory"],
        },
        {
          key: "agent",
          path: "AGENT.md",
          scopes: ["repository", "directory"],
        },
        {
          key: "claude-compatible",
          path: "CLAUDE.md",
          scopes: ["repository", "directory", "compatibility"],
          status: "compatible",
        },
        {
          key: "claude-rules-compatible",
          path: ".claude/rules/<rule-name>.md",
          scopes: ["repository", "directory", "compatibility"],
          status: "compatible",
        },
      ],
    },
    {
      surfaceId: "workflow",
      providerTerms: ["Skills"],
      scopes: ["repository", "directory", "user", "plugin", "compatibility"],
      sourceIds: ["grok-extensions"],
      artifacts: [
        {
          key: "project-skill",
          path: ".grok/skills/<skill-name>/SKILL.md",
          scopes: ["repository", "directory"],
        },
        {
          key: "user-skill",
          path: "~/.grok/skills/<skill-name>/SKILL.md",
          scopes: ["user"],
        },
        {
          key: "user-compatible-skill",
          path: "~/.agents/skills/<skill-name>/SKILL.md",
          scopes: ["user", "compatibility"],
          status: "compatible",
        },
      ],
    },
    {
      surfaceId: "delegated_agent",
      providerTerms: [
        "subagent",
        "plugin agent",
        "Claude Code compatible agent",
      ],
      scopes: ["session", "plugin", "compatibility"],
      sourceIds: ["grok-extensions"],
      artifacts: [],
      fact: "Official documentation identifies delegated agents but does not establish a native durable artifact path.",
    },
    {
      surfaceId: "enforcement",
      providerTerms: ["hooks", "permission rules"],
      scopes: ["repository", "user", "managed", "plugin"],
      sourceIds: ["grok-permissions"],
      artifacts: [
        {
          key: "project-hooks",
          path: ".grok/hooks/",
          scopes: ["repository"],
        },
        {
          key: "user-hooks",
          path: "~/.grok/hooks/",
          scopes: ["user"],
        },
        {
          key: "user-config",
          path: "~/.grok/config.toml",
          scopes: ["user"],
        },
      ],
    },
    {
      surfaceId: "prompt",
      providerTerms: ["user-invocable Skill", "command"],
      scopes: ["repository", "directory", "user", "compatibility"],
      sourceIds: ["grok-extensions"],
      artifacts: [
        {
          key: "project-skill",
          path: ".grok/skills/<skill-name>/SKILL.md",
          scopes: ["repository", "directory"],
        },
        {
          key: "user-skill",
          path: "~/.grok/skills/<skill-name>/SKILL.md",
          scopes: ["user"],
        },
        {
          key: "user-compatible-command",
          path: "~/.agents/commands/<command-name>.md",
          scopes: ["user", "compatibility"],
          status: "compatible",
        },
      ],
    },
    {
      surfaceId: "connector",
      providerTerms: ["MCP"],
      scopes: ["repository", "user", "plugin", "compatibility"],
      sourceIds: ["grok-mcp"],
      artifacts: [
        {
          key: "project-config",
          path: ".grok/config.toml",
          scopes: ["repository"],
        },
        {
          key: "user-config",
          path: "~/.grok/config.toml",
          scopes: ["user"],
        },
        {
          key: "compatible-mcp",
          path: ".mcp.json",
          scopes: ["repository", "compatibility"],
          status: "compatible",
        },
      ],
    },
  ]),
  makeProvider("antigravity", "Antigravity", [], [
    {
      surfaceId: "instruction",
      providerTerms: ["Global Rules", "Workspace Rules"],
      scopes: ["workspace", "user", "plugin"],
      sourceIds: ["antigravity-rules-workflows"],
      artifacts: [
        {
          key: "user-rule",
          path: "~/.gemini/GEMINI.md",
          scopes: ["user"],
        },
        {
          key: "workspace-rule",
          path: ".agents/rules/<rule-name>.md",
          scopes: ["workspace"],
        },
        {
          key: "legacy-workspace-rule",
          path: ".agent/rules/<rule-name>.md",
          scopes: ["workspace", "compatibility"],
          status: "compatible",
        },
      ],
    },
    {
      surfaceId: "workflow",
      providerTerms: ["Agent Skills", "Workflows"],
      scopes: ["workspace", "user", "plugin"],
      sourceIds: ["antigravity-skills", "antigravity-rules-workflows"],
      artifacts: [
        {
          key: "workspace-skill",
          path: ".agents/skills/<skill-name>/SKILL.md",
          scopes: ["workspace"],
        },
        {
          key: "user-skill",
          path: "~/.gemini/config/skills/<skill-name>/SKILL.md",
          scopes: ["user"],
        },
        {
          key: "legacy-workspace-skill",
          path: ".agent/skills/<skill-name>/SKILL.md",
          scopes: ["workspace", "compatibility"],
          status: "compatible",
        },
      ],
    },
    {
      surfaceId: "delegated_agent",
      providerTerms: ["asynchronous subagent", "dynamic custom subagent"],
      scopes: ["workspace", "conversation"],
      sourceIds: ["antigravity-subagents"],
      artifacts: [],
      fact: "Official documentation identifies conversation-scoped delegated agents without a persistent custom-agent artifact.",
    },
    {
      surfaceId: "enforcement",
      providerTerms: ["Hooks"],
      scopes: ["workspace", "user", "plugin"],
      sourceIds: ["antigravity-hooks"],
      artifacts: [
        {
          key: "workspace-hooks",
          path: ".agents/hooks.json",
          scopes: ["workspace"],
        },
        {
          key: "user-hooks",
          path: "~/.gemini/config/hooks.json",
          scopes: ["user"],
        },
      ],
    },
    {
      surfaceId: "prompt",
      providerTerms: ["Workflows"],
      scopes: ["workspace", "user"],
      sourceIds: ["antigravity-rules-workflows"],
      artifacts: [],
      fact: "Official documentation identifies manually invoked Workflows without an explicit file-system path.",
    },
    {
      surfaceId: "connector",
      providerTerms: ["MCP"],
      scopes: ["workspace", "user", "plugin"],
      sourceIds: ["antigravity-mcp"],
      artifacts: [
        {
          key: "workspace-mcp",
          path: ".agents/mcp_config.json",
          scopes: ["workspace"],
        },
        {
          key: "user-mcp",
          path: "~/.gemini/config/mcp_config.json",
          scopes: ["user"],
        },
      ],
    },
  ]),
];

function compareSources(
  left: AgentGuidanceSourceProfile,
  right: AgentGuidanceSourceProfile,
): number {
  return (
    AGENT_GUIDANCE_PROVIDER_IDS.indexOf(left.providerId) -
      AGENT_GUIDANCE_PROVIDER_IDS.indexOf(right.providerId) ||
    compareAgentGuidanceUtf8(left.sourceId, right.sourceId)
  );
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

export const AGENT_GUIDANCE_PROFILE_V1 = deepFreeze<AgentGuidanceProfile>({
  schemaVersion: "Perttool.AgentGuidanceProfile.v1",
  profileDataVersion: 1,
  guidanceTaxonomyVersion: 1,
  riskTaxonomyVersion: 1,
  descriptionRegistryVersion: 1,
  descriptionLocale: "en",
  stalenessPolicyVersion: 1,
  snapshotAsOf: SNAPSHOT_AS_OF,
  providerOrder: AGENT_GUIDANCE_PROVIDER_IDS,
  surfaceOrder: AGENT_GUIDANCE_SURFACE_IDS,
  aliases: [{ alias: "grok", providerId: "grok-build" }],
  providers,
  guidanceRegistry: AGENT_GUIDANCE_GUIDANCE_REGISTRY_V1,
  riskRegistry: AGENT_GUIDANCE_RISK_REGISTRY_V1,
  sources: [...sources].sort(compareSources),
});

export const AGENT_GUIDANCE_SNAPSHOT_V1 =
  createAgentGuidanceProfileSnapshot(AGENT_GUIDANCE_PROFILE_V1);
