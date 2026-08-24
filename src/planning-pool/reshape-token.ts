import { sha256DigestUtf8 } from "../model/sha256.js";
import type {
  PlanningReshapeBinding,
  PlanningReshapeTokenDecision,
  PlanningReshapeTokenIssue,
  PlanningReshapeTokenSnapshot,
  PlanningReshapeTokenState,
} from "./reshape-types.js";

export const PLANNING_RESHAPE_TOKEN_LIFETIME_MS = 3_600_000;
export const PLANNING_RESHAPE_TOKEN_CAPACITY = 256;

interface TokenRecord {
  readonly tokenDigest: string;
  readonly binding: PlanningReshapeBinding;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
  state: PlanningReshapeTokenState;
}

export interface PlanningReshapeTokenRegistryOptions {
  readonly now?: () => number;
  readonly randomBytes?: (size: number) => Uint8Array;
  readonly lifetimeMs?: number;
  readonly capacity?: number;
  readonly snapshots?: readonly PlanningReshapeTokenSnapshot[];
}

const sha256Pattern = /^sha256:[0-9a-f]{64}$/u;

function frozenBinding(binding: PlanningReshapeBinding): PlanningReshapeBinding {
  return Object.freeze({
    normalizationContract: binding.normalizationContract,
    preflightHash: binding.preflightHash,
    sourceDigest: binding.sourceDigest,
    candidateDigest: binding.candidateDigest,
  });
}

function validSnapshotIdentity(snapshot: PlanningReshapeTokenSnapshot): boolean {
  return sha256Pattern.test(snapshot.tokenDigest) &&
    snapshot.binding.normalizationContract === "perttool.planning-reshape-normalization@1" &&
    sha256Pattern.test(snapshot.binding.preflightHash) &&
    sha256Pattern.test(snapshot.binding.sourceDigest) &&
    sha256Pattern.test(snapshot.binding.candidateDigest) &&
    ["unused", "committing", "consumed"].includes(snapshot.state);
}

function tokenDigest(token: string): string {
  return sha256DigestUtf8(token);
}

function secureRandomBytes(size: number): Uint8Array {
  const crypto = globalThis.crypto;
  if (crypto === undefined || typeof crypto.getRandomValues !== "function") {
    throw new Error("a cryptographically secure planning reshape token source is unavailable");
  }
  return crypto.getRandomValues(new Uint8Array(size));
}

const base64UrlAlphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function base64Url(bytes: Uint8Array): string {
  let result = "";
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const first = bytes[offset]!;
    const second = bytes[offset + 1];
    const third = bytes[offset + 2];
    result += base64UrlAlphabet[first >>> 2];
    result += base64UrlAlphabet[((first & 0x03) << 4) | ((second ?? 0) >>> 4)];
    if (second !== undefined) result += base64UrlAlphabet[((second & 0x0f) << 2) | ((third ?? 0) >>> 6)];
    if (third !== undefined) result += base64UrlAlphabet[third & 0x3f];
  }
  return result;
}

function sameBinding(
  left: PlanningReshapeBinding,
  right: PlanningReshapeBinding,
): boolean {
  return left.normalizationContract === right.normalizationContract &&
    left.preflightHash === right.preflightHash &&
    left.sourceDigest === right.sourceDigest &&
    left.candidateDigest === right.candidateDigest;
}

function decision(
  ok: boolean,
  state: PlanningReshapeTokenDecision["state"],
  recovered = false,
  completed = false,
): PlanningReshapeTokenDecision {
  return Object.freeze({ ok, state, recovered, completed });
}

export class PlanningReshapeTokenRegistry {
  readonly #records = new Map<string, TokenRecord>();
  readonly #now: () => number;
  readonly #randomBytes: (size: number) => Uint8Array;
  readonly #lifetimeMs: number;
  readonly #capacity: number;

