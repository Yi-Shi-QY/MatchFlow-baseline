export interface AnalysisTeamPayload {
  id?: string;
  name?: string;
  logo?: string;
  form?: string[];
  [key: string]: unknown;
}

export interface AnalysisSourceContextPayload {
  origin?: string;
  domainId?: string;
  selectedSources?: Record<string, boolean>;
  selectedSourceIds?: string[];
  capabilities?: Record<string, unknown>;
  planning?: Record<string, unknown>;
  matchStatus?: string;
  [key: string]: unknown;
}

export type MultimodalPartType = "text" | "image" | "audio" | "video" | "file";

export interface MultimodalInputPart {
  type: MultimodalPartType;
  text?: string;
  url?: string;
  base64?: string;
  mimeType?: string;
  extractedText?: string;
  name?: string;
}

export interface MultimodalInputPayload {
  parts: MultimodalInputPart[];
}

export interface AnalysisRequestPayload {
  id?: string;
  league?: string;
  status?: string;
  date?: string;
  homeTeam?: AnalysisTeamPayload;
  awayTeam?: AnalysisTeamPayload;
  stats?: Record<string, unknown>;
  odds?: Record<string, unknown>;
  customInfo?: unknown;
  multimodalInput?: MultimodalInputPayload;
  sourceContext?: AnalysisSourceContextPayload;
  [key: string]: unknown;
}

export interface NormalizedPlanSegment {
  title?: string;
  focus?: string;
  animationType: string;
  agentType: string;
  contextMode?: string;
  sourceIds?: string[];
  [key: string]: unknown;
}

export type AnalysisOutputBlockType =
  | "text"
  | "table"
  | "chart"
  | "image"
  | "reference";

export interface AnalysisOutputBlock {
  type: AnalysisOutputBlockType;
  title?: string;
  content?: string;
  data?: Record<string, unknown>;
}

export interface AnalysisOutputEnvelope {
  summaryMarkdown: string;
  blocks: AnalysisOutputBlock[];
  rawProviderPayload?: unknown;
}
