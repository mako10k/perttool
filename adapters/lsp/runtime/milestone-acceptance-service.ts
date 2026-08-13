import {
  inspectEditorMilestoneAcceptance,
  prepareEditorMilestoneAcceptanceDocument,
} from "../../../src/application/editor-milestone-acceptance.js";
import type { MilestoneAcceptanceEditorApplicationV1 } from "../src/protocol.js";

export function createMilestoneAcceptanceEditorApplication():
  MilestoneAcceptanceEditorApplicationV1 {
  return Object.freeze({
    prepareDocument: prepareEditorMilestoneAcceptanceDocument,
    inspect: inspectEditorMilestoneAcceptance,
  });
}
