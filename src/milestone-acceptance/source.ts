import type { SourcePosition, SourceSpan } from "../model/diagnostics.js";
import { sha256DigestUtf8 } from "../model/sha256.js";
import {
  TARGET_GRAMMAR_6_CAPABILITY,
} from "../parser/document-parser.js";
import { validateTargetGrammar6Document } from "../semantic/target-validator.js";

export const MILESTONE_ACCEPTANCE_SOURCE_MODEL_VERSION = 1 as const;

export interface MilestoneAcceptanceSourceCapability {
  readonly id: "perttool.target-grammar-7-milestone-acceptance-source";
  readonly version: 1;
  readonly grammarVersion: 7;
}

export const MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY:
  MilestoneAcceptanceSourceCapability = Object.freeze({
    id: "perttool.target-grammar-7-milestone-acceptance-source",
    version: 1,
    grammarVersion: 7,
  });

export type CriterionEvidenceKind =
  | "test" | "command" | "artifact" | "observation" | "owner";
export type AcceptanceReceiptAction =
  | "verify" | "fail" | "unavailable" | "revoke" | "waive";

export interface MilestoneCriterionSourceV1 {
  readonly criterionId: string;
  readonly required: boolean;
  readonly evidenceKind: CriterionEvidenceKind;
  readonly description: string;
  readonly commitment: `sha256:${string}`;
  readonly span: SourceSpan;
}

export interface MilestoneCriterionSetSourceV1 {
  readonly kind: "milestone_criterion_set";
  readonly id: string;
  readonly milestoneId: string;
  readonly revisionId: string;
  readonly commitment: `sha256:${string}`;
  readonly criteria: readonly MilestoneCriterionSourceV1[];
  readonly span: SourceSpan;
  readonly idSpan: SourceSpan;
}

export interface MilestoneAcceptanceReceiptSourceV1 {
  readonly kind: "milestone_acceptance_receipt";
  readonly id: string;
  readonly model: 1;
  readonly setId: string;
  readonly setCommitment: `sha256:${string}`;
  readonly criterionId: string;
  readonly criterionCommitment: `sha256:${string}`;
  readonly action: AcceptanceReceiptAction;
  readonly evidenceKind: CriterionEvidenceKind | null;
  readonly evidenceReference: string | null;
  readonly evidenceRevision: string | null;
  readonly verifier: string | null;
  readonly occurredAt: string | null;
  readonly reason: string | null;
  readonly revokes: string | null;
  readonly span: SourceSpan;
  readonly idSpan: SourceSpan;
}

export interface MilestoneAcceptanceMigrationSourceV1 {
  readonly kind: "milestone_acceptance_migration";
  readonly id: string;
  readonly model: 1;
  readonly repositoryId: string;
  readonly path: string;
  readonly objectFormat: "sha1" | "sha256";
  readonly head: string;
  readonly blob: string;
  readonly sourceDigest: `sha256:${string}`;
  readonly candidateDigest: `sha256:${string}`;
  readonly grandfatheredMilestoneIds: readonly string[];
  readonly span: SourceSpan;
  readonly idSpan: SourceSpan;
}

export type MilestoneAcceptanceSourceRecordV1 =
  | MilestoneCriterionSetSourceV1
  | MilestoneAcceptanceReceiptSourceV1
  | MilestoneAcceptanceMigrationSourceV1;

export interface MilestoneAcceptanceSourceDiagnosticV1 {
  readonly code: "PTMAC-103" | "PTMAC-104" | "PTMAC-105" | "PTMAC-106";
  readonly message: string;
  readonly span: SourceSpan;
}

export interface MilestoneAcceptanceSourceResultV1 {
  readonly ok: boolean;
  readonly grammarVersion: number | null;
  readonly documentId: string | null;
  readonly records: readonly MilestoneAcceptanceSourceRecordV1[];
  readonly diagnostics: readonly MilestoneAcceptanceSourceDiagnosticV1[];
  readonly baseDiagnostics: readonly unknown[];
  readonly canonicalText: string | null;
}

interface Line { readonly text: string; readonly start: number; readonly end: number; readonly number: number }
const idPattern = /^[A-Za-z][A-Za-z0-9_-]*$/u;
const digestPattern = /^sha256:[0-9a-f]{64}$/u;
const timePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u;

