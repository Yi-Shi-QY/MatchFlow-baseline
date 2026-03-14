import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Download,
  Loader2,
  Package,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent } from "@/src/components/ui/Card";
import { Select } from "@/src/components/ui/Select";
import { getSettings } from "@/src/services/settings";
import { useWorkspaceNavigation } from "@/src/services/navigation/useWorkspaceNavigation";
import { installAgentFromHub, installSkillFromHub, installTemplateFromHub } from "@/src/services/extensions/hub";
import {
  clearExtensionStore,
  getInstalledAgentManifest,
  getInstalledSkillManifest,
  getInstalledTemplateManifest,
  listInstalledExtensionRecords,
  removeInstalledExtension,
} from "@/src/services/extensions/store";
import { ExtensionKind } from "@/src/services/extensions/types";
import {
  compareSemver,
  validateAgentManifest,
  validateSkillManifest,
  validateTemplateManifest,
} from "@/src/services/extensions/validation";
import { installDomainPackFromHub } from "@/src/services/domains/packHub";
import {
  clearInstalledDomainPacks,
  listInstalledDomainPackRecords,
  removeInstalledDomainPackManifest,
} from "@/src/services/domains/packStore";

type HubStatus = "idle" | "success" | "error" | "loading";

interface ExtensionViewRecord {
  kind: ExtensionKind;
  id: string;
  version: string;
  name: string;
  description: string;
  installedAt: number;
  sourceUrl?: string;
  valid: boolean;
  validationErrors: string[];
}

interface DomainPackViewRecord {
  id: string;
  version: string;
  name: string;
  description: string;
  baseDomainId?: string;
  installedAt: number;
  sourceUrl?: string;
}

function extensionKindLabel(kind: ExtensionKind, t: (key: string) => string) {
  if (kind === "agent") return t("extensions.kind_agent");
  if (kind === "skill") return t("extensions.kind_skill");
  return t("extensions.kind_template");
}

function validateRecord(kind: ExtensionKind, manifest: any): { valid: boolean; validationErrors: string[] } {
  if (kind === "agent") {
    const result = validateAgentManifest(manifest);
    return { valid: result.ok, validationErrors: result.errors };
  }
  if (kind === "skill") {
    const result = validateSkillManifest(manifest);
    return { valid: result.ok, validationErrors: result.errors };
  }
  const result = validateTemplateManifest(manifest);
  return { valid: result.ok, validationErrors: result.errors };
}

async function installByKind(
  kind: ExtensionKind,
  id: string,
): Promise<boolean> {
  if (kind === "agent") {
    const installed = await installAgentFromHub(id);
    return !!installed;
  }
  if (kind === "skill") {
    const installed = await installSkillFromHub(id);
    return !!installed;
  }
  const installed = await installTemplateFromHub(id);
  return !!installed;
}

function getInstalledVersion(kind: ExtensionKind, id: string): string | null {
  if (kind === "agent") return getInstalledAgentManifest(id)?.version || null;
  if (kind === "skill") return getInstalledSkillManifest(id)?.version || null;
  return getInstalledTemplateManifest(id)?.version || null;
}

