import { AIProvider } from "@/src/services/settings";

export type AgentId =
  | "overview"
  | "stats"
  | "tactical"
  | "prediction"
  | "general"
  | "planner_template"
  | "planner_autonomous"
  | "tag"
  | "summary"
  | "odds"
  | "animation";

export interface AgentModelConfigEntry {
  provider: AIProvider;
  model: string;
}

export const ALL_AGENT_IDS: AgentId[] = [
  "overview",
  "stats",
  "tactical",
  "prediction",
  "general",
  "planner_template",
  "planner_autonomous",
  "tag",
  "summary",
  "odds",
  "animation",
];

// Edit this file to assign model/provider per agent when settings.agentModelMode is "config".
// Supported providers: "gemini", "deepseek", "openai_compatible".
export const AGENT_MODEL_CONFIG: Partial<Record<AgentId, AgentModelConfigEntry>> = {
  overview: { provider: "gemini", model: "gemini-3-flash-preview" },
  stats: { provider: "gemini", model: "gemini-3-flash-preview" },
  tactical: { provider: "gemini", model: "gemini-3-flash-preview" },
  prediction: { provider: "gemini", model: "gemini-3-flash-preview" },
  general: { provider: "gemini", model: "gemini-3-flash-preview" },
  planner_template: { provider: "gemini", model: "gemini-3-flash-preview" },
  planner_autonomous: { provider: "gemini", model: "gemini-3-flash-preview" },
  tag: { provider: "gemini", model: "gemini-3-flash-preview" },
  summary: { provider: "gemini", model: "gemini-3-flash-preview" },
  odds: { provider: "gemini", model: "gemini-3-flash-preview" },
  animation: { provider: "gemini", model: "gemini-3-flash-preview" },
};
