import { AGENT_MODEL_CONFIG } from "@/src/config/agentModelConfig";
import { AIProvider, AppSettings } from "../settings";

export interface RuntimeModelRoute {
  provider: AIProvider;
  model: string;
  source: "global" | "config" | "global_fallback";
}

function isProvider(value: any): value is AIProvider {
  return value === "gemini" || value === "deepseek" || value === "openai_compatible";
}

function resolveFallbackModel(provider: AIProvider, model: any): string {
  if (typeof model === "string" && model.trim().length > 0) {
    return model.trim();
  }

  if (provider === "deepseek") {
    return "deepseek-chat";
  }
  if (provider === "openai_compatible") {
    return "gpt-4o-mini";
  }
  return "gemini-3-flash-preview";
}

export function resolveRuntimeModelRoute(
  settings: Partial<AppSettings>,
  agentId?: string,
): RuntimeModelRoute {
  const fallbackProvider: AIProvider = isProvider(settings?.provider)
    ? settings.provider
    : "gemini";
  const fallbackModel = resolveFallbackModel(fallbackProvider, settings?.model);

  if (settings?.agentModelMode !== "config") {
    return {
      provider: fallbackProvider,
      model: fallbackModel,
      source: "global",
    };
  }

  if (!agentId) {
    return {
      provider: fallbackProvider,
      model: fallbackModel,
      source: "global_fallback",
    };
  }

  const configured = AGENT_MODEL_CONFIG[agentId as keyof typeof AGENT_MODEL_CONFIG];
  if (
    configured &&
    isProvider(configured.provider) &&
    typeof configured.model === "string" &&
    configured.model.trim().length > 0
  ) {
    return {
      provider: configured.provider,
      model: configured.model.trim(),
      source: "config",
    };
  }

  return {
    provider: fallbackProvider,
    model: fallbackModel,
    source: "global_fallback",
  };
}
