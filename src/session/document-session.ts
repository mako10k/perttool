import {
  analyzeValidatedDocument,
  type AnalysisResult,
  type AnalyzeOptions,
  type AnalysisMode,
} from "../analysis/service.js";
import {
  hasErrors,
  limitDiagnostics,
  normalizeMaxDiagnostics,
  type Diagnostic,
} from "../model/diagnostics.js";
import type {
  DocumentNode,
  ParseResult,
  TargetDeclarationKind,
} from "../model/syntax.js";
import { parseDocument, validateDocument } from "../core/source.js";

const sha256Pattern = /^sha256:[0-9a-f]{64}$/;

export type DocumentSourceDigest = `sha256:${string}`;

export interface DocumentPosition {
  readonly line: number;
  readonly character: number;
}

export interface DocumentRange {
  readonly start: DocumentPosition;
  readonly end: DocumentPosition;
}

export interface DocumentContentChange {
  readonly range: DocumentRange;
  readonly text: string;
}

export interface DocumentBinding {
  readonly uri: string;
  readonly generation: string;
  readonly version: number;
  readonly sourceDigest: DocumentSourceDigest;
}

export interface DocumentSemanticResult {
  readonly ok: boolean;
  readonly diagnostics: readonly Diagnostic[];
  readonly diagnosticsTruncated: boolean;
}

export interface DocumentSnapshot {
  readonly binding: DocumentBinding;
  readonly text: string;
  readonly parse: ParseResult<TargetDeclarationKind>;
  readonly semantic: DocumentSemanticResult;
}

export interface DocumentSnapshotInput {
  readonly uri: string;
  readonly generation: string;
  readonly version: number;
  readonly text: string;
}

export interface DocumentSnapshotOptions {
  readonly digestText: (text: string) => string;
  readonly maxDiagnostics?: number;
  readonly prepareDocument?: (
    text: string,
    maxDiagnostics: number,
  ) => DocumentSnapshotPreparation;
}

export interface DocumentSnapshotPreparation {
  readonly analysisText: string;
  readonly diagnostics: readonly Diagnostic[];
}

export type DocumentAnalysisMode = "none" | AnalysisMode;

export interface DocumentAnalysisOptions
  extends Omit<AnalyzeOptions, "mode"> {
  readonly mode?: DocumentAnalysisMode;
}

export interface DocumentAnalysisProjection {
  readonly status: "current" | "invalid" | "unavailable";
  readonly binding: DocumentBinding;
  readonly analysisMode: DocumentAnalysisMode;
  readonly complete: boolean;
  readonly diagnostics: readonly Diagnostic[];
  readonly analysis: AnalysisResult | null;
}

export type DocumentProjectionStatus =
  | "current"
  | "invalid"
  | "unavailable"
  | "stale"
  | "closed"
  | "cancelled"
  | "desynchronized";

export interface DocumentProjectionRequest<Value> {
  readonly binding: DocumentBinding;
  readonly cacheKey: string;
  readonly signal?: AbortSignal;
  readonly allowInvalid?: boolean;
  readonly allowTruncated?: boolean;
  readonly compute: (
    snapshot: DocumentSnapshot,
  ) => Value | PromiseLike<Value>;
}

export interface DocumentProjectionResult<Value> {
  readonly status: DocumentProjectionStatus;
  readonly binding: DocumentBinding;
  readonly snapshot: DocumentSnapshot | null;
  readonly value: Value | null;
  readonly cached: boolean;
}

export interface DocumentSessionAnalysisResult {
  readonly status: DocumentProjectionStatus;
  readonly binding: DocumentBinding;
  readonly snapshot: DocumentSnapshot | null;
  readonly analysisMode: DocumentAnalysisMode;
  readonly complete: boolean;
  readonly diagnostics: readonly Diagnostic[];
  readonly analysis: AnalysisResult | null;
  readonly cached: boolean;
}

export type DocumentSessionFailureReason =
  | "document_already_open"
  | "document_not_open"
  | "invalid_binding"
  | "invalid_change"
  | "snapshot_unavailable"
  | "version_not_increasing";

export interface DocumentSessionTransition {
  readonly status: "current" | "desynchronized" | "closed";
  readonly snapshot: DocumentSnapshot | null;
  readonly reason: DocumentSessionFailureReason | null;
}

export interface DocumentSessionChange {
  readonly uri: string;
  readonly version: number;
  readonly changes: readonly DocumentContentChange[];
}

