import { digestDocumentBytes } from "../io/document-file.js";
import { createValidatedDocumentFile, replaceValidatedDocumentFile } from "../io/safe-write.js";
import { parseTemporalScheduleSource, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY } from "../temporal-schedule/source.js";
export interface Contract9WritableCandidate {
  readonly ok: boolean; readonly changed: boolean; readonly originalDigest: string; readonly updatedDigest: string | null;
  readonly updatedText: string | null; readonly governance?: Readonly<{ readonly writeAuthorized: boolean; readonly intent: string }> | null;
}

export type Contract9WriteRequest = Readonly<{ mode: "preview" }> | Readonly<{ mode: "in_place"; target: string; expectedDigest?: string }>
  | Readonly<{ mode: "out"; target: string }>;
export interface Contract9WriteProjection { readonly mode: "preview" | "in_place" | "out"; readonly target: string | null; readonly written: boolean }

export async function persistContract9Mutation(result: Contract9WritableCandidate,
  request: Contract9WriteRequest): Promise<Contract9WriteProjection> {
  if (request.mode === "preview" || !result.changed) return Object.freeze({ mode: request.mode, target: request.mode === "preview" ? null : request.target, written: false });
  if (!result.ok || result.updatedText === null || result.updatedDigest === null ||
    (result.governance !== undefined && result.governance !== null && (!result.governance.writeAuthorized || result.governance.intent !== "persist"))) {
    throw new TypeError("authorized Contract 9 result does not contain a writable candidate");
  }
  if (digestDocumentBytes(Buffer.from(result.updatedText, "utf8")) !== result.updatedDigest) throw new TypeError("Contract 9 candidate digest mismatch");
  const validator = (text: string) => { const parsed = parseTemporalScheduleSource(text, TEMPORAL_SCHEDULE_SOURCE_CAPABILITY);
    return { ok: parsed.ok && parsed.grammarVersion === 8 && parsed.model !== null, diagnostics: [] }; };
  const output = request.mode === "in_place"
    ? await replaceValidatedDocumentFile(request.target, result.updatedText, { initialDigest: result.originalDigest,
      ...(request.expectedDigest === undefined ? {} : { expectedDigest: request.expectedDigest }) }, validator)
    : await createValidatedDocumentFile(request.target, result.updatedText, validator);
  if (output.digest !== result.updatedDigest) throw new TypeError("Contract 9 safe-write digest mismatch");
  return Object.freeze({ mode: request.mode, target: request.target, written: output.written });
}