export function normalizeCallerAssertedUtcZ(value: string): string | null {
  if (!timePattern.test(value)) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z$/u.exec(value)!;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!, hour!, minute!, second!));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day || date.getUTCHours() !== hour || date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second) return null;
  const fraction = (match[7] ?? "").replace(/0+$/u, "");
  return `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}${fraction.length === 0 ? "" : `.${fraction}`}Z`;
}

function lines(text: string): readonly Line[] {
  const result: Line[] = [];
  let offset = 0;
  for (const [index, value] of text.split(/(?<=\n)/u).entries()) {
    result.push({ text: value, start: offset, end: offset + value.length, number: index + 1 });
    offset += value.length;
  }
  return result;
}

function position(text: string, offset: number): SourcePosition {
  const prefix = text.slice(0, offset);
  const rows = prefix.split("\n");
  return { offset, line: rows.length, column: rows.at(-1)!.length + 1 };
}

function span(text: string, start: number, end: number): SourceSpan {
  return { start: position(text, start), end: position(text, end) };
}

function quoted(value: string): string | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "string" ? parsed : null;
  } catch { return null; }
}

function canonicalCriterion(
  milestoneId: string,
  revisionId: string,
  criterionId: string,
  required: boolean,
  evidenceKind: CriterionEvidenceKind,
  description: string,
): `sha256:${string}` {
  return sha256DigestUtf8(JSON.stringify([
    "Perttool.MilestoneCriterion.v1", milestoneId, revisionId, criterionId,
    required, evidenceKind, description,
  ]));
}

export function milestoneCriterionSetCommitment(
  milestoneId: string,
  revisionId: string,
  criteria: readonly Pick<MilestoneCriterionSourceV1,
    "criterionId" | "required" | "evidenceKind" | "description" | "commitment">[],
): `sha256:${string}` {
  return sha256DigestUtf8(JSON.stringify([
    "Perttool.MilestoneCriterionSet.v1", milestoneId, revisionId,
    criteria.map((criterion) => [
      criterion.criterionId, criterion.required, criterion.evidenceKind,
      criterion.description, criterion.commitment,
    ]),
  ]));
}

function fieldMap(block: readonly Line[]): Map<string, Line[]> {
  const map = new Map<string, Line[]>();
  for (const line of block) {
    const match = /^  ([a-z_]+)(?: (.*))?\r?\n?$/u.exec(line.text);
    if (match === null) continue;
    const values = map.get(match[1]!) ?? [];
    values.push(line);
    map.set(match[1]!, values);
  }
  return map;
}

function rawField(line: Line | undefined, name: string): string | null {
  if (line === undefined) return null;
  const match = new RegExp(`^  ${name}(?: (.*))?\\r?\\n?$`, "u").exec(line.text);
  return match?.[1] ?? null;
}

function sanitizeBase(text: string, sourceLines: readonly Line[], removed: Set<number>): string {
  return sourceLines.map((line, index) => {
    if (removed.has(index)) {
      const ending = line.text.endsWith("\r\n")
        ? "\r\n"
        : line.text.endsWith("\n")
          ? "\n"
          : "";
      const contentLength = line.text.length - ending.length;
      return contentLength === 0
        ? line.text
        : `#${" ".repeat(contentLength - 1)}${ending}`;
    }
    if (/^  version 7\r?\n?$/u.test(line.text)) return line.text.replace("7", "6");
    return line.text;
  }).join("");
}

export function milestoneAcceptanceBaseText(text: string): string {
  const sourceLines = lines(text);
  const removed = new Set<number>();
  for (let index = 0; index < sourceLines.length; index += 1) {
    if (!/^(milestone_criterion_set|milestone_acceptance_receipt|milestone_acceptance_migration) [A-Za-z][A-Za-z0-9_-]*:\r?\n?$/u.test(sourceLines[index]!.text)) continue;
    let endIndex = index + 1;
    while (endIndex < sourceLines.length && /^(?:  |\s*$)/u.test(sourceLines[endIndex]!.text)) endIndex += 1;
    for (let cursor = index; cursor < endIndex; cursor += 1) removed.add(cursor);
    index = endIndex - 1;
  }
  return sanitizeBase(text, sourceLines, removed);
}