export interface DocumentSession {
  readonly state: "active" | "desynchronized" | "closed";
  open(input: Omit<DocumentSnapshotInput, "generation">): DocumentSessionTransition;
  change(input: DocumentSessionChange): DocumentSessionTransition;
  close(uri: string): boolean;
  current(uri: string): DocumentSnapshot | null;
  resolve(binding: DocumentBinding): DocumentProjectionStatus;
  project<Value>(
    request: DocumentProjectionRequest<Value>,
  ): Promise<DocumentProjectionResult<Value>>;
  analyze(
    binding: DocumentBinding,
    options?: DocumentAnalysisOptions,
    signal?: AbortSignal,
  ): Promise<DocumentSessionAnalysisResult>;
  dispose(): void;
}

interface LineExtent {
  readonly start: number;
  readonly end: number;
}

function lineExtents(text: string): readonly LineExtent[] {
  const lines: LineExtent[] = [];
  let start = 0;
  let offset = 0;
  while (offset < text.length) {
    const code = text.charCodeAt(offset);
    if (code === 0x0d) {
      lines.push({ start, end: offset });
      offset += text.charCodeAt(offset + 1) === 0x0a ? 2 : 1;
      start = offset;
      continue;
    }
    if (code === 0x0a) {
      lines.push({ start, end: offset });
      offset += 1;
      start = offset;
      continue;
    }
    offset += 1;
  }
  lines.push({ start, end: text.length });
  return lines;
}

function isInsideSurrogatePair(text: string, offset: number): boolean {
  if (offset <= 0 || offset >= text.length) return false;
  const previous = text.charCodeAt(offset - 1);
  const current = text.charCodeAt(offset);
  return (
    previous >= 0xd800 &&
    previous <= 0xdbff &&
    current >= 0xdc00 &&
    current <= 0xdfff
  );
}

export function documentPositionToOffset(
  text: string,
  position: DocumentPosition,
): number | null {
  if (
    !Number.isSafeInteger(position.line) ||
    !Number.isSafeInteger(position.character) ||
    position.line < 0 ||
    position.character < 0
  ) {
    return null;
  }
  const line = lineExtents(text)[position.line];
  if (line === undefined || position.character > line.end - line.start) {
    return null;
  }
  const offset = line.start + position.character;
  return isInsideSurrogatePair(text, offset) ? null : offset;
}

export function documentOffsetToPosition(
  text: string,
  offset: number,
): DocumentPosition | null {
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > text.length ||
    isInsideSurrogatePair(text, offset) ||
    (
      offset > 0 &&
      text.charCodeAt(offset - 1) === 0x0d &&
      text.charCodeAt(offset) === 0x0a
    )
  ) {
    return null;
  }
  const lines = lineExtents(text);
  for (let line = 0; line < lines.length; line += 1) {
    const extent = lines[line]!;
    if (offset >= extent.start && offset <= extent.end) {
      return Object.freeze({ line, character: offset - extent.start });
    }
  }
  return null;
}

function freezeTree<Value>(value: Value, seen = new WeakSet<object>()): Value {
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return value;
  }
  seen.add(value);
  for (const child of Object.values(value)) freezeTree(child, seen);
  return Object.freeze(value);
}

function validateSnapshotInput(input: DocumentSnapshotInput): void {
  if (
    typeof input.uri !== "string" ||
    input.uri.length === 0 ||
    typeof input.generation !== "string" ||
    input.generation.length === 0 ||
    !Number.isSafeInteger(input.version) ||
    typeof input.text !== "string"
  ) {
    throw new TypeError("document snapshot binding is invalid");
  }
}

function digestText(
  text: string,
  digester: (text: string) => string,
): DocumentSourceDigest {
  const digest = digester(text);
  if (!sha256Pattern.test(digest)) {
    throw new TypeError("document text digester returned an invalid SHA-256 digest");
  }
  return digest as DocumentSourceDigest;
}

function coordinateCompatibleSource(original: string, projected: string): boolean {
  if (original.length !== projected.length) return false;
  for (let offset = 0; offset < original.length; offset += 1) {
    const originalCode = original.charCodeAt(offset);
    const projectedCode = projected.charCodeAt(offset);
    const originalLineBreak = originalCode === 0x0a || originalCode === 0x0d;
    const projectedLineBreak = projectedCode === 0x0a || projectedCode === 0x0d;
    if (
      originalLineBreak !== projectedLineBreak ||
      originalLineBreak && originalCode !== projectedCode
    ) {
      return false;
    }
  }
  return true;
}

