import type {
  CreateDocumentOptions,
  DocumentWriteResult,
  ReplaceDocumentOptions,
} from "../io/safe-write.js";
import type {
  TargetGrammar6Capability,
} from "../parser/document-parser.js";
import type { NodeHostPorts } from "../ports/node-host.js";
import {
  validateTargetGrammar6Document,
} from "../semantic/target-validator.js";
import {
  analyzeDocument,
  checkDocument,
  selectNextTasks,
} from "./contract7-assurance.js";
import {
  planAdvance,
  planAssuranceMutation,
  planBatchMutation,
  planFinishActuals,
  planLifecycle,
  planMutation,
} from "./contract7-mutation.js";
import {
  getProjectMetadata,
  contract7ProjectResultToJson,
  renderContract7ProjectText,
} from "./contract7-project.js";
import {
  contract7InspectionResultToJson,
  contract7MutationResultToJson,
  contract7SnakeJson,
} from "./contract7-projection.js";
import {
  planFormat,
} from "./contract7-source.js";
import {
  planUnitMigration,
  withUnitMigrationWrite,
} from "./contract7-unit-migration.js";
import {
  contract6WorkEventToJson,
} from "./contract6-projection.js";
import {
  getAgentHelp,
} from "./agent-help.js";
import {
  renderAdvanceHistoryGuard,
} from "./advance-history.js";
import {
  planProjectInit,
  projectInitResultToJson,
  renderProjectInitResult,
  withProjectInitOutput,
} from "./init.js";
import {
  prepareTargetPlanAssuranceAdvanceHistory,
  withTargetPlanAssuranceAdvanceHistoryRace,
  type TargetPlanAssuranceAdvanceHistoryOptions,
  type TargetPlanAssuranceAdvanceResultV2WithHistory,
} from "./target-assurance-advance-history.js";
import {
  inspectTargetPlanAssurance,
} from "./target-assurance-inspection.js";
import {
  persistTargetPlanAssuranceResult,
  type TargetPlanAssurancePersistenceRequest,
  type TargetPlanAssuranceWritableResult,
} from "./target-assurance-write.js";
import {
  renderTargetGovernanceDecision,
} from "./target-governance-projection.js";
import {
  inspectTargetProjectHistoryFile,
  renderTargetProjectHistoryText,
  targetProjectHistoryResultToJson,
  type TargetProjectHistoryFileRequest,
} from "./target-project-history.js";
import {
  observeTargetProjectVelocity,
  renderTargetVelocityObservationText,
  targetVelocityObservationResultToJson,
} from "./target-velocity-observation.js";
import {
  inspectTargetHistoricalGraphFile,
  renderTargetHistoricalGraphText,
  targetHistoricalGraphResultToJson,
  type HistoricalGraphGitEvidencePortV1,
  type HistoricalGraphRequestV1,
} from "./target-historical-graph.js";

function grammar6Validator(capability: TargetGrammar6Capability) {
  return (text: string) => {
    const checked = validateTargetGrammar6Document(text, capability);
    return {
      ok: checked.ok,
      diagnostics: checked.diagnostics,
    };
  };
}

function decodeDocumentBytes(host: NodeHostPorts, bytes: Uint8Array) {
  const ownedBytes = new Uint8Array(bytes);
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  return Object.freeze({
    bytes: ownedBytes,
    text: decoder.decode(ownedBytes),
    digest: host.digest.sha256Bytes(ownedBytes),
  });
}

/**
 * Constructs the CLI's protocol-neutral Application and Node-port boundary.
 * The returned values are references to the established Application services;
 * the wrappers only bind environmental work to the supplied Host ports.
 */
