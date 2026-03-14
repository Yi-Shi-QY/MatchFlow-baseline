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

function hasGeminiConnection(settings: Partial<AppSettings>): boolean {
  if (
    typeof settings?.geminiApiKey === "string" &&
    settings.geminiApiKey.trim().length > 0
  ) {
    return true;
  }

  return Boolean(process.env.GEMINI_API_KEY);
}

function hasDeepSeekConnection(settings: Partial<AppSettings>): boolean {
  return (
    typeof settings?.deepseekApiKey === "string" &&
    settings.deepseekApiKey.trim().length > 0
  );
}

function hasOpenAICompatibleConnection(settings: Partial<AppSettings>): boolean {
  return (
    typeof settings?.openaiCompatibleBaseUrl === "string" &&
    settings.openaiCompatibleBaseUrl.trim().length > 0
  );
}

function isProviderRouteUsable(
  provider: AIProvider,
  settings: Partial<AppSettings>,
): boolean {
  if (provider === "gemini") {
    return hasGeminiConnection(settings);
  }
  if (provider === "deepseek") {
    return hasDeepSeekConnection(settings);
  }
  return hasOpenAICompatibleConnection(settings);
}

export function resolveRuntimeModelRoute(
  settings: Partial<AppSettings>,
  agentId?: string,
): RuntimeModelRoute {
  const fallbackProvider: AIProvider = isProvider(settings?.provider)
    ? settings.provider
    : "gemini";
  const fallbackModel = resolveFallbackModel(fallbackProvider, settings?.model);

  const globalRoute: RuntimeModelRoute = {
    provider: fallbackProvider,
    model: fallbackModel,
    source: "global",
  };

  if (settings?.agentModelMode !== "config") {
    return globalRoute;
  }

  if (!agentId) {
    return {
      provider: globalRoute.provider,
      model: globalRoute.model,
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
    const configuredRoute: RuntimeModelRoute = {
      provider: configured.provider,
      model: configured.model.trim(),
      source: "config",
    };
    if (isProviderRouteUsable(configuredRoute.provider, settings)) {
      return configuredRoute;
    }
  }

  return {
    provider: globalRoute.provider,
    model: globalRoute.model,
    source: "global_fallback",
  };
}