export function createDocumentSnapshot(
  input: DocumentSnapshotInput,
  options: DocumentSnapshotOptions,
): DocumentSnapshot {
  validateSnapshotInput(input);
  const maximum = normalizeMaxDiagnostics(options.maxDiagnostics);
  const prepared = options.prepareDocument?.(input.text, maximum);
  const analysisText = prepared?.analysisText ?? input.text;
  if (!coordinateCompatibleSource(input.text, analysisText)) {
    throw new TypeError("document preparation changed source coordinates");
  }
  const parse = parseDocument(analysisText, { maxDiagnostics: maximum });
  const semanticDiagnostics = prepared?.diagnostics ?? validateDocument(
    parse.document,
    parse.diagnostics,
  );
  const limited = limitDiagnostics(semanticDiagnostics, maximum);
  const binding: DocumentBinding = {
    uri: input.uri,
    generation: input.generation,
    version: input.version,
    sourceDigest: digestText(input.text, options.digestText),
  };
  const semantic: DocumentSemanticResult = {
    ok: !hasErrors(semanticDiagnostics),
    diagnostics: Object.freeze([...limited.diagnostics]),
    diagnosticsTruncated: parse.diagnosticsTruncated || limited.truncated,
  };
  freezeTree(parse);
  freezeTree(binding);
  freezeTree(semantic);
  return Object.freeze({
    binding,
    text: input.text,
    parse,
    semantic,
  });
}

function normalizedAnalysisMode(
  options: DocumentAnalysisOptions,
): DocumentAnalysisMode {
  const mode = options.mode ?? "both";
  if (
    mode !== "none" &&
    mode !== "precedence" &&
    mode !== "resource" &&
    mode !== "both"
  ) {
    throw new RangeError("document analysis mode is invalid");
  }
  return mode;
}

function snapshotAnalysisOptions(
  options: DocumentAnalysisOptions,
): DocumentAnalysisOptions {
  return {
    ...(options.mode === undefined ? {} : { mode: options.mode }),
    ...(options.capacityOverrides === undefined
      ? {}
      : { capacityOverrides: new Map(options.capacityOverrides) }),
    ...(options.maxPaths === undefined ? {} : { maxPaths: options.maxPaths }),
    ...(options.precision === undefined ? {} : { precision: options.precision }),
    ...(options.maxDiagnostics === undefined
      ? {}
      : { maxDiagnostics: options.maxDiagnostics }),
  };
}

function analysisProjection(
  snapshot: DocumentSnapshot,
  status: DocumentAnalysisProjection["status"],
  mode: DocumentAnalysisMode,
  diagnostics: readonly Diagnostic[],
  analysis: AnalysisResult | null,
): DocumentAnalysisProjection {
  return Object.freeze({
    status,
    binding: snapshot.binding,
    analysisMode: mode,
    complete: status === "current",
    diagnostics,
    analysis,
  });
}

export function analyzeDocumentSnapshot(
  snapshot: DocumentSnapshot,
  options: DocumentAnalysisOptions = {},
): DocumentAnalysisProjection {
  const acceptedOptions = snapshotAnalysisOptions(options);
  const mode = normalizedAnalysisMode(acceptedOptions);
  if (!snapshot.semantic.ok) {
    return analysisProjection(
      snapshot,
      "invalid",
      mode,
      snapshot.semantic.diagnostics,
      null,
    );
  }
  if (snapshot.semantic.diagnosticsTruncated) {
    return analysisProjection(
      snapshot,
      "unavailable",
      mode,
      snapshot.semantic.diagnostics,
      null,
    );
  }
  if (mode === "none") {
    return analysisProjection(
      snapshot,
      "current",
      mode,
      snapshot.semantic.diagnostics,
      null,
    );
  }
  const analysis = analyzeValidatedDocument(
    snapshot.parse.document as unknown as DocumentNode,
    snapshot.parse.document.declarations.find(
      (declaration) => declaration.kind === "project",
    )!.id,
    snapshot.semantic.diagnostics,
    false,
    {
      ...acceptedOptions,
      mode,
    },
  );
  if (!analysis.ok || analysis.diagnosticsTruncated) {
    return analysisProjection(
      snapshot,
      "unavailable",
      mode,
      analysis.diagnostics,
      null,
    );
  }
  return analysisProjection(
    snapshot,
    "current",
    mode,
    analysis.diagnostics,
    analysis,
  );
}

function applyChanges(
  text: string,
  changes: readonly DocumentContentChange[],
): string | null {
  if (changes.length === 0) return null;
  let candidate = text;
  for (const change of changes) {
    if (typeof change.text !== "string") return null;
    const start = documentPositionToOffset(candidate, change.range.start);
    const end = documentPositionToOffset(candidate, change.range.end);
    if (start === null || end === null || start > end) return null;
    candidate = candidate.slice(0, start) + change.text + candidate.slice(end);
  }
  return candidate;
}

