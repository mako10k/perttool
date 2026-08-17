import type { SourceSpan } from "../model/diagnostics.js";
import type { Rational } from "../model/rational.js";
import type { TextEdit } from "../mutation/text-edits.js";

export interface TemporalScheduleSourceCapability {
  readonly id: "perttool.target-grammar-8-temporal-schedule-source";
  readonly version: 1;
  readonly grammarVersion: 8;
}

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface TemporalInstantSource {
  readonly sourceText: string;
  readonly instantSeconds: Rational;
  readonly offsetMinutes: number;
  readonly span: SourceSpan;
}

export interface CalendarWindowSource {
  readonly startMinute: number;
  readonly endMinute: number;
  readonly span: SourceSpan;
}

export interface CalendarDaySource {
  readonly weekday: Weekday;
  readonly windows: readonly CalendarWindowSource[];
  readonly span: SourceSpan;
}

export interface CalendarExceptionSource {
  readonly date: string;
  readonly windows: readonly CalendarWindowSource[];
  readonly span: SourceSpan;
}

export interface CalendarSourceModel {
  readonly id: string;
  readonly span: SourceSpan;
  readonly idSpan: SourceSpan;
  readonly weekdays: readonly CalendarDaySource[];
  readonly exceptions: readonly CalendarExceptionSource[];
}

export interface AvailabilityOverrideSource {
  readonly start: TemporalInstantSource;
  readonly end: TemporalInstantSource;
  readonly capacity: number;
  readonly span: SourceSpan;
}

export interface ResourceAvailabilitySource {
  readonly resourceId: string;
  readonly calendarId: string | null;
  readonly availableFrom: TemporalInstantSource | null;
  readonly availableUntil: TemporalInstantSource | null;
  readonly overrides: readonly AvailabilityOverrideSource[];
  readonly span: SourceSpan;
}

export type TaskEvent = "start" | "finish";
export type MilestoneEvent = "reach";
export type BoundDirection = "earliest" | "latest";

export interface EventBoundSource {
  readonly entityKind: "task" | "milestone";
  readonly entityId: string;
  readonly event: TaskEvent | MilestoneEvent;
  readonly direction: BoundDirection;
  readonly value: TemporalInstantSource;
  readonly span: SourceSpan;
}

export interface NamedZoneProfileSource {
  readonly kind: "named_zone";
  readonly zoneId: string;
  readonly tzdbRelease: "2026c";
  readonly calendarId: string;
  readonly workdayHours: Rational | null;
}

export interface ContinuousProfileSource {
  readonly kind: "continuous_fixed_offset";
}

export type TemporalCalendarProfileSource =
  | NamedZoneProfileSource
  | ContinuousProfileSource;

export interface TemporalScheduleSourceModel {
  readonly modelVersion: 1;
  readonly grammarVersion: 8;
  readonly documentId: string;
  readonly asOf: TemporalInstantSource | null;
  readonly profile: TemporalCalendarProfileSource;
  readonly calendars: readonly CalendarSourceModel[];
  readonly resources: readonly ResourceAvailabilitySource[];
  readonly taskBounds: readonly EventBoundSource[];
  readonly milestoneBounds: readonly EventBoundSource[];
}

export interface TemporalSourceDiagnostic {
  readonly code: string;
  readonly severity: "error" | "warning" | "info";
  readonly message: string;
  readonly entityId?: string;
  readonly span?: SourceSpan;
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface TemporalScheduleSourceResult {
  readonly ok: boolean;
  readonly grammarVersion: number | null;
  readonly documentId: string | null;
  readonly model: TemporalScheduleSourceModel | null;
  readonly diagnostics: readonly TemporalSourceDiagnostic[];
  readonly diagnosticCounts: Readonly<{ errors: number; warnings: number; info: number }>;
  readonly diagnosticsTruncated: boolean;
}

export interface TemporalScheduleFormatResult {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly changed: boolean;
  readonly formattedText: string | null;
  readonly edits: readonly TextEdit[];
  readonly diagnostics: readonly TemporalSourceDiagnostic[];
  readonly diagnosticsTruncated: boolean;
}

export interface TemporalScheduleMutationResult {
  readonly ok: boolean;
  readonly documentId: string | null;
  readonly changed: boolean;
  readonly updatedText: string | null;
  readonly edits: readonly TextEdit[];
  readonly diagnostics: readonly TemporalSourceDiagnostic[];
  readonly diagnosticsTruncated: boolean;
}
