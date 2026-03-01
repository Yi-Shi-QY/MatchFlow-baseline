import { getSettings } from "../settings";
import {
  AgentExtensionManifest,
  HubEndpointHint,
  SkillExtensionManifest,
  TemplateExtensionManifest,
} from "./types";
import {
  sanitizeAgentManifest,
  sanitizeSkillManifest,
  sanitizeTemplateManifest,
  validateAgentManifest,
  validateSkillManifest,
  validateTemplateManifest,
} from "./validation";
import {
  saveInstalledAgentManifest,
  saveInstalledSkillManifest,
  saveInstalledTemplateManifest,
} from "./store";

interface ResolvedHubConfig {
  baseUrl: string;
  apiKey: string;
  autoInstall: boolean;
}

function resolveHubConfig(hint?: HubEndpointHint): ResolvedHubConfig | null {
  const settings = getSettings();
  const baseUrl = String(hint?.baseUrl || settings.matchDataServerUrl || "").trim();
  if (!baseUrl) return null;

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey: String(hint?.apiKey || settings.matchDataApiKey || "").trim(),
    autoInstall: hint?.autoInstall !== false,
  };
}

async function fetchManifestFromHub(
  kind: "agent" | "skill" | "template",
  id: string,
  hint?: HubEndpointHint,
): Promise<{ manifest: any; sourceUrl: string } | null> {
  const resolved = resolveHubConfig(hint);
  if (!resolved || !resolved.autoInstall) {
    return null;
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (resolved.apiKey) {
    headers.Authorization = `Bearer ${resolved.apiKey}`;
  }

  const paths = [
    `/hub/${kind}s/${id}`,
    `/hub/${kind}/${id}`,
    `/extensions/${kind}s/${id}`,
    `/extensions/${kind}/${id}`,
  ];

  for (const path of paths) {
    const url = `${resolved.baseUrl}${path}`;
    try {
      const response = await fetch(url, { method: "GET", headers });
      if (!response.ok) continue;
      const json = await response.json().catch(() => null);
      if (!json) continue;
      const payload = json.data ?? json.manifest ?? json;
      if (payload && typeof payload === "object") {
        return { manifest: payload, sourceUrl: url };
      }
    } catch {
      // try next endpoint pattern
    }
  }

  return null;
}

export async function installAgentFromHub(
  id: string,
  hint?: HubEndpointHint,
): Promise<AgentExtensionManifest | null> {
  const downloaded = await fetchManifestFromHub("agent", id, hint);
  if (!downloaded) return null;

  const validation = validateAgentManifest(downloaded.manifest);
  if (!validation.ok) {
    console.warn("Invalid hub agent manifest", id, validation.errors);
    return null;
  }

  const manifest = sanitizeAgentManifest(downloaded.manifest);
  if (manifest.id !== id) {
    console.warn("Hub agent manifest id mismatch", { requested: id, returned: manifest.id });
    return null;
  }

  saveInstalledAgentManifest(manifest, downloaded.sourceUrl);
  return manifest;
}

export async function installSkillFromHub(
  id: string,
  hint?: HubEndpointHint,
): Promise<SkillExtensionManifest | null> {
  const downloaded = await fetchManifestFromHub("skill", id, hint);
  if (!downloaded) return null;

  const validation = validateSkillManifest(downloaded.manifest);
  if (!validation.ok) {
    console.warn("Invalid hub skill manifest", id, validation.errors);
    return null;
  }

  const manifest = sanitizeSkillManifest(downloaded.manifest);
  if (manifest.id !== id) {
    console.warn("Hub skill manifest id mismatch", { requested: id, returned: manifest.id });
    return null;
  }

  saveInstalledSkillManifest(manifest, downloaded.sourceUrl);
  return manifest;
}

export async function installTemplateFromHub(
  id: string,
  hint?: HubEndpointHint,
): Promise<TemplateExtensionManifest | null> {
  const downloaded = await fetchManifestFromHub("template", id, hint);
  if (!downloaded) return null;

  const validation = validateTemplateManifest(downloaded.manifest);
  if (!validation.ok) {
    console.warn("Invalid hub template manifest", id, validation.errors);
    return null;
  }

  const manifest = sanitizeTemplateManifest(downloaded.manifest);
  if (manifest.id !== id) {
    console.warn("Hub template manifest id mismatch", { requested: id, returned: manifest.id });
    return null;
  }

  saveInstalledTemplateManifest(manifest, downloaded.sourceUrl);
  return manifest;
}

