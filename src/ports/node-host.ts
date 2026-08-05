import type {
  AdvanceHistoryBaselineCapture,
  AdvanceHistoryBaselineDependencies,
  AdvanceHistoryBaselineRecheck,
  AdvanceHistoryBaselineRequest,
  GitHistoryProbeDependencies,
  GitHistoryProbeOutcome,
  GitHistoryProbeRequest,
} from "../history/git-probe.js";
import type {
  CreateArtifactOptions,
  CreateDocumentFromSourceOptions,
  CreateDocumentOptions,
  DocumentCandidateValidator,
  DocumentWriteResult,
  ReplaceDocumentOptions,
} from "../io/safe-write.js";

export const NODE_HOST_PORT_MODEL_VERSION = 1 as const;

export type Sha256Digest = `sha256:${string}`;

export interface DigestPort {
  readonly sha256Bytes: (bytes: Uint8Array) => Sha256Digest;
  readonly sha256Utf8: (text: string) => Sha256Digest;
}

export interface DocumentByteSourcePort {
  readonly read: (path: string) => Promise<Uint8Array>;
}

export interface BundledArtifactSourcePort {
  readonly read: (location: URL) => Uint8Array;
}

export interface GitEvidencePort {
  readonly probeHistory: (
    request: GitHistoryProbeRequest,
    dependencies?: GitHistoryProbeDependencies,
  ) => Promise<GitHistoryProbeOutcome>;
  readonly captureAdvanceBaseline: (
    request: AdvanceHistoryBaselineRequest,
    dependencies?: AdvanceHistoryBaselineDependencies,
  ) => Promise<AdvanceHistoryBaselineCapture>;
  readonly recheckAdvanceBaseline: (
    baseline: AdvanceHistoryBaselineCapture,
    targetPath: string,
    dependencies?: AdvanceHistoryBaselineDependencies,
  ) => Promise<AdvanceHistoryBaselineRecheck>;
}

export interface SafePersistencePort {
  readonly replaceValidatedDocument: (
    target: string,
    candidateText: string,
    options: ReplaceDocumentOptions,
    validator: DocumentCandidateValidator,
  ) => Promise<DocumentWriteResult>;
  readonly createValidatedDocument: (
    target: string,
    candidateText: string,
    validator: DocumentCandidateValidator,
    options?: CreateDocumentOptions,
  ) => Promise<DocumentWriteResult>;
  readonly createValidatedDocumentFromSource: (
    source: string,
    target: string,
    candidateText: string,
    validator: DocumentCandidateValidator,
    options: CreateDocumentFromSourceOptions,
  ) => Promise<DocumentWriteResult>;
  readonly createArtifact: (
    target: string,
    artifact: string,
    options?: CreateArtifactOptions,
  ) => Promise<DocumentWriteResult>;
}

export interface ProcessContextPort {
  readonly cwd: () => string;
  readonly pid: () => number;
  readonly platform: () => string;
  readonly umask: () => number;
}

export interface NodeHostPorts {
  readonly modelVersion: typeof NODE_HOST_PORT_MODEL_VERSION;
  readonly digest: DigestPort;
  readonly documentBytes: DocumentByteSourcePort;
  readonly bundledArtifacts: BundledArtifactSourcePort;
  readonly gitEvidence: GitEvidencePort;
  readonly safePersistence: SafePersistencePort;
  readonly processContext: ProcessContextPort;
}