  constructor(options: PlanningReshapeTokenRegistryOptions = {}) {
    this.#now = options.now ?? Date.now;
    this.#randomBytes = options.randomBytes ?? secureRandomBytes;
    this.#lifetimeMs = options.lifetimeMs ?? PLANNING_RESHAPE_TOKEN_LIFETIME_MS;
    this.#capacity = options.capacity ?? PLANNING_RESHAPE_TOKEN_CAPACITY;
    if (!Number.isSafeInteger(this.#lifetimeMs) || this.#lifetimeMs <= 0) {
      throw new TypeError("planning reshape token lifetime must be positive");
    }
    if (!Number.isSafeInteger(this.#capacity) || this.#capacity <= 0) {
      throw new TypeError("planning reshape token capacity must be positive");
    }
    this.#restore(options.snapshots ?? []);
  }

  #restore(snapshots: readonly PlanningReshapeTokenSnapshot[]): void {
    const now = this.#now();
    for (const snapshot of snapshots) {
      const issuedAtMs = Date.parse(snapshot.issuedAt);
      const expiresAtMs = Date.parse(snapshot.expiresAt);
      const validTimes = Number.isFinite(issuedAtMs) && Number.isFinite(expiresAtMs) &&
        expiresAtMs - issuedAtMs === this.#lifetimeMs;
      if (!validSnapshotIdentity(snapshot) || !validTimes) {
        throw new TypeError("planning reshape token snapshot is invalid");
      }
      if (expiresAtMs <= now) continue;
      if (this.#records.has(snapshot.tokenDigest)) throw new TypeError("planning reshape token snapshot is duplicated");
      if (this.#records.size >= this.#capacity) throw new TypeError("planning reshape token snapshot capacity is exceeded");
      this.#records.set(snapshot.tokenDigest, {
        tokenDigest: snapshot.tokenDigest,
        binding: frozenBinding(snapshot.binding),
        issuedAtMs,
        expiresAtMs,
        state: snapshot.state,
      });
    }
  }

  #purgeExpired(now: number): void {
    for (const [digest, record] of this.#records) {
      if (record.expiresAtMs <= now) this.#records.delete(digest);
    }
  }

  #record(token: string): Readonly<{ record: TokenRecord | null; state: "unknown" | "expired" | null }> {
    const digest = tokenDigest(token);
    const record = this.#records.get(digest);
    if (record === undefined) return Object.freeze({ record: null, state: "unknown" });
    if (record.expiresAtMs <= this.#now()) {
      this.#records.delete(digest);
      return Object.freeze({ record: null, state: "expired" });
    }
    return Object.freeze({ record, state: null });
  }

  issue(binding: PlanningReshapeBinding): PlanningReshapeTokenIssue | null {
    const now = this.#now();
    this.#purgeExpired(now);
    if (this.#records.size >= this.#capacity) return null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const bytes = this.#randomBytes(32);
      if (bytes.byteLength < 32) throw new Error("planning reshape token source returned fewer than 256 bits");
      const token = base64Url(bytes);
      const digest = tokenDigest(token);
      if (this.#records.has(digest)) continue;
      const expiresAtMs = now + this.#lifetimeMs;
      this.#records.set(digest, {
        tokenDigest: digest,
        binding: frozenBinding(binding),
        issuedAtMs: now,
        expiresAtMs,
        state: "unused",
      });
      return Object.freeze({ token, expiresAt: new Date(expiresAtMs).toISOString() });
    }
    throw new Error("planning reshape token source repeatedly collided");
  }

  verify(token: string, binding: PlanningReshapeBinding): PlanningReshapeTokenDecision {
    const found = this.#record(token);
    if (found.record === null) return decision(false, found.state!);
    const { record } = found;
    if (!sameBinding(record.binding, binding)) return decision(false, "mismatch");
    return record.state === "unused"
      ? decision(true, "unused")
      : decision(false, record.state);
  }

  beginCommit(token: string, binding: PlanningReshapeBinding): PlanningReshapeTokenDecision {
    const verified = this.verify(token, binding);
    if (!verified.ok) return verified;
    const record = this.#records.get(tokenDigest(token));
    if (record === undefined) return decision(false, "unknown");
    record.state = "committing";
    return decision(true, "committing");
  }

  settleCommit(token: string, observedDigest: string): PlanningReshapeTokenDecision {
    const found = this.#record(token);
    if (found.record === null) return decision(false, found.state!);
    const { record } = found;
    if (record.state !== "committing") return decision(false, record.state);
    if (observedDigest === record.binding.candidateDigest) {
      record.state = "consumed";
      return decision(true, "consumed", false, true);
    }
    if (observedDigest === record.binding.sourceDigest) {
      record.state = "unused";
      return decision(true, "unused", true, false);
    }
    return decision(false, "mismatch");
  }

  snapshots(): readonly PlanningReshapeTokenSnapshot[] {
    const now = this.#now();
    this.#purgeExpired(now);
    return Object.freeze([...this.#records.values()].map((record) => Object.freeze({
      tokenDigest: record.tokenDigest,
      binding: record.binding,
      issuedAt: new Date(record.issuedAtMs).toISOString(),
      expiresAt: new Date(record.expiresAtMs).toISOString(),
      state: record.state,
    })));
  }
}