export function parseMilestoneAcceptanceSource(
  text: string,
  capability: MilestoneAcceptanceSourceCapability,
): MilestoneAcceptanceSourceResultV1 {
  if (capability !== MILESTONE_ACCEPTANCE_SOURCE_CAPABILITY) {
    throw new TypeError("milestone acceptance source capability identity mismatch");
  }
  const sourceLines = lines(text);
  const versionMatch = /^  version (\d+)\r?$/mu.exec(text);
  const grammarVersion = versionMatch === null ? 1 : Number(versionMatch[1]);
  const removed = new Set<number>();
  const diagnostics: MilestoneAcceptanceSourceDiagnosticV1[] = [];
  const records: MilestoneAcceptanceSourceRecordV1[] = [];
  const seen = new Set<string>();
  const addDiagnostic = (code: MilestoneAcceptanceSourceDiagnosticV1["code"], message: string, target: SourceSpan) =>
    diagnostics.push({ code, message, span: target });

  for (let index = 0; index < sourceLines.length; index += 1) {
    const header = /^(milestone_criterion_set|milestone_acceptance_receipt|milestone_acceptance_migration) ([A-Za-z][A-Za-z0-9_-]*):\r?\n?$/u.exec(sourceLines[index]!.text);
    if (header === null) continue;
    const startIndex = index;
    let endIndex = index + 1;
    while (endIndex < sourceLines.length && (/^(?:  |\s*$)/u.test(sourceLines[endIndex]!.text))) endIndex += 1;
    for (let cursor = startIndex; cursor < endIndex; cursor += 1) removed.add(cursor);
    const block = sourceLines.slice(startIndex + 1, endIndex);
    const fields = fieldMap(block);
    const declarationSpan = span(text, sourceLines[startIndex]!.start, sourceLines[endIndex - 1]!.end);
    const id = header[2]!;
    const idOffset = sourceLines[startIndex]!.start + header[1]!.length + 1;
    const idSpan = span(text, idOffset, idOffset + id.length);
    const identity = `${header[1]}:${id}`;
    if (seen.has(identity)) addDiagnostic("PTMAC-104", `Duplicate ${identity}`, idSpan);
    seen.add(identity);

    const allowed = header[1] === "milestone_criterion_set"
      ? new Set(["milestone", "revision", "commitment", "criterion"])
      : header[1] === "milestone_acceptance_receipt"
        ? new Set(["model", "set", "set_commitment", "criterion", "criterion_commitment", "action", "evidence_kind", "evidence_reference", "evidence_revision", "verifier", "occurred_at", "reason", "revokes"])
        : new Set(["model", "repository", "path", "object_format", "head", "blob", "source_digest", "candidate_digest", "grandfathered"]);
    for (const [name, occurrences] of fields) {
      const repeatable = name === "criterion" && header[1] === "milestone_criterion_set" || name === "grandfathered" && header[1] === "milestone_acceptance_migration";
      if (!allowed.has(name) || (!repeatable && occurrences.length !== 1)) {
        addDiagnostic("PTMAC-103", `Invalid field ${name} in ${identity}`, span(text, occurrences[0]!.start, occurrences.at(-1)!.end));
      }
    }

    if (header[1] === "milestone_criterion_set") {
      const milestoneId = rawField(fields.get("milestone")?.[0], "milestone");
      const revisionId = rawField(fields.get("revision")?.[0], "revision");
      const stored = rawField(fields.get("commitment")?.[0], "commitment");
      const criteria: MilestoneCriterionSourceV1[] = [];
      for (const line of fields.get("criterion") ?? []) {
        const raw = rawField(line, "criterion") ?? "";
        const match = /^([A-Za-z][A-Za-z0-9_-]*) (required|optional) (test|command|artifact|observation|owner) ("(?:[^"\\]|\\.)*")$/u.exec(raw);
        if (match === null || milestoneId === null || revisionId === null) {
          addDiagnostic("PTMAC-103", "Invalid criterion declaration", span(text, line.start, line.end));
          continue;
        }
        const description = quoted(match[4]!)!;
        criteria.push({
          criterionId: match[1]!, required: match[2] === "required",
          evidenceKind: match[3]! as CriterionEvidenceKind, description,
          commitment: canonicalCriterion(milestoneId, revisionId, match[1]!, match[2] === "required", match[3]! as CriterionEvidenceKind, description),
          span: span(text, line.start, line.end),
        });
      }
      if (milestoneId === null || revisionId === null || !idPattern.test(milestoneId) || !idPattern.test(revisionId) || stored === null || !digestPattern.test(stored) || criteria.length === 0 || !criteria.some((criterion) => criterion.required) || new Set(criteria.map((criterion) => criterion.criterionId)).size !== criteria.length) {
        addDiagnostic("PTMAC-103", `Invalid criterion set ${id}`, declarationSpan);
      } else {
        const commitment = milestoneCriterionSetCommitment(milestoneId, revisionId, criteria);
        if (stored !== commitment) addDiagnostic("PTMAC-105", `Criterion set ${id} commitment mismatch`, declarationSpan);
        records.push({ kind: "milestone_criterion_set", id, milestoneId, revisionId, commitment, criteria: Object.freeze(criteria), span: declarationSpan, idSpan });
      }
    } else if (header[1] === "milestone_acceptance_receipt") {
      const value = (name: string) => rawField(fields.get(name)?.[0], name);
      const model = value("model"); const setId = value("set");
      const setCommitment = value("set_commitment"); const criterionId = value("criterion");
      const criterionCommitment = value("criterion_commitment"); const action = value("action");
      const evidenceKind = value("evidence_kind"); const evidenceReference = value("evidence_reference");
      const evidenceRevision = value("evidence_revision"); const verifier = value("verifier");
      const occurredAt = value("occurred_at"); const reason = value("reason"); const revokes = value("revokes");
      const actionOk = action !== null && ["verify", "fail", "unavailable", "revoke", "waive"].includes(action);
      if (model !== "1" || setId === null || criterionId === null || setCommitment === null || criterionCommitment === null || !digestPattern.test(setCommitment) || !digestPattern.test(criterionCommitment) || !actionOk) {
        addDiagnostic("PTMAC-105", `Invalid receipt binding ${id}`, declarationSpan);
      } else {
        const terminalEvidence = action === "verify";
        const provenanceOk = !terminalEvidence || (
          evidenceKind !== null && ["test", "command", "artifact", "observation", "owner"].includes(evidenceKind) &&
          evidenceReference !== null && quoted(evidenceReference) !== null && evidenceRevision !== null &&
          verifier !== null && occurredAt !== null && normalizeCallerAssertedUtcZ(occurredAt) !== null
        );
        const lifecycleOk = action !== "revoke" || revokes !== null;
        const waiverOk = action !== "waive" || (reason !== null && quoted(reason) !== null && quoted(reason)!.length > 0);
        if (!provenanceOk || !lifecycleOk || !waiverOk) addDiagnostic("PTMAC-106", `Invalid receipt provenance ${id}`, declarationSpan);
        records.push({
          kind: "milestone_acceptance_receipt", id, model: 1, setId,
          setCommitment: setCommitment as `sha256:${string}`, criterionId,
          criterionCommitment: criterionCommitment as `sha256:${string}`,
          action: action as AcceptanceReceiptAction,
          evidenceKind: evidenceKind as CriterionEvidenceKind | null,
          evidenceReference: evidenceReference === null ? null : quoted(evidenceReference),
          evidenceRevision, verifier,
          occurredAt: occurredAt === null ? null : normalizeCallerAssertedUtcZ(occurredAt),
          reason: reason === null ? null : quoted(reason), revokes,
          span: declarationSpan, idSpan,
        });
      }
    } else {
      const value = (name: string) => rawField(fields.get(name)?.[0], name);
      const model = value("model"); const repositoryId = value("repository");
      const pathValue = value("path"); const objectFormat = value("object_format");
      const head = value("head"); const blob = value("blob");
      const sourceDigest = value("source_digest"); const candidateDigest = value("candidate_digest");
      const ids = (fields.get("grandfathered") ?? []).map((line) => rawField(line, "grandfathered")!).filter(Boolean);
      const objectLength = objectFormat === "sha1" ? 40 : objectFormat === "sha256" ? 64 : 0;
      if (model !== "1" || repositoryId === null || pathValue === null || quoted(pathValue) === null || objectLength === 0 || head === null || blob === null || !new RegExp(`^[0-9a-f]{${objectLength}}$`, "u").test(head) || !new RegExp(`^[0-9a-f]{${objectLength}}$`, "u").test(blob) || sourceDigest === null || candidateDigest === null || !digestPattern.test(sourceDigest) || !digestPattern.test(candidateDigest) || ids.some((candidate) => !idPattern.test(candidate)) || [...ids].sort().join("\0") !== ids.join("\0") || new Set(ids).size !== ids.length) {
        addDiagnostic("PTMAC-103", `Invalid migration baseline ${id}`, declarationSpan);
      } else records.push({ kind: "milestone_acceptance_migration", id, model: 1, repositoryId, path: quoted(pathValue)!, objectFormat: objectFormat as "sha1" | "sha256", head, blob, sourceDigest: sourceDigest as `sha256:${string}`, candidateDigest: candidateDigest as `sha256:${string}`, grandfatheredMilestoneIds: Object.freeze(ids), span: declarationSpan, idSpan });
    }
    index = endIndex - 1;
  }

  if (records.length > 0 && grammarVersion !== 7) addDiagnostic("PTMAC-103", "Milestone acceptance records require Grammar 7", span(text, 0, Math.min(text.length, 1)));
  const base = validateTargetGrammar6Document(sanitizeBase(text, sourceLines, removed), TARGET_GRAMMAR_6_CAPABILITY);
  const projectIds = new Set(base.document.declarations.filter((item) => item.kind === "milestone").map((item) => item.id));
  for (const record of records) if (record.kind === "milestone_criterion_set" && !projectIds.has(record.milestoneId)) addDiagnostic("PTMAC-105", `Unknown milestone ${record.milestoneId}`, record.span);
  const sets = new Map(records.filter((record): record is MilestoneCriterionSetSourceV1 => record.kind === "milestone_criterion_set").map((record) => [record.id, record]));
  const receiptIds = new Set(records.filter((record) => record.kind === "milestone_acceptance_receipt").map((record) => record.id));
  for (const receipt of records.filter((record): record is MilestoneAcceptanceReceiptSourceV1 => record.kind === "milestone_acceptance_receipt")) {
    const set = sets.get(receipt.setId);
    const criterion = set?.criteria.find((candidate) => candidate.criterionId === receipt.criterionId);
    if (set === undefined || set.span.start.offset > receipt.span.start.offset || set.commitment !== receipt.setCommitment || criterion === undefined || criterion.commitment !== receipt.criterionCommitment) {
      addDiagnostic("PTMAC-105", `Receipt ${receipt.id} does not bind an exact current criterion`, receipt.span);
    }
    if (receipt.action === "verify" && criterion !== undefined && receipt.evidenceKind !== criterion.evidenceKind) {
      addDiagnostic("PTMAC-105", `Receipt ${receipt.id} evidence kind does not match its criterion`, receipt.span);
    }
    if (receipt.action === "revoke" && (receipt.revokes === null || !receiptIds.has(receipt.revokes) || receipt.revokes === receipt.id)) {
      addDiagnostic("PTMAC-105", `Receipt ${receipt.id} revocation target is unavailable`, receipt.span);
    }
  }
  const ok = base.ok && (grammarVersion >= 1 && grammarVersion <= 7) && diagnostics.length === 0;
  return Object.freeze({ ok, grammarVersion, documentId: base.documentId, records: Object.freeze(records), diagnostics: Object.freeze(diagnostics), baseDiagnostics: base.diagnostics, canonicalText: ok ? formatMilestoneAcceptanceSource(text, records) : null });
}

