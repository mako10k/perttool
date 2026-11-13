// R: Solve exact maximum-cardinality resource packing with semantic-rank and ID tie-breaks.
import { compareStableStrings } from "../model/diagnostics.js";
import type { DispatchCandidate } from "./maximum-count-types.js";

interface Profile {
  readonly members: readonly number[];
  readonly demand: readonly number[];
}

interface SearchFrame {
  readonly offset: number;
  readonly remaining: readonly number[];
  readonly key: string;
  readonly minimum: number;
  take: number;
  best: readonly number[];
}

function profilesFor(
  candidates: readonly DispatchCandidate[],
  resourceIds: readonly string[],
): readonly Profile[] {
  const profiles = new Map<string, { members: number[]; demand: number[] }>();
  for (const [index, candidate] of candidates.entries()) {
    const requirements = new Map(candidate.requirements.map((item) => [item.resourceId, item.units]));
    const demand = resourceIds.map((id) => requirements.get(id) ?? 0);
    const key = demand.join(",");
    let profile = profiles.get(key);
    if (profile === undefined) {
      profile = { members: [], demand };
      profiles.set(key, profile);
    }
    profile.members.push(index);
  }
  return [...profiles.values()];
}

function betterSelection(
  left: readonly number[],
  right: readonly number[],
  candidates: readonly DispatchCandidate[],
): boolean {
  if (left.length !== right.length) return left.length > right.length;
  const counts = new Map<number, number>();
  for (const index of left) {
    const group = candidates[index]!.rankGroup;
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  for (const index of right) {
    const group = candidates[index]!.rankGroup;
    counts.set(group, (counts.get(group) ?? 0) - 1);
  }
  for (const group of [...counts.keys()].sort((a, b) => a - b)) {
    if (counts.get(group) !== 0) return counts.get(group)! > 0;
  }
  // Candidate indices already follow semantic rank and stable task ID order.
  for (let index = 0; index < left.length; index++) {
    if (left[index] !== right[index]) return left[index]! < right[index]!;
  }
  return false;
}

function maximumTake(profile: Profile, available: readonly number[]): number {
  let count = profile.members.length;
  for (const [index, units] of profile.demand.entries()) {
    if (units > 0) {
      count = Math.min(count, Number(BigInt(available[index]!) / BigInt(units)));
    }
  }
  return count;
}

function completeSuffix(
  profiles: readonly Profile[],
  offset: number,
  available: readonly number[],
): readonly number[] | undefined {
  let remaining = [...available];
  const members: number[] = [];
  for (const profile of profiles.slice(offset)) {
    if (maximumTake(profile, remaining) < profile.members.length) return undefined;
    remaining = remaining.map((units, index) => units - profile.demand[index]! * profile.members.length);
    members.push(...profile.members);
  }
  return members.sort((a, b) => a - b);
}

/** Candidates with identical requirements are interchangeable for feasibility.
 * Taking k from a profile always takes its best k ranked members. Memoization
 * therefore explores resource states rather than every permutation of tasks.
 */
export function solveMaximumCount(
  input: readonly DispatchCandidate[],
  resourceIds: readonly string[],
  available: readonly number[],
): readonly DispatchCandidate[] {
  const candidates = [...input].sort((left, right) =>
    left.rankGroup - right.rankGroup || compareStableStrings(left.taskId, right.taskId));
  const profiles = profilesFor(candidates, resourceIds).filter((profile) =>
    maximumTake(profile, available) > 0);
  const all = completeSuffix(profiles, 0, available);
  if (all !== undefined) return all.map((index) => candidates[index]!);
  const memo = new Map<string, readonly number[]>();
  const frame = (offset: number, remaining: readonly number[]): SearchFrame => {
    const profile = profiles[offset]!;
    const limit = maximumTake(profile, remaining);
    return {
      offset, remaining, key: `${offset}:${remaining.join(",")}`, take: limit,
      // Free tasks are always selected; otherwise consider every feasible take.
      minimum: profile.demand.every((units) => units === 0) ? limit : 0,
      best: [],
    };
  };
  if (profiles.length === 0) return [];
  const stack = [frame(0, available)];
  const rootKey = stack[0]!.key;
  // An explicit stack avoids imposing a JavaScript recursion-depth limit on
  // the number of distinct requirement profiles.
  while (stack.length > 0) {
    const current = stack[stack.length - 1]!;
    if (current.take < current.minimum) {
      memo.set(current.key, current.best);
      stack.pop();
      continue;
    }
    const profile = profiles[current.offset]!;
    const next = current.remaining.map((units, index) => units - profile.demand[index]! * current.take);
    const offset = current.offset + 1;
    const childKey = `${offset}:${next.join(",")}`;
    let suffix = memo.get(childKey);
    if (suffix === undefined) {
      suffix = completeSuffix(profiles, offset, next);
      if (suffix !== undefined) memo.set(childKey, suffix);
    }
    if (suffix === undefined) {
      stack.push(frame(offset, next));
      continue;
    }
    const choice = [...profile.members.slice(0, current.take), ...suffix].sort((a, b) => a - b);
    if (betterSelection(choice, current.best, candidates)) current.best = choice;
    current.take--;
  }
  return memo.get(rootKey)!.map((index) => candidates[index]!);
}
