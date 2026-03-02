import { APP_VERSION, isMinAppVersionSatisfied } from "@/src/services/appMeta";
import { getSettings } from "@/src/services/settings";
import type { HubEndpointHint } from "@/src/services/extensions/types";
import type { DomainPackManifest } from "./packTypes";
import { saveInstalledDomainPackManifest } from "./packStore";
import {
  sanitizeDomainPackManifest,
  validateDomainPackManifest,
} from "./packValidation";

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

function ensureMinAppVersionCompatible(id: string, minAppVersion?: string): boolean {
  if (!minAppVersion) return true;
  if (!isMinAppVersionSatisfied(minAppVersion)) {
    console.warn(
      `Domain pack requires minAppVersion ${minAppVersion}, current app version is ${APP_VERSION}`,
      id,
    );
    return false;
  }
  return true;
}

async function fetchDomainPackManifest(
  id: string,
  hint?: HubEndpointHint,
): Promise<{ manifest: any; sourceUrl: string } | null> {
  const resolved = resolveHubConfig(hint);
  if (!resolved || !resolved.autoInstall) return null;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (resolved.apiKey) {
    headers.Authorization = `Bearer ${resolved.apiKey}`;
  }

  const paths = [
    `/hub/domains/${id}`,
    `/hub/domain/${id}`,
    `/domains/${id}`,
    `/extensions/domains/${id}`,
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
      // try next endpoint
    }
  }

  return null;
}

export async function installDomainPackFromHub(
  id: string,
  hint?: HubEndpointHint,
): Promise<DomainPackManifest | null> {
  const downloaded = await fetchDomainPackManifest(id, hint);
  if (!downloaded) return null;

  const validation = validateDomainPackManifest(downloaded.manifest);
  if (!validation.ok) {
    console.warn("Invalid domain pack manifest", id, validation.errors);
    return null;
  }

  const manifest = sanitizeDomainPackManifest(downloaded.manifest);
  if (manifest.id !== id) {
    console.warn("Domain pack manifest id mismatch", {
      requested: id,
      returned: manifest.id,
    });
    return null;
  }
  if (!ensureMinAppVersionCompatible(id, manifest.minAppVersion)) {
    return null;
  }

  saveInstalledDomainPackManifest(manifest, downloaded.sourceUrl);
  return manifest;
}