export default function ExtensionsHub() {
  const navigate = useNavigate();
  const { goBack } = useWorkspaceNavigation();
  const { t } = useTranslation();
  const settings = useMemo(() => getSettings(), []);

  const [records, setRecords] = useState<ExtensionViewRecord[]>([]);
  const [domainPacks, setDomainPacks] = useState<DomainPackViewRecord[]>([]);
  const [installKind, setInstallKind] = useState<ExtensionKind>("template");
  const [installId, setInstallId] = useState("");
  const [domainPackId, setDomainPackId] = useState("");
  const [status, setStatus] = useState<HubStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [isInstalling, setIsInstalling] = useState(false);
  const [isInstallingDomainPack, setIsInstallingDomainPack] = useState(false);
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);

  const refreshRecords = React.useCallback(() => {
    const list = listInstalledExtensionRecords().map((record) => {
      const validation = validateRecord(record.kind, record.manifest);
      return {
        kind: record.kind,
        id: record.id,
        version: record.version,
        name: record.name,
        description: record.description,
        installedAt: record.installedAt,
        sourceUrl: record.sourceUrl,
        valid: validation.valid,
        validationErrors: validation.validationErrors,
      };
    });
    setRecords(list);
  }, []);

  const refreshDomainPacks = React.useCallback(() => {
    const list = listInstalledDomainPackRecords().map((record) => ({
      id: record.manifest.id,
      version: record.manifest.version,
      name: record.manifest.name,
      description: record.manifest.description,
      baseDomainId: record.manifest.baseDomainId,
      installedAt: record.installedAt,
      sourceUrl: record.sourceUrl,
    }));
    setDomainPacks(list);
  }, []);

  useEffect(() => {
    refreshRecords();
    refreshDomainPacks();
  }, [refreshRecords, refreshDomainPacks]);

  const installOne = async () => {
    const id = installId.trim();
    if (!id) {
      setStatus("error");
      setStatusMessage(t("extensions.enter_id"));
      return;
    }

    setIsInstalling(true);
    setStatus("loading");
    setStatusMessage(t("extensions.installing"));
    try {
      const ok = await installByKind(installKind, id);
      if (!ok) {
        setStatus("error");
        setStatusMessage(t("extensions.install_failed"));
      } else {
        refreshRecords();
        setStatus("success");
        setStatusMessage(t("extensions.install_success"));
      }
    } catch (error: any) {
      setStatus("error");
      setStatusMessage(`${t("extensions.install_failed")}: ${error?.message || t("extensions.unknown_error")}`);
    } finally {
      setIsInstalling(false);
    }
  };

  const updateOne = async (kind: ExtensionKind, id: string) => {
    setStatus("loading");
    setStatusMessage(t("extensions.updating"));
    try {
      const beforeVersion = getInstalledVersion(kind, id);
      const ok = await installByKind(kind, id);
      refreshRecords();

      if (!ok) {
        setStatus("error");
        setStatusMessage(t("extensions.update_failed"));
        return;
      }

      const afterVersion = getInstalledVersion(kind, id);
      if (
        beforeVersion &&
        afterVersion &&
        compareSemver(afterVersion, beforeVersion) > 0
      ) {
        setStatus("success");
        setStatusMessage(t("extensions.update_success"));
      } else {
        setStatus("success");
        setStatusMessage(t("extensions.no_update"));
      }
    } catch (error: any) {
      setStatus("error");
      setStatusMessage(`${t("extensions.update_failed")}: ${error?.message || t("extensions.unknown_error")}`);
    }
  };

  const updateAll = async () => {
    if (records.length === 0) return;

    setIsUpdatingAll(true);
    setStatus("loading");
    setStatusMessage(t("extensions.updating_all"));
    try {
      let updatedCount = 0;
      let failedCount = 0;

      for (const record of records) {
        const beforeVersion = getInstalledVersion(record.kind, record.id);
        const ok = await installByKind(record.kind, record.id);
        const afterVersion = getInstalledVersion(record.kind, record.id);

        if (!ok) {
          failedCount += 1;
          continue;
        }

        if (
          beforeVersion &&
          afterVersion &&
          compareSemver(afterVersion, beforeVersion) > 0
        ) {
          updatedCount += 1;
        }
      }

      refreshRecords();
      if (failedCount > 0) {
        setStatus("error");
        setStatusMessage(
          t("extensions.update_all_partial", {
            updated: updatedCount,
            failed: failedCount,
          }),
        );
      } else if (updatedCount > 0) {
        setStatus("success");
        setStatusMessage(t("extensions.update_all_success", { updated: updatedCount }));
      } else {
        setStatus("success");
        setStatusMessage(t("extensions.no_update"));
      }
    } catch (error: any) {
      setStatus("error");
      setStatusMessage(`${t("extensions.update_failed")}: ${error?.message || t("extensions.unknown_error")}`);
    } finally {
      setIsUpdatingAll(false);
    }
  };

  const uninstallOne = (kind: ExtensionKind, id: string) => {
    const confirmed = window.confirm(t("extensions.confirm_uninstall", { id }));
    if (!confirmed) return;

    const removed = removeInstalledExtension(kind, id);
    if (removed) {
      refreshRecords();
      setStatus("success");
      setStatusMessage(t("extensions.uninstall_success"));
    }
  };

  const clearAll = () => {
    const confirmed = window.confirm(t("extensions.confirm_clear_all"));
    if (!confirmed) return;
    clearExtensionStore();
    refreshRecords();
    setStatus("success");
    setStatusMessage(t("extensions.clear_success"));
  };

  const installDomainPack = async () => {
    const id = domainPackId.trim();
    if (!id) {
      setStatus("error");
      setStatusMessage(t("extensions.enter_domain_pack_id"));
      return;
    }

    setIsInstallingDomainPack(true);
    setStatus("loading");
    setStatusMessage(t("extensions.installing_domain_pack"));
    try {
      const installed = await installDomainPackFromHub(id);
      if (!installed) {
        setStatus("error");
        setStatusMessage(t("extensions.install_domain_pack_failed"));
        return;
      }
      refreshDomainPacks();
      setStatus("success");
      setStatusMessage(t("extensions.install_domain_pack_success"));
    } catch (error: any) {
      setStatus("error");
      setStatusMessage(
        `${t("extensions.install_domain_pack_failed")}: ${error?.message || t("extensions.unknown_error")}`,
      );
    } finally {
      setIsInstallingDomainPack(false);
    }
  };

  const updateDomainPack = async (id: string) => {
    setStatus("loading");
    setStatusMessage(t("extensions.updating_domain_pack"));
    try {
      const before = domainPacks.find((record) => record.id === id)?.version || null;
      const installed = await installDomainPackFromHub(id);
      refreshDomainPacks();
      if (!installed) {
        setStatus("error");
        setStatusMessage(t("extensions.update_domain_pack_failed"));
        return;
      }
      const after =
        listInstalledDomainPackRecords().find((record) => record.manifest.id === id)?.manifest
          .version || null;
      if (before && after && compareSemver(after, before) > 0) {
        setStatus("success");
        setStatusMessage(t("extensions.update_success"));
      } else {
        setStatus("success");
        setStatusMessage(t("extensions.no_update"));
      }
    } catch (error: any) {
      setStatus("error");
      setStatusMessage(
        `${t("extensions.update_domain_pack_failed")}: ${error?.message || t("extensions.unknown_error")}`,
      );
    }
  };

  const uninstallDomainPack = (id: string) => {
    const confirmed = window.confirm(t("extensions.confirm_uninstall_domain_pack", { id }));
    if (!confirmed) return;
    const removed = removeInstalledDomainPackManifest(id);
    if (removed) {
      refreshDomainPacks();
      setStatus("success");
      setStatusMessage(t("extensions.uninstall_domain_pack_success"));
    }
  };

  const clearAllDomainPacks = () => {
    const confirmed = window.confirm(t("extensions.confirm_clear_all_domain_packs"));
    if (!confirmed) return;
    clearInstalledDomainPacks();
    refreshDomainPacks();
    setStatus("success");
    setStatusMessage(t("extensions.clear_domain_pack_success"));
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans flex flex-col pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-white/10 px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void goBack("/settings/diagnostics")}
            className="h-8 w-8 rounded-full bg-zinc-900 border border-white/10"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-500" /> {t("extensions.title")}
            </h1>
            <p className="mt-1 text-[11px] text-zinc-500">{t("extensions.subtitle")}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4">
        <Card className="border-zinc-800 bg-zinc-950">
          <CardContent className="p-4 space-y-3">
            <div className="text-xs text-zinc-500">
              {t("extensions.hub_endpoint")}:{" "}
              <span className="text-zinc-300 break-all">
                {settings.matchDataServerUrl || t("extensions.not_configured")}
              </span>
            </div>
            <div className="text-[11px] text-zinc-500">
              {t("extensions.hub_hint")}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                {t("extensions.install_kind")}
              </label>
              <Select
                value={installKind}
                onChange={(value) => setInstallKind(value as ExtensionKind)}
                options={[
                  { value: "template", label: t("extensions.kind_template") },
                  { value: "agent", label: t("extensions.kind_agent") },
                  { value: "skill", label: t("extensions.kind_skill") },
                ]}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                {t("extensions.install_id")}
              </label>
              <input
                type="text"
                value={installId}
                onChange={(e) => setInstallId(e.target.value)}
                placeholder={t("extensions.install_id_placeholder")}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={installOne} className="flex-1 gap-2" disabled={isInstalling}>
                {isInstalling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {t("extensions.install")}
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2 border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
                onClick={updateAll}
                disabled={isUpdatingAll || records.length === 0}
              >
                {isUpdatingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {t("extensions.update_all")}
              </Button>
            </div>

            <Button
              variant="outline"
              className="w-full gap-2 border-red-500/40 text-red-400 hover:bg-red-500/10"
              onClick={clearAll}
              disabled={records.length === 0}
            >
              <Trash2 className="w-4 h-4" />
              {t("extensions.clear_all")}
            </Button>

            {status !== "idle" && (
              <div
                className={`text-xs p-3 rounded-lg border ${
                  status === "success"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : status === "error"
                      ? "bg-red-500/10 border-red-500/20 text-red-400"
                      : "bg-zinc-900 border-zinc-700 text-zinc-400"
                }`}
              >
                {statusMessage}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950">
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-bold text-white">
              {t("extensions.installed_title")} ({records.length})
            </h2>

            {records.length === 0 && (
              <div className="text-xs text-zinc-500">{t("extensions.empty")}</div>
            )}

            {records.map((record) => (
              <div key={`${record.kind}:${record.id}`} className="border border-white/10 rounded-lg p-3 bg-zinc-900/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-300 font-medium truncate">{record.name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono truncate">
                      {record.kind}:{record.id} @ {record.version}
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 shrink-0">
                    {extensionKindLabel(record.kind, t)}
                  </span>
                </div>

                <div className="text-[11px] text-zinc-400">{record.description}</div>

                <div className="flex items-center justify-between text-[10px] text-zinc-500">
                  <span>
                    {t("extensions.installed_at")}:{" "}
                    {new Date(record.installedAt).toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    {record.valid ? (
                      <>
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        {t("extensions.validation_ok")}
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3 h-3 text-red-400" />
                        {t("extensions.validation_failed")}
                      </>
                    )}
                  </span>
                </div>

                {!record.valid && record.validationErrors.length > 0 && (
                  <div className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded p-2">
                    {record.validationErrors.join("; ")}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-8 text-xs border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
                    onClick={() => updateOne(record.kind, record.id)}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    {t("extensions.update")}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-8 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10"
                    onClick={() => uninstallOne(record.kind, record.id)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    {t("extensions.uninstall")}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950">
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-bold text-white">
              {t("extensions.domain_pack_title")} ({domainPacks.length})
            </h2>
            <div className="text-[11px] text-zinc-500">
              {t("extensions.domain_pack_desc")}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                {t("extensions.domain_pack_id")}
              </label>
              <input
                type="text"
                value={domainPackId}
                onChange={(e) => setDomainPackId(e.target.value)}
                placeholder={t("extensions.domain_pack_id_placeholder")}
                className="w-full bg-zinc-900 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={installDomainPack}
                className="flex-1 gap-2"
                disabled={isInstallingDomainPack}
              >
                {isInstallingDomainPack ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {t("extensions.install_domain_pack")}
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2 border-red-500/40 text-red-400 hover:bg-red-500/10"
                onClick={clearAllDomainPacks}
                disabled={domainPacks.length === 0}
              >
                <Trash2 className="w-4 h-4" />
                {t("extensions.clear_all_domain_packs")}
              </Button>
            </div>

            {domainPacks.length === 0 && (
              <div className="text-xs text-zinc-500">{t("extensions.domain_pack_empty")}</div>
            )}

            {domainPacks.map((pack) => (
              <div key={`domain_pack:${pack.id}`} className="border border-white/10 rounded-lg p-3 bg-zinc-900/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-300 font-medium truncate">{pack.name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono truncate">
                      domain_pack:{pack.id} @ {pack.version}
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 shrink-0">
                    {t("extensions.kind_domain_pack")}
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400">{pack.description}</div>
                <div className="text-[10px] text-zinc-500">
                  {t("extensions.base_domain")}:{" "}
                  <span className="text-zinc-300">{pack.baseDomainId || "football"}</span>
                </div>
                <div className="text-[10px] text-zinc-500">
                  {t("extensions.installed_at")}: {new Date(pack.installedAt).toLocaleString()}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1 h-8 text-xs border-zinc-700 bg-zinc-900 hover:bg-zinc-800"
                    onClick={() => updateDomainPack(pack.id)}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    {t("extensions.update")}
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 h-8 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10"
                    onClick={() => uninstallDomainPack(pack.id)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    {t("extensions.uninstall")}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

