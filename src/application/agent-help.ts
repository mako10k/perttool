import { getBundledAgentGuidance } from "../guidance/query.js";
import type {
  AgentGuidanceQuery,
  AgentGuidanceResult,
} from "../guidance/types.js";

export function getAgentHelp(
  query: AgentGuidanceQuery = {},
): AgentGuidanceResult {
  return getBundledAgentGuidance(query);
}
