import type {
  AgentGuidanceDiagnostic,
  AgentGuidanceProjectedStatusEvidence,
  AgentGuidanceResult,
  GuidanceDescription,
} from "./types.js";

function list(values: readonly string[]): string {
  return values.length === 0 ? "-" : values.join(",");
}

function date(value: string | null): string {
  return value ?? "?";
}

function readOnlyLine(result: AgentGuidanceResult): string {
  return [
    "READ-ONLY",
    `files=${result.capabilities.writesFiles}`,
    `hooks=${result.capabilities.executesHooks}`,
    `commands=${result.capabilities.executesCommands}`,
    `network=${result.capabilities.accessesNetwork}`,
    `provider-write=${result.capabilities.writesProviderState}`,
  ].join(" ");
}

function collectEvidence(
  result: AgentGuidanceResult,
): readonly AgentGuidanceProjectedStatusEvidence[] {
  const values: AgentGuidanceProjectedStatusEvidence[] = [];
  const keys = new Set<string>();
  for (const provider of result.providers) {
    for (const surface of provider.surfaces) {
      for (const evidence of [
        surface.statusEvidence,
        ...surface.artifacts.map(({ statusEvidence }) => statusEvidence),
      ]) {
        const key = `${evidence.evidenceKind}\0${evidence.sourceIds.join("\0")}`;
        if (!keys.has(key)) {
          keys.add(key);
          values.push(evidence);
        }
      }
    }
  }
  return values;
}

function collectDescriptions(
  result: AgentGuidanceResult,
): readonly GuidanceDescription[] {
  const values: GuidanceDescription[] = [];
  const keys = new Set<string>();
  const add = (description: GuidanceDescription | null): void => {
    if (description === null) return;
    const key = [
      description.key,
      ...description.parameters.flatMap(({ name, value }) => [name, value]),
      description.text,
    ].join("\0");
    if (keys.has(key)) return;
    keys.add(key);
    values.push(description);
  };
  for (const provider of result.providers) {
    for (const surface of provider.surfaces) {
      add(surface.statusEvidence.description);
      for (const artifact of surface.artifacts) {
        add(artifact.statusEvidence.description);
      }
    }
  }
  for (const guidance of result.guidanceRecords) add(guidance.description);
  for (const risk of result.riskRecords) add(risk.description);
  return values;
}

export function renderAgentGuidanceText(result: AgentGuidanceResult): string {
  const lines = [
    `AGENT GUIDANCE schema=${result.schemaVersion} profile=${result.profileDataVersion} snapshot=${result.snapshotAsOf}`,
  ];
  if (result.query.level === "index") {
    for (const provider of result.providers) {
      lines.push(
        `PROVIDER ${provider.providerId} aliases=${list(provider.aliases)} surfaces=${list(provider.availableSurfaceIds)}`,
      );
    }
    lines.push(readOnlyLine(result));
    return `${lines.join("\n")}\n`;
  }

  lines.push(
    `QUERY provider=${result.query.canonicalProviderId ?? "*"} surface=${result.query.surfaceId ?? "*"} level=${result.query.level} alias=${result.query.aliasApplied}`,
  );
  for (const provider of result.providers) {
    lines.push(`PROVIDER ${provider.providerId} ${provider.displayName}`);
    for (const surface of provider.surfaces) {
      lines.push(
        `SURFACE ${surface.surfaceId} support=${surface.supportStatus} artifact=${surface.artifactResolution}`,
      );
      for (const artifact of surface.artifacts) {
        lines.push(
          `ARTIFACT ${artifact.artifactId} primary=${artifact.primary} scopes=${list(artifact.scopeIds)} status=${artifact.supportStatus} path=${artifact.path ?? "?"}`,
        );
      }
    }
  }
  for (const guidance of result.guidanceRecords) {
    lines.push(
      `GUIDANCE ${guidance.guidanceId} directive=${guidance.directive}`,
    );
  }
  for (const risk of result.riskRecords) {
    lines.push(
      `RISK ${risk.riskId} kind=${risk.kind} mitigated-by=${list(risk.mitigationGuidanceIds)}`,
    );
  }
  for (const provider of result.providers) {
    for (const surface of provider.surfaces) {
      lines.push(
        `STALENESS status=${surface.staleness.status} verified-at=${date(surface.staleness.verifiedAt)} review-after=${date(surface.staleness.reviewAfter)} basis=${surface.staleness.basisDate}`,
      );
    }
  }
  for (const evidence of collectEvidence(result)) {
    lines.push(
      `EVIDENCE ${evidence.evidenceKind} sources=${list(evidence.sourceIds)}`,
    );
  }
  if (result.query.level === "detail") {
    for (const description of collectDescriptions(result)) {
      lines.push(`DESCRIPTION ${description.key}: ${description.text}`);
    }
    for (const source of result.sources) {
      lines.push(`SOURCE ${source.sourceId} ${source.url ?? "?"}`);
    }
  }
  lines.push(readOnlyLine(result));
  return `${lines.join("\n")}\n`;
}

export function agentGuidanceExitCode(
  diagnostics: readonly AgentGuidanceDiagnostic[],
): 0 | 1 | 70 {
  if (diagnostics.some(({ code }) => code === "PTAGT-302" || code === "PTAGT-303")) {
    return 70;
  }
  return diagnostics.some(({ severity }) => severity === "error") ? 1 : 0;
}
