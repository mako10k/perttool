import { planEditorRepair } from
  "../../../src/application/editor-repair.js";
import type { EditorRepairApplicationV1 } from "../src/protocol.js";

export function createEditorRepairApplication(): EditorRepairApplicationV1 {
  return Object.freeze({ plan: planEditorRepair });
}
