import { randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  rename,
  stat,
  unlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PlanningReshapeTokenRegistry,
  PLANNING_RESHAPE_TOKEN_LIFETIME_MS,
} from "../planning-pool/reshape-token.js";
import type { PlanningReshapeTokenSnapshot } from "../planning-pool/reshape-types.js";

const directory = join(tmpdir(), "perttool-planning-reshape-v1");
const userIdentity = typeof process.getuid === "function"
  ? String(process.getuid())
  : "default";
const registryPath = join(directory, `registry-${userIdentity}.json`);
const lockPath = join(directory, `registry-${userIdentity}.lock`);

interface StoredRegistry {
  readonly model_version: 1;
  readonly snapshots: readonly PlanningReshapeTokenSnapshot[];
}

function stored(value: unknown): value is StoredRegistry {
  return typeof value === "object" && value !== null && !Array.isArray(value) &&
    (value as Record<string, unknown>)["model_version"] === 1 &&
    Array.isArray((value as Record<string, unknown>)["snapshots"]);
}

async function snapshots(): Promise<readonly PlanningReshapeTokenSnapshot[]> {
  let bytes: string;
  try {
    bytes = await readFile(registryPath, "utf8");
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return Object.freeze([]);
    }
    throw error;
  }
  const parsed = JSON.parse(bytes) as unknown;
  if (!stored(parsed)) throw new Error("planning reshape token registry is invalid");
  return Object.freeze([...parsed.snapshots]);
}

async function save(registry: PlanningReshapeTokenRegistry): Promise<void> {
  const target = `${registryPath}.${randomUUID()}.tmp`;
  const handle = await open(target, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify({
      model_version: 1,
      snapshots: registry.snapshots(),
    })}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(target, registryPath);
}

async function removeExpiredLock(): Promise<void> {
  try {
    const metadata = await stat(lockPath);
    if (Date.now() - metadata.mtimeMs > PLANNING_RESHAPE_TOKEN_LIFETIME_MS) {
      await unlink(lockPath);
    }
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
}

export async function withPlanningReshapeTokenRegistry<T>(
  operation: (registry: PlanningReshapeTokenRegistry) => T | Promise<T>,
): Promise<T> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await removeExpiredLock();
  let lock;
  try {
    lock = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST") {
      throw new Error("planning reshape token registry is busy");
    }
    throw error;
  }
  try {
    const registry = new PlanningReshapeTokenRegistry({
      snapshots: await snapshots(),
    });
    try {
      return await operation(registry);
    } finally {
      await save(registry);
    }
  } finally {
    await lock.close();
    await unlink(lockPath).catch(() => undefined);
  }
}
