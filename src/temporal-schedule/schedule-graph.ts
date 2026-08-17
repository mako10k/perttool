import { compareStableStrings } from "../model/diagnostics.js";
import type { CalendarSchedulerInput, SchedulerEdgeInput } from "./scheduler-types.js";

export interface TemporalScheduleGraph {
  readonly incoming: ReadonlyMap<string, readonly SchedulerEdgeInput[]>;
  readonly outgoing: ReadonlyMap<string, readonly SchedulerEdgeInput[]>;
  readonly order: readonly string[];
}

export function temporalScheduleGraph(input: CalendarSchedulerInput): TemporalScheduleGraph {
  const incoming = new Map(input.milestoneIds.map((id) => [id, [] as SchedulerEdgeInput[]]));
  const outgoing = new Map(input.milestoneIds.map((id) => [id, [] as SchedulerEdgeInput[]]));
  const ids = new Set<string>();
  for (const edge of input.edges) {
    if (ids.has(edge.id) || !incoming.has(edge.source) || !incoming.has(edge.target)) {
      throw new TypeError(`invalid temporal schedule edge ${edge.id}`);
    }
    ids.add(edge.id);
    incoming.get(edge.target)!.push(edge);
    outgoing.get(edge.source)!.push(edge);
  }
  const degree = new Map(input.milestoneIds.map((id) => [id, incoming.get(id)!.length]));
  const ready = [...degree].filter(([, value]) => value === 0).map(([id]) => id).sort(compareStableStrings);
  const order: string[] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const edge of outgoing.get(id)!) {
      const value = degree.get(edge.target)! - 1;
      degree.set(edge.target, value);
      if (value === 0) {
        ready.push(edge.target);
        ready.sort(compareStableStrings);
      }
    }
  }
  if (order.length !== input.milestoneIds.length) throw new TypeError("temporal schedule graph contains a cycle");
  return Object.freeze({ incoming, outgoing, order: Object.freeze(order) });
}