export function formatMilestoneAcceptanceSource(text: string, records: readonly MilestoneAcceptanceSourceRecordV1[]): string {
  if (records.length === 0) return text;
  const ordered = [...records].sort((left, right) => left.span.start.offset - right.span.start.offset);
  let result = ""; let cursor = 0;
  for (const record of ordered) {
    result += text.slice(cursor, record.span.start.offset);
    if (record.kind === "milestone_criterion_set") {
      result += `milestone_criterion_set ${record.id}:\n  milestone ${record.milestoneId}\n  revision ${record.revisionId}\n  commitment ${record.commitment}\n`;
      for (const criterion of record.criteria) result += `  criterion ${criterion.criterionId} ${criterion.required ? "required" : "optional"} ${criterion.evidenceKind} ${JSON.stringify(criterion.description)}\n`;
    } else if (record.kind === "milestone_acceptance_migration") {
      result += `milestone_acceptance_migration ${record.id}:\n  model 1\n  repository ${record.repositoryId}\n  path ${JSON.stringify(record.path)}\n  object_format ${record.objectFormat}\n  head ${record.head}\n  blob ${record.blob}\n  source_digest ${record.sourceDigest}\n  candidate_digest ${record.candidateDigest}\n`;
      for (const id of record.grandfatheredMilestoneIds) result += `  grandfathered ${id}\n`;
    } else {
      result += text.slice(record.span.start.offset, record.span.end.offset);
    }
    cursor = record.span.end.offset;
  }
  return result + text.slice(cursor);
}
