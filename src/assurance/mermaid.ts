import { createHash } from "node:crypto";
import type {
  ConversionLoss,
  ConversionLossReport,
} from "../conversion/mermaid.js";
import { formatTargetGrammar6Document } from "../formatter/target-source-formatter.js";
import type { Diagnostic } from "../model/diagnostics.js";
import { compareStableStrings } from "../model/diagnostics.js";
import type {
  DeclarationNode,
  DocumentNode,
  TargetDeclarationKind,
} from "../model/syntax.js";
import { fieldNamed } from "../model/syntax.js";
import type { TargetGrammar6Capability } from "../parser/document-parser.js";
import { validateTargetGrammar6Document } from "../semantic/target-validator.js";
import {
  captureAssuranceOwnedSource,
  planAssuranceSemanticDigest,
} from "./compatibility.js";

export const PLAN_ASSURANCE_MERMAID_PROFILE_VERSION = 2 as const;

export type PlanAssuranceMermaidProfile = 2 | 1 | "plain";

export interface PlanAssuranceMermaidExportOptions {
  readonly profile?: PlanAssuranceMermaidProfile;
  readonly allowLoss?: boolean;
  readonly maxDiagnostics?: number;
}

export interface PlanAssuranceMermaidExportResultV1 {
  readonly ok: boolean;
  readonly profile: PlanAssuranceMermaidProfile;
  readonly documentId: string | null;
  readonly artifact: string | null;
  readonly artifactDigest: string | null;
  readonly canonicalSource: string | null;
  readonly assuranceSemanticDigest: string | null;
  readonly lossReport: ConversionLossReport;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

export interface PlanAssuranceMermaidImportResultV1 {
  readonly ok: boolean;
  readonly profile: 2;
  readonly documentId: string | null;
  readonly sourceText: string | null;
  readonly sourceDigest: string | null;
  readonly assuranceSemanticDigest: string | null;
  readonly lossReport: ConversionLossReport;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

interface Profile2Header {
  readonly schema_version: "Perttool.MermaidProfile.v2";
  readonly profile: "perttool";
  readonly source_fidelity: "semantic-v2";
  readonly grammar_version: 6;
  readonly source_digest: string;
  readonly assurance_semantic_digest: string;
  readonly canonical_source_base64: string;
  readonly projection_digest: string;
}

function sha256(text: string | Uint8Array): string {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function diagnostic(
  code: string,
  message: string,
  severity: "error" | "warning" = "error",
): Diagnostic {
  return Object.freeze({
    code,
    severity,
    message,
    helpTopic: "mermaid",
  });
}

function decodedTitle(declaration: DeclarationNode<TargetDeclarationKind>): string {
  const value = fieldNamed(declaration, "title")?.value;
  return typeof value === "string" ? value : declaration.id;
}

function escapeLabel(value: string): string {
  let result = "";
  for (const character of value) {
    const codePoint = character.codePointAt(0)!;
    result +=
      character === '"' ||
        character === "#" ||
        character === "&" ||
        character === ";" ||
        character === "<" ||
        character === ">" ||
        character === "\\" ||
        character === "|" ||
        character === "`" ||
        codePoint <= 0x1f ||
        codePoint === 0x7f
        ? `#${codePoint};`
        : character;
  }
  return result;
}

function graphProjection(
  document: DocumentNode<TargetDeclarationKind>,
): readonly string[] {
  const declarations = (kind: TargetDeclarationKind) =>
    document.declarations
      .filter((declaration) => declaration.kind === kind)
      .sort((left, right) => compareStableStrings(left.id, right.id));
  const lines: string[] = [];
  for (const milestone of declarations("milestone")) {
    lines.push(
      `  ptm_${milestone.id}(("${escapeLabel(`${milestone.id}: ${decodedTitle(milestone)}`)}"))`,
    );
  }
  for (const task of declarations("task")) {
    lines.push(
      `  ptm_${task.from!} -->|"${escapeLabel(`${task.id}: ${decodedTitle(task)}`)}"| ptm_${task.to!}`,
    );
  }
  for (const gate of declarations("gate")) {
    lines.push(
      `  ptm_${gate.from!} -.->|"${escapeLabel(`${gate.id}: gate`)}"| ptm_${gate.to!}`,
    );
  }
  return Object.freeze(lines);
}

function projectionArtifact(
  projection: readonly string[],
  profile: 1 | "plain",
): string {
  return [
    "flowchart LR",
    ...(profile === 1
      ? ["  %% perttool:compatibility-profile 1 lossy"]
      : []),
    ...projection,
    "",
  ].join("\n");
}

function lossRecords(
  text: string,
  document: NonNullable<
    ReturnType<typeof validateTargetGrammar6Document>["validatedDocument"]
  >,
): readonly ConversionLoss[] {
  return captureAssuranceOwnedSource(text, document).records.map((record) =>
    Object.freeze({
      code: "PTCNV-210",
      severity: "warning" as const,
      message: `${record.kind} ${record.id} is omitted from this Mermaid profile`,
      elementId: record.id,
      span: record.span,
      lossy: true,
    })
  );
}

function profile2Artifact(
  canonicalSource: string,
  assuranceSemanticDigest: string,
  projection: readonly string[],
): string {
  const projectionBody = projection.map((line) => `${line}\n`).join("");
  const header: Profile2Header = {
    schema_version: "Perttool.MermaidProfile.v2",
    profile: "perttool",
    source_fidelity: "semantic-v2",
    grammar_version: 6,
    source_digest: sha256(canonicalSource),
    assurance_semantic_digest: assuranceSemanticDigest,
    canonical_source_base64: Buffer.from(canonicalSource, "utf8").toString(
      "base64",
    ),
    projection_digest: sha256(projectionBody),
  };
  return [
    "flowchart LR",
    `  %% perttool:profile ${JSON.stringify(header)}`,
    "  %% perttool:projection-begin",
    ...projection,
    "  %% perttool:projection-end",
    "",
  ].join("\n");
}

export function exportPlanAssuranceMermaid(
  text: string,
  capability: TargetGrammar6Capability,
  options: PlanAssuranceMermaidExportOptions = {},
): PlanAssuranceMermaidExportResultV1 {
  const profile = options.profile ?? 2;
  const checked = validateTargetGrammar6Document(text, capability, {
    ...(options.maxDiagnostics === undefined
      ? {}
      : { maxDiagnostics: options.maxDiagnostics }),
  });
  if (
    !checked.ok ||
    checked.validatedDocument === null ||
    checked.validatedDocument.grammarVersion !== 6
  ) {
    return Object.freeze({
      ok: false,
      profile,
      documentId: checked.documentId,
      artifact: null,
      artifactDigest: null,
      canonicalSource: null,
      assuranceSemanticDigest: null,
      lossReport: Object.freeze({ lossless: false, records: Object.freeze([]) }),
      diagnostics: checked.diagnostics,
      diagnosticsTruncated: checked.diagnosticsTruncated,
    });
  }
  const projection = graphProjection(checked.validatedDocument.document);
  const assuranceSemanticDigest = planAssuranceSemanticDigest(
    checked.validatedDocument,
  );
  if (profile !== 2) {
    const records = lossRecords(text, checked.validatedDocument);
    if (options.allowLoss !== true) {
      return Object.freeze({
        ok: false,
        profile,
        documentId: checked.documentId,
        artifact: null,
        artifactDigest: null,
        canonicalSource: null,
        assuranceSemanticDigest,
        lossReport: Object.freeze({
          lossless: false,
          records: Object.freeze(records),
        }),
        diagnostics: Object.freeze([
          ...checked.diagnostics,
          diagnostic(
            "PTCNV-210",
            "strict Mermaid conversion rejects omitted Grammar 6 assurance facts",
          ),
        ]),
        diagnosticsTruncated: checked.diagnosticsTruncated,
      });
    }
    const artifact = projectionArtifact(projection, profile);
    return Object.freeze({
      ok: true,
      profile,
      documentId: checked.documentId,
      artifact,
      artifactDigest: sha256(artifact),
      canonicalSource: null,
      assuranceSemanticDigest,
      lossReport: Object.freeze({
        lossless: false,
        records: Object.freeze(records),
      }),
      diagnostics: checked.diagnostics,
      diagnosticsTruncated: checked.diagnosticsTruncated,
    });
  }
  const formatted = formatTargetGrammar6Document(text, capability, {
    ...(options.maxDiagnostics === undefined
      ? {}
      : { maxDiagnostics: options.maxDiagnostics }),
  });
  if (!formatted.ok || formatted.formattedText === null) {
    return Object.freeze({
      ok: false,
      profile,
      documentId: formatted.documentId,
      artifact: null,
      artifactDigest: null,
      canonicalSource: null,
      assuranceSemanticDigest,
      lossReport: Object.freeze({ lossless: false, records: Object.freeze([]) }),
      diagnostics: formatted.diagnostics,
      diagnosticsTruncated: formatted.diagnosticsTruncated,
    });
  }
  const canonicalChecked = validateTargetGrammar6Document(
    formatted.formattedText,
    capability,
  );
  if (
    !canonicalChecked.ok ||
    canonicalChecked.validatedDocument === null ||
    planAssuranceSemanticDigest(canonicalChecked.validatedDocument) !==
      assuranceSemanticDigest
  ) {
    return Object.freeze({
      ok: false,
      profile,
      documentId: formatted.documentId,
      artifact: null,
      artifactDigest: null,
      canonicalSource: null,
      assuranceSemanticDigest,
      lossReport: Object.freeze({ lossless: false, records: Object.freeze([]) }),
      diagnostics: Object.freeze([
        ...canonicalChecked.diagnostics,
        diagnostic(
          "PTCNV-106",
          "Grammar 6 formatting changed the assurance semantic projection",
        ),
      ]),
      diagnosticsTruncated: canonicalChecked.diagnosticsTruncated,
    });
  }
  const canonicalProjection = graphProjection(
    canonicalChecked.validatedDocument.document,
  );
  const artifact = profile2Artifact(
    formatted.formattedText,
    assuranceSemanticDigest,
    canonicalProjection,
  );
  return Object.freeze({
    ok: true,
    profile,
    documentId: formatted.documentId,
    artifact,
    artifactDigest: sha256(artifact),
    canonicalSource: formatted.formattedText,
    assuranceSemanticDigest,
    lossReport: Object.freeze({ lossless: true, records: Object.freeze([]) }),
    diagnostics: formatted.diagnostics,
    diagnosticsTruncated: formatted.diagnosticsTruncated,
  });
}

function invalidImport(message: string): PlanAssuranceMermaidImportResultV1 {
  return Object.freeze({
    ok: false,
    profile: 2,
    documentId: null,
    sourceText: null,
    sourceDigest: null,
    assuranceSemanticDigest: null,
    lossReport: Object.freeze({ lossless: false, records: Object.freeze([]) }),
    diagnostics: Object.freeze([diagnostic("PTCNV-102", message)]),
    diagnosticsTruncated: false,
  });
}

function parseHeader(text: string): Profile2Header | null {
  const lines = text.split("\n");
  const prefix = "  %% perttool:profile ";
  if (lines[0] !== "flowchart LR" || !lines[1]?.startsWith(prefix)) {
    return null;
  }
  let value: unknown;
  try {
    value = JSON.parse(lines[1].slice(prefix.length));
  } catch {
    return null;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const header = value as Record<string, unknown>;
  const expectedKeys = [
    "schema_version",
    "profile",
    "source_fidelity",
    "grammar_version",
    "source_digest",
    "assurance_semantic_digest",
    "canonical_source_base64",
    "projection_digest",
  ];
  if (
    JSON.stringify(Object.keys(header)) !== JSON.stringify(expectedKeys) ||
    header["schema_version"] !== "Perttool.MermaidProfile.v2" ||
    header["profile"] !== "perttool" ||
    header["source_fidelity"] !== "semantic-v2" ||
    header["grammar_version"] !== 6 ||
    typeof header["source_digest"] !== "string" ||
    typeof header["assurance_semantic_digest"] !== "string" ||
    typeof header["canonical_source_base64"] !== "string" ||
    typeof header["projection_digest"] !== "string"
  ) {
    return null;
  }
  return header as unknown as Profile2Header;
}

export function importPlanAssuranceMermaid(
  text: string,
  capability: TargetGrammar6Capability,
): PlanAssuranceMermaidImportResultV1 {
  if (!text.endsWith("\n") || text.startsWith("\uFEFF") || text.includes("\r")) {
    return invalidImport(
      "Mermaid profile 2 requires UTF-8 text with LF endings and a trailing newline",
    );
  }
  const header = parseHeader(text);
  if (header === null) return invalidImport("Mermaid profile 2 header is invalid");
  const base64 = header.canonical_source_base64;
  let sourceBytes: Buffer;
  try {
    sourceBytes = Buffer.from(base64, "base64");
  } catch {
    return invalidImport("Mermaid profile 2 canonical source is invalid base64");
  }
  if (sourceBytes.toString("base64") !== base64) {
    return invalidImport("Mermaid profile 2 canonical source is not canonical base64");
  }
  let sourceText: string;
  try {
    sourceText = new TextDecoder("utf-8", { fatal: true }).decode(sourceBytes);
  } catch {
    return invalidImport("Mermaid profile 2 canonical source is not UTF-8");
  }
  if (sha256(sourceBytes) !== header.source_digest) {
    return invalidImport("Mermaid profile 2 source digest does not match");
  }
  const checked = validateTargetGrammar6Document(sourceText, capability);
  if (
    !checked.ok ||
    checked.validatedDocument === null ||
    checked.validatedDocument.grammarVersion !== 6
  ) {
    return Object.freeze({
      ...invalidImport("Mermaid profile 2 canonical source is not valid Grammar 6"),
      diagnostics: checked.diagnostics,
      diagnosticsTruncated: checked.diagnosticsTruncated,
    });
  }
  const assuranceSemanticDigest = planAssuranceSemanticDigest(
    checked.validatedDocument,
  );
  if (assuranceSemanticDigest !== header.assurance_semantic_digest) {
    return invalidImport(
      "Mermaid profile 2 assurance semantic digest does not match",
    );
  }
  const reproduced = exportPlanAssuranceMermaid(
    sourceText,
    capability,
    { profile: 2 },
  );
  if (!reproduced.ok || reproduced.artifact !== text) {
    return invalidImport(
      "Mermaid profile 2 projection or artifact reproduction does not match",
    );
  }
  return Object.freeze({
    ok: true,
    profile: 2,
    documentId: checked.documentId,
    sourceText,
    sourceDigest: header.source_digest,
    assuranceSemanticDigest,
    lossReport: Object.freeze({ lossless: true, records: Object.freeze([]) }),
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
  });
}
