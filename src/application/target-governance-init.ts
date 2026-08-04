import { digestDocumentBytes } from "../io/document-file.js";
import type { Diagnostic } from "../model/diagnostics.js";
import { mutationDiagnostic } from "../mutation/diagnostics.js";
import type { TextEdit } from "../mutation/text-edits.js";
import type {
  TargetGrammar4Capability,
  TargetGrammar5Capability,
  TargetGrammar6Capability,
} from "../parser/document-parser.js";
import { GOVERNANCE_DIRECT_EDIT_WARNING } from "../governance/guidance.js";
import {
  validateTargetGrammar4Document,
  validateTargetGrammar5Document,
  validateTargetGrammar6Document,
  type TargetValidationOptions,
} from "../semantic/target-validator.js";
import type {
  ProjectInitDurationUnit,
  ProjectInitWrite,
} from "./init.js";

export { GOVERNANCE_DIRECT_EDIT_WARNING };

export interface TargetGovernanceProjectInitRequest {
  readonly projectId: string;
  readonly title: string;
  readonly durationUnit: ProjectInitDurationUnit;
  readonly initialMilestone: string;
  readonly initialMilestoneTitle: string;
  readonly finish: string;
  readonly version?: number;
  readonly asOf?: string;
  readonly velocity?: string;
  readonly initialMilestoneDeadline?: string;
  readonly goalOwner?: string;
  readonly goalDelegates?: readonly string[];
  readonly dagOwner?: string;
  readonly dagDelegates?: readonly string[];
}

export interface TargetGovernanceProjectInitResult {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly grammarVersion: 1 | 2 | 3 | 4 | 5 | 6 | null;
  readonly candidateText: string | null;
  readonly candidateDigest: string | null;
  readonly edits: readonly TextEdit[];
  readonly write: ProjectInitWrite;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

const requestFields = new Set([
  "projectId",
  "title",
  "durationUnit",
  "initialMilestone",
  "initialMilestoneTitle",
  "finish",
  "version",
  "asOf",
  "velocity",
  "initialMilestoneDeadline",
  "goalOwner",
  "goalDelegates",
  "dagOwner",
  "dagDelegates",
]);

const principalPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;

const previewWrite: ProjectInitWrite = Object.freeze({
  mode: "preview",
  target: null,
  written: false,
});

function hasGovernance(
  request: {
    readonly goalOwner?: unknown;
    readonly goalDelegates?: unknown;
    readonly dagOwner?: unknown;
    readonly dagDelegates?: unknown;
  },
): boolean {
  return (
    request.goalOwner !== undefined ||
    request.goalDelegates !== undefined ||
    request.dagOwner !== undefined ||
    request.dagDelegates !== undefined
  );
}

function requestError(value: unknown): string | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "project init request is not an object";
  }
  const request = value as Record<string, unknown>;
  if (Object.keys(request).some((field) => !requestFields.has(field))) {
    return "project init request contains unsupported fields";
  }
  for (const field of [
    "projectId",
    "title",
    "initialMilestone",
    "initialMilestoneTitle",
    "finish",
  ]) {
    if (typeof request[field] !== "string") {
      return `project init request requires string field ${field}`;
    }
  }
  if (
    request["durationUnit"] !== "day" &&
    request["durationUnit"] !== "hour" &&
    request["durationUnit"] !== "point"
  ) {
    return "project init durationUnit must be day, hour, or point";
  }
  if (
    request["version"] !== undefined &&
    (
      !Number.isSafeInteger(request["version"]) ||
      (request["version"] as number) < 1 ||
      (request["version"] as number) > 6
    )
  ) {
    return "project init version must be an integer from 1 to 6";
  }
  for (const field of ["asOf", "velocity", "initialMilestoneDeadline"]) {
    if (request[field] !== undefined && typeof request[field] !== "string") {
      return `project init ${field} must be a string when provided`;
    }
  }
  for (const field of ["goalOwner", "dagOwner"]) {
    const principal = request[field];
    if (
      principal !== undefined &&
      (typeof principal !== "string" || !principalPattern.test(principal))
    ) {
      return `project init ${field} must be a principal when provided`;
    }
  }
  for (const field of ["goalDelegates", "dagDelegates"]) {
    const principals = request[field];
    if (
      principals !== undefined &&
      (
        !Array.isArray(principals) ||
        principals.some(
          (principal) =>
            typeof principal !== "string" || !principalPattern.test(principal),
        )
      )
    ) {
      return `project init ${field} must be a principal list when provided`;
    }
  }
  if (request["finish"] !== request["initialMilestone"]) {
    return "project init finish must equal initialMilestone in initialization version 1";
  }
  if (request["durationUnit"] === "point" && request["velocity"] === undefined) {
    return "project init with point durationUnit requires velocity";
  }
  const governance = hasGovernance(request);
  if (
    governance &&
    request["version"] !== undefined &&
    request["version"] !== 4 &&
    request["version"] !== 5 &&
    request["version"] !== 6
  ) {
    return "project init governance fields require version 4, 5, or 6";
  }
  const version =
    governance ? (request["version"] ?? 4) : (request["version"] ?? 1);
  if (
    request["initialMilestoneDeadline"] !== undefined &&
    (
      (
        version !== 2 &&
        version !== 3 &&
        version !== 4 &&
        version !== 5 &&
        version !== 6
      ) ||
      request["asOf"] === undefined
    )
  ) {
    return "project init initialMilestoneDeadline requires version 2, 3, 4, 5, or 6 and asOf";
  }
  return undefined;
}