function sameBinding(
  left: DocumentBinding,
  right: DocumentBinding,
): boolean {
  return (
    left.uri === right.uri &&
    left.generation === right.generation &&
    left.version === right.version &&
    left.sourceDigest === right.sourceDigest
  );
}

function analysisCacheKey(options: DocumentAnalysisOptions): string {
  const capacities = [...(options.capacityOverrides ?? new Map())]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  return JSON.stringify({
    mode: normalizedAnalysisMode(options),
    capacityOverrides: capacities,
    maxPaths: options.maxPaths ?? null,
    precision: options.precision ?? null,
    maxDiagnostics: options.maxDiagnostics ?? null,
  });
}

function projectionResult<Value>(
  status: DocumentProjectionStatus,
  binding: DocumentBinding,
  snapshot: DocumentSnapshot | null,
  value: Value | null,
  cached: boolean,
): DocumentProjectionResult<Value> {
  return Object.freeze({ status, binding, snapshot, value, cached });
}

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

async function cancellable<Value>(
  work: Promise<Value>,
  signal: AbortSignal | undefined,
): Promise<{ readonly cancelled: true } | { readonly cancelled: false; readonly value: Value }> {
  if (signal === undefined) {
    return { cancelled: false, value: await work };
  }
  if (signal.aborted) return { cancelled: true };
  return await new Promise((resolve, reject) => {
    const onAbort = (): void => {
      signal.removeEventListener("abort", onAbort);
      resolve({ cancelled: true });
    };
    signal.addEventListener("abort", onAbort, { once: true });
    work.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve({ cancelled: false, value });
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

class ProtocolNeutralDocumentSession implements DocumentSession {
  readonly #options: DocumentSnapshotOptions;
  readonly #documents = new Map<string, DocumentSnapshot>();
  readonly #cache = new WeakMap<DocumentSnapshot, Map<string, unknown>>();
  #generation = 0;
  #state: DocumentSession["state"] = "active";

  constructor(options: DocumentSnapshotOptions) {
    this.#options = Object.freeze({
      digestText: options.digestText,
      ...(options.maxDiagnostics === undefined
        ? {}
        : { maxDiagnostics: options.maxDiagnostics }),
      ...(options.prepareDocument === undefined
        ? {}
        : { prepareDocument: options.prepareDocument }),
    });
  }

  get state(): DocumentSession["state"] {
    return this.#state;
  }

  #transition(
    status: DocumentSessionTransition["status"],
    snapshot: DocumentSnapshot | null,
    reason: DocumentSessionFailureReason | null,
  ): DocumentSessionTransition {
    return Object.freeze({ status, snapshot, reason });
  }

  #desynchronize(reason: DocumentSessionFailureReason): DocumentSessionTransition {
    this.#documents.clear();
    this.#state = "desynchronized";
    return this.#transition("desynchronized", null, reason);
  }

  open(
    input: Omit<DocumentSnapshotInput, "generation">,
  ): DocumentSessionTransition {
    if (this.#state === "closed") return this.#transition("closed", null, null);
    if (this.#state === "desynchronized") {
      return this.#transition("desynchronized", null, null);
    }
    if (
      typeof input.uri !== "string" ||
      input.uri.length === 0 ||
      !Number.isSafeInteger(input.version) ||
      typeof input.text !== "string"
    ) {
      return this.#desynchronize("invalid_binding");
    }
    if (this.#documents.has(input.uri)) {
      return this.#desynchronize("document_already_open");
    }
    const generation = `g${this.#generation + 1}`;
    let snapshot: DocumentSnapshot;
    try {
      snapshot = createDocumentSnapshot(
        { ...input, generation },
        this.#options,
      );
    } catch {
      return this.#desynchronize("snapshot_unavailable");
    }
    this.#generation += 1;
    this.#documents.set(input.uri, snapshot);
    return this.#transition("current", snapshot, null);
  }

  change(input: DocumentSessionChange): DocumentSessionTransition {
    if (this.#state === "closed") return this.#transition("closed", null, null);
    if (this.#state === "desynchronized") {
      return this.#transition("desynchronized", null, null);
    }
    if (
      typeof input.uri !== "string" ||
      input.uri.length === 0 ||
      !Number.isSafeInteger(input.version)
    ) {
      return this.#desynchronize("invalid_binding");
    }
    const previous = this.#documents.get(input.uri);
    if (previous === undefined) return this.#desynchronize("document_not_open");
    if (input.version <= previous.binding.version) {
      return this.#desynchronize("version_not_increasing");
    }
    let text: string | null = null;
    try {
      text = applyChanges(previous.text, input.changes);
    } catch {
      // A structurally malformed change has the same fail-closed meaning as an
      // invalid range supplied through the typed boundary.
    }
    if (text === null) return this.#desynchronize("invalid_change");
    let snapshot: DocumentSnapshot;
    try {
      snapshot = createDocumentSnapshot(
        {
          uri: input.uri,
          generation: previous.binding.generation,
          version: input.version,
          text,
        },
        this.#options,
      );
    } catch {
      return this.#desynchronize("snapshot_unavailable");
    }
    this.#documents.set(input.uri, snapshot);
    return this.#transition("current", snapshot, null);
  }

  close(uri: string): boolean {
    if (this.#state !== "active") return false;
    return this.#documents.delete(uri);
  }

  current(uri: string): DocumentSnapshot | null {
    if (this.#state !== "active") return null;
    return this.#documents.get(uri) ?? null;
  }

  resolve(binding: DocumentBinding): DocumentProjectionStatus {
    if (this.#state === "desynchronized") return "desynchronized";
    if (this.#state === "closed") return "closed";
    const snapshot = this.#documents.get(binding.uri);
    if (snapshot === undefined) return "closed";
    return sameBinding(snapshot.binding, binding) ? "current" : "stale";
  }

  async project<Value>(
    request: DocumentProjectionRequest<Value>,
  ): Promise<DocumentProjectionResult<Value>> {
    if (request.cacheKey.length === 0) {
      throw new TypeError("document projection cache key must not be empty");
    }
    if (isAborted(request.signal)) {
      return projectionResult<Value>("cancelled", request.binding, null, null, false);
    }
    const resolved = this.resolve(request.binding);
    if (resolved !== "current") {
      return projectionResult<Value>(resolved, request.binding, null, null, false);
    }
    const snapshot = this.#documents.get(request.binding.uri)!;
    if (!snapshot.semantic.ok && request.allowInvalid !== true) {
      return projectionResult<Value>("invalid", request.binding, snapshot, null, false);
    }
    if (
      snapshot.semantic.diagnosticsTruncated &&
      request.allowTruncated !== true
    ) {
      return projectionResult<Value>("unavailable", request.binding, snapshot, null, false);
    }
    const cache = this.#cache.get(snapshot) ?? new Map<string, unknown>();
    this.#cache.set(snapshot, cache);
    if (cache.has(request.cacheKey)) {
      return projectionResult(
        "current",
        request.binding,
        snapshot,
        cache.get(request.cacheKey) as Value,
        true,
      );
    }
    const work = Promise.resolve().then(() => request.compute(snapshot));
    const completed = await cancellable(work, request.signal);
    if (completed.cancelled) {
      void work.catch(() => undefined);
      return projectionResult<Value>("cancelled", request.binding, null, null, false);
    }
    const after = this.resolve(request.binding);
    if (after !== "current") {
      return projectionResult<Value>(after, request.binding, null, null, false);
    }
    if (isAborted(request.signal)) {
      return projectionResult<Value>("cancelled", request.binding, null, null, false);
    }
    cache.set(request.cacheKey, completed.value);
    return projectionResult(
      "current",
      request.binding,
      snapshot,
      completed.value,
      false,
    );
  }

  async analyze(
    binding: DocumentBinding,
    options: DocumentAnalysisOptions = {},
    signal?: AbortSignal,
  ): Promise<DocumentSessionAnalysisResult> {
    const acceptedOptions = snapshotAnalysisOptions(options);
    const analysisMode = normalizedAnalysisMode(acceptedOptions);
    const projection = await this.project({
      binding,
      cacheKey: `analysis:${analysisCacheKey(acceptedOptions)}`,
      ...(signal === undefined ? {} : { signal }),
      compute: (snapshot) => analyzeDocumentSnapshot(snapshot, acceptedOptions),
    });
    if (projection.status !== "current" || projection.value === null) {
      return Object.freeze({
        status: projection.status,
        binding,
        snapshot: projection.snapshot,
        analysisMode,
        complete: false,
        diagnostics: projection.snapshot?.semantic.diagnostics ?? Object.freeze([]),
        analysis: null,
        cached: false,
      });
    }
    const value = projection.value;
    return Object.freeze({
      status: value.status,
      binding,
      snapshot: projection.snapshot,
      analysisMode,
      complete: value.complete,
      diagnostics: value.diagnostics,
      analysis: value.analysis,
      cached: projection.cached,
    });
  }

  dispose(): void {
    this.#documents.clear();
    this.#state = "closed";
  }
}

export function createDocumentSession(
  options: DocumentSnapshotOptions,
): DocumentSession {
  return new ProtocolNeutralDocumentSession(options);
}