export function createCliApplicationFacade(
  host: NodeHostPorts,
  historicalGitEvidence?: HistoricalGraphGitEvidencePortV1,
) {
  const readDocumentContent = async (path: string) =>
    decodeDocumentBytes(host, await host.documentBytes.read(path));
  const createTargetGrammar6Document = (
    target: string,
    candidateText: string,
    capability: TargetGrammar6Capability,
    options: CreateDocumentOptions = {},
  ): Promise<DocumentWriteResult> => host.safePersistence.createValidatedDocument(
    target,
    candidateText,
    grammar6Validator(capability),
    options,
  );
  const replaceTargetGrammar6Document = (
    target: string,
    candidateText: string,
    capability: TargetGrammar6Capability,
    options: ReplaceDocumentOptions,
  ): Promise<DocumentWriteResult> => host.safePersistence.replaceValidatedDocument(
    target,
    candidateText,
    options,
    grammar6Validator(capability),
  );
  const inspectProjectHistoryFile = (
    request: TargetProjectHistoryFileRequest,
    capability: TargetGrammar6Capability,
  ) => inspectTargetProjectHistoryFile(
    request,
    capability,
    {},
    host.gitEvidence.probeHistory,
  );
  const prepareAdvanceHistory = (
    text: string,
    result: Parameters<typeof prepareTargetPlanAssuranceAdvanceHistory>[1],
    capability: TargetGrammar6Capability,
    options: TargetPlanAssuranceAdvanceHistoryOptions,
  ) => prepareTargetPlanAssuranceAdvanceHistory(
    text,
    result,
    capability,
    {
      ...options,
      captureBaseline: host.gitEvidence.captureAdvanceBaseline,
    },
  );
  const persistPlanAssuranceResult = (
    result: TargetPlanAssuranceWritableResult,
    capability: TargetGrammar6Capability,
    request: TargetPlanAssurancePersistenceRequest,
  ) => persistTargetPlanAssuranceResult(
    result,
    capability,
    request,
    host.safePersistence,
  );
  const inspectHistoricalGraphFile = (
    request: HistoricalGraphRequestV1,
  ) => {
    if (historicalGitEvidence === undefined) {
      throw new Error("historical Git evidence Host is unavailable");
    }
    return inspectTargetHistoricalGraphFile(request, historicalGitEvidence);
  };

  return Object.freeze({
    hostModelVersion: host.modelVersion,
    analyzeDocument,
    checkDocument,
    selectNextTasks,
    planFormat,
    planProjectInit,
    projectInitResultToJson,
    renderProjectInitResult,
    withProjectInitOutput,
    planUnitMigration,
    withUnitMigrationWrite,
    getProjectMetadata,
    contract7ProjectResultToJson,
    renderContract7ProjectText,
    planAdvance,
    planAssuranceMutation,
    planBatchMutation,
    planFinishActuals,
    planLifecycle,
    planMutation,
    renderTargetGovernanceDecision,
    contract7InspectionResultToJson,
    contract7MutationResultToJson,
    contract7SnakeJson,
    contract6WorkEventToJson,
    renderAdvanceHistoryGuard,
    prepareTargetPlanAssuranceAdvanceHistory: prepareAdvanceHistory,
    withTargetPlanAssuranceAdvanceHistoryRace,
    persistTargetPlanAssuranceResult: persistPlanAssuranceResult,
    inspectTargetPlanAssurance,
    inspectTargetProjectHistoryFile: inspectProjectHistoryFile,
    renderTargetProjectHistoryText,
    targetProjectHistoryResultToJson,
    observeTargetProjectVelocity,
    renderTargetVelocityObservationText,
    targetVelocityObservationResultToJson,
    inspectTargetHistoricalGraphFile: inspectHistoricalGraphFile,
    renderTargetHistoricalGraphText,
    targetHistoricalGraphResultToJson,
    getAgentHelp,
    documentContentFromBytes: (bytes: Uint8Array) =>
      decodeDocumentBytes(host, bytes),
    readDocumentContent,
    readBytes: host.documentBytes.read,
    recheckAdvanceHistoryBaseline: host.gitEvidence.recheckAdvanceBaseline,
    createArtifactFile: host.safePersistence.createArtifact,
    createTargetGrammar6DocumentFile: createTargetGrammar6Document,
    replaceTargetGrammar6DocumentFile: replaceTargetGrammar6Document,
  });
}

export type CliApplicationFacade = ReturnType<
  typeof createCliApplicationFacade
>;

export type {
  TargetPlanAssuranceAdvanceResultV2WithHistory,
};
