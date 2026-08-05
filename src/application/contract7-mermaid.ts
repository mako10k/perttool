import {
  exportPlanAssuranceMermaid,
  importPlanAssuranceMermaid,
} from "../assurance/mermaid.js";
import {
  exportMermaid as exportRetainedMermaid,
  type MermaidAnalysisMode,
  type MermaidExportOptions,
  type MermaidExportResult,
} from "../conversion/mermaid.js";
import {
  importMermaid as importRetainedMermaid,
  type MermaidImportOptions,
  type MermaidImportResult,
} from "../conversion/mermaid-import.js";
import type { DocumentNode } from "../model/syntax.js";
import { TARGET_GRAMMAR_6_CAPABILITY } from "../parser/document-parser.js";
import {
  analyzeDocument,
  checkDocument,
} from "./contract7-assurance.js";

export interface Contract7MermaidExportOptions extends MermaidExportOptions {
  readonly allowLoss?: boolean;
}

function grammar6(text: string, maxDiagnostics: number | undefined): boolean {
  return checkDocument(text, {
    ...(maxDiagnostics === undefined ? {} : { maxDiagnostics }),
  }).grammarVersion === 6;
}

export function exportMermaid(
  text: string,
  options: Contract7MermaidExportOptions = {},
): MermaidExportResult {
  if (!grammar6(text, options.maxDiagnostics)) {
    return exportRetainedMermaid(text, options);
  }
  const profile = options.profile ?? "perttool";
  const analysis = options.analysis ?? "none";
  const capacityOverrides = options.capacityOverrides ?? new Map<string, number>();
  const checked = checkDocument(text, {
    ...(options.maxDiagnostics === undefined
      ? {}
      : { maxDiagnostics: options.maxDiagnostics }),
  });
  const result = exportPlanAssuranceMermaid(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
    {
      profile: profile === "perttool" ? 2 : "plain",
      allowLoss: options.allowLoss ?? profile === "plain",
      analysis,
      capacityOverrides,
      ...(options.maxDiagnostics === undefined
        ? {}
        : { maxDiagnostics: options.maxDiagnostics }),
    },
    analyzeDocument,
  );
  return Object.freeze({
    ok: result.ok,
    document: checked.document as unknown as DocumentNode,
    documentId: result.documentId,
    diagnostics: result.diagnostics,
    diagnosticsTruncated: result.diagnosticsTruncated,
    profile,
    analysis,
    capacityOverrides,
    artifact: result.artifact,
    artifactDigest: result.artifactDigest,
    lossReport: result.lossReport,
  });
}

function profile2Detected(text: string): boolean {
  return text.startsWith(
    "flowchart LR\n  %% perttool:profile {\"schema_version\":\"Perttool.MermaidProfile.v2\"",
  );
}

export function importMermaid(
  text: string,
  options: MermaidImportOptions = {},
): MermaidImportResult {
  if (!profile2Detected(text)) return importRetainedMermaid(text, options);
  const result = importPlanAssuranceMermaid(
    text,
    TARGET_GRAMMAR_6_CAPABILITY,
    analyzeDocument,
  );
  const checked = checkDocument(result.sourceText ?? "", {
    ...(options.maxDiagnostics === undefined
      ? {}
      : { maxDiagnostics: options.maxDiagnostics }),
  });
  return Object.freeze({
    ok: result.ok,
    document: checked.document as unknown as DocumentNode,
    documentId: result.documentId,
    diagnostics: result.diagnostics,
    diagnosticsTruncated: result.diagnosticsTruncated,
    profile: "perttool",
    analysis: result.analysis,
    capacityOverrides: result.capacityOverrides,
    artifact: result.sourceText,
    artifactDigest: result.sourceDigest,
    lossReport: result.lossReport,
    generatedIds: Object.freeze([]),
  });
}

export type {
  MermaidAnalysisMode,
  MermaidExportResult,
  MermaidImportOptions,
  MermaidImportResult,
};