function principalList(values: readonly string[]): string {
  return `[${values.join(", ")}]`;
}

function renderCandidate(request: TargetGovernanceProjectInitRequest): string {
  const version = hasGovernance(request)
    ? (request.version ?? 4)
    : (request.version ?? 1);
  return [
    GOVERNANCE_DIRECT_EDIT_WARNING,
    `project ${request.projectId}:`,
    `  version ${version}`,
    `  title ${JSON.stringify(request.title)}`,
    ...(request.asOf === undefined ? [] : [`  as_of ${request.asOf}`]),
    `  duration_unit ${request.durationUnit}`,
    ...(request.velocity === undefined ? [] : [`  velocity ${request.velocity}`]),
    `  finish ${request.finish}`,
    ...(request.goalOwner === undefined
      ? []
      : [`  goal_owner ${request.goalOwner}`]),
    ...(request.goalDelegates === undefined
      ? []
      : [`  goal_delegates ${principalList(request.goalDelegates)}`]),
    ...(request.dagOwner === undefined
      ? []
      : [`  dag_owner ${request.dagOwner}`]),
    ...(request.dagDelegates === undefined
      ? []
      : [`  dag_delegates ${principalList(request.dagDelegates)}`]),
    "",
    `milestone ${request.initialMilestone}:`,
    `  title ${JSON.stringify(request.initialMilestoneTitle)}`,
    "  state reached",
    ...(request.initialMilestoneDeadline === undefined
      ? []
      : [`  deadline ${request.initialMilestoneDeadline}`]),
    "",
  ].join("\n");
}

export function planTargetGovernanceProjectInit(
  request: unknown,
  capability:
    | TargetGrammar4Capability
    | TargetGrammar5Capability
    | TargetGrammar6Capability,
  options: TargetValidationOptions = {},
): TargetGovernanceProjectInitResult {
  const error = requestError(request);
  if (error !== undefined) {
    return {
      ok: false,
      documentId: null,
      grammarVersion: null,
      candidateText: null,
      candidateDigest: null,
      edits: [],
      write: previewWrite,
      diagnostics: [mutationDiagnostic("PTMUT-301", error)],
      diagnosticsTruncated: false,
    };
  }
  const candidateText = renderCandidate(
    request as TargetGovernanceProjectInitRequest,
  );
  const checked = capability.grammarVersion === 6
    ? validateTargetGrammar6Document(candidateText, capability, options)
    : capability.grammarVersion === 5
      ? validateTargetGrammar5Document(candidateText, capability, options)
      : validateTargetGrammar4Document(candidateText, capability, options);
  if (!checked.ok || checked.validatedDocument === null) {
    return {
      ok: false,
      documentId: checked.documentId,
      grammarVersion: null,
      candidateText: null,
      candidateDigest: null,
      edits: [],
      write: previewWrite,
      diagnostics: checked.diagnostics,
      diagnosticsTruncated: checked.diagnosticsTruncated,
    };
  }
  const edit = Object.freeze({
    startOffset: 0,
    endOffset: 0,
    replacement: candidateText,
  });
  return {
    ok: true,
    documentId: checked.documentId,
    grammarVersion: checked.validatedDocument.grammarVersion,
    candidateText,
    candidateDigest: digestDocumentBytes(Buffer.from(candidateText, "utf8")),
    edits: Object.freeze([edit]),
    write: previewWrite,
    diagnostics: checked.diagnostics,
    diagnosticsTruncated: checked.diagnosticsTruncated,
  };
}
