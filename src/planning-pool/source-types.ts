import type { DeclaredCalendarValue } from "../model/calendar.js";
import type { DiagnosticCounts, SourceSpan } from "../model/diagnostics.js";
import type { Rational } from "../model/rational.js";
import type { TextEdit } from "../mutation/text-edits.js";
import type {
  TemporalInstantSource,
  TemporalScheduleSourceModel,
} from "../temporal-schedule/source-types.js";

export interface PlanningPoolSourceCapability {
  readonly id: "perttool.target-grammar-9-planning-pool-source";
  readonly version: 1;
  readonly grammarVersion: 9;
}

export interface PlanningReferenceSource {
  readonly id: string;
  readonly qualifiedId: string;
  readonly span: SourceSpan;
}

export interface PlanningDescriptionSource {
  readonly value: string;
  readonly style: "quoted" | "block";
  readonly span: SourceSpan;
  readonly contentSpan: SourceSpan | null;
}

export interface PlanningWorkSource {
  readonly kind: "work";
  readonly id: string;
  readonly qualifiedId: string;
  readonly title: string;
  readonly description: PlanningDescriptionSource | null;
  readonly events: readonly PlanningReferenceSource[];
  readonly activities: readonly PlanningReferenceSource[];
  readonly milestoneLinks: readonly PlanningReferenceSource[];
  readonly taskLinks: readonly PlanningReferenceSource[];
  readonly dependsOn: readonly PlanningReferenceSource[];
  readonly span: SourceSpan;
  readonly idSpan: SourceSpan;
  readonly titleSpan: SourceSpan;
}

export interface PlanningEventSource {
  readonly kind: "event";
  readonly id: string;
  readonly qualifiedId: string;
  readonly title: string;
  readonly description: PlanningDescriptionSource | null;
  readonly tags: readonly string[];
  readonly source: string | null;
  readonly span: SourceSpan;
  readonly idSpan: SourceSpan;
  readonly titleSpan: SourceSpan;
}

export interface PlanningDurationSource {
  readonly sourceText: string;
  readonly value: Rational;
  readonly unit: "day" | "hour" | "point";
  readonly span: SourceSpan;
}

export interface PlanningEstimateSource {
  readonly optimistic: PlanningDurationSource;
  readonly mostLikely: PlanningDurationSource;
  readonly pessimistic: PlanningDurationSource;
  readonly span: SourceSpan;
}

export interface PlanningRequirementSource {
  readonly resourceId: string;
  readonly qualifiedResourceId: string;
  readonly units: number;
  readonly span: SourceSpan;
}

export interface PlanningWhenSource {
  readonly event: "start" | "finish";
  readonly direction: "earliest" | "latest";
  readonly value: TemporalInstantSource;
  readonly span: SourceSpan;
}

export interface PlanningActivitySource {
  readonly kind: "activity";
  readonly id: string;
  readonly qualifiedId: string;
  readonly from: PlanningReferenceSource;
  readonly to: PlanningReferenceSource;
  readonly title: string;
  readonly description: PlanningDescriptionSource | null;
  readonly duration: PlanningDurationSource | null;
  readonly estimate: PlanningEstimateSource | null;
  readonly priority: number | null;
  readonly requirements: readonly PlanningRequirementSource[];
  readonly owner: string | null;
  readonly tags: readonly string[];
  readonly source: string | null;
  readonly calendarId: string | null;
  readonly when: readonly PlanningWhenSource[];
  readonly deadline: DeclaredCalendarValue | null;
  readonly span: SourceSpan;
  readonly idSpan: SourceSpan;
  readonly titleSpan: SourceSpan;
}

export interface PlanningWindowSource {
  readonly kind: "window";
  readonly id: string;
  readonly qualifiedId: string;
  readonly title: string;
  readonly objective: string;
  readonly start: DeclaredCalendarValue | null;
  readonly end: DeclaredCalendarValue | null;
  readonly works: readonly PlanningReferenceSource[];
  readonly span: SourceSpan;
  readonly idSpan: SourceSpan;
  readonly titleSpan: SourceSpan;
  readonly objectiveSpan: SourceSpan;
}

export interface PlanningPoolSourceModel {
  readonly schemaVersion: "Perttool.PlanningPoolModel.v1";
  readonly modelVersion: 1;
  readonly grammarVersion: 9;
  readonly documentId: string;
  readonly qualifiedNamespace: string;
  readonly base: TemporalScheduleSourceModel;
  readonly works: readonly PlanningWorkSource[];
  readonly events: readonly PlanningEventSource[];
  readonly activities: readonly PlanningActivitySource[];
  readonly windows: readonly PlanningWindowSource[];
  readonly workOrder: readonly PlanningReferenceSource[];
  readonly dependencyCycles: readonly (readonly string[])[];
}

export interface PlanningPoolSourceDiagnostic {
  readonly code: string;
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly entityId?: string;
  readonly span?: SourceSpan;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface PlanningPoolSourceResult {
  readonly ok: boolean;
  readonly grammarVersion: number | null;
  readonly documentId: string | null;
  readonly model: PlanningPoolSourceModel | null;
  readonly diagnostics: readonly PlanningPoolSourceDiagnostic[];
  readonly diagnosticCounts: DiagnosticCounts;
  readonly diagnosticsTruncated: boolean;
}

export interface PlanningPoolFormatResult {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly changed: boolean;
  readonly formattedText: string | null;
  readonly edits: readonly TextEdit[];
  readonly diagnostics: readonly PlanningPoolSourceDiagnostic[];
  readonly diagnosticsTruncated: boolean;
}

export interface PlanningPoolMigrationResult {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly sourceGrammarVersion: number | null;
  readonly targetGrammarVersion: 9 | null;
  readonly changed: boolean;
  readonly candidateText: string | null;
  readonly edits: readonly TextEdit[];
  readonly diagnostics: readonly PlanningPoolSourceDiagnostic[];
  readonly diagnosticsTruncated: boolean;
}

export interface PlanningPoolMutationResult {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly changed: boolean;
  readonly updatedText: string | null;
  readonly edits: readonly TextEdit[];
  readonly diagnostics: readonly PlanningPoolSourceDiagnostic[];
  readonly diagnosticsTruncated: boolean;
}
