import { getAnalysisDomainById } from "../registry";
import { getPlanningStrategyByDomainId } from "./registry";

type TemplateCompatibilityOptions = {
  domainTemplateIds?: Set<string>;
  allowUnscopedFallback?: boolean;
};

function normalizeTemplateId(templateId: unknown): string {
  if (typeof templateId !== "string") return "";
  return templateId.trim();
}

function normalizeDomainId(domainId: unknown): string {
  if (typeof domainId !== "string") return "";
  return domainId.trim();
}

export function extractScopedPrefix(value: string): string | null {
  const index = value.indexOf("_");
  if (index <= 0) return null;
  const prefix = value.slice(0, index).trim();
  return prefix.length > 0 ? prefix : null;
}

export function resolveDomainTemplateIds(domainId: string): Set<string> {
  const domain = getAnalysisDomainById(domainId);
  const templateIds = Array.isArray(domain?.resources?.templates)
    ? domain.resources.templates
        .map((id) => normalizeTemplateId(id))
        .filter((id) => id.length > 0)
    : [];
  return new Set(templateIds);
}

export function isTemplateCompatibleWithDomain(
  templateId: string,
  domainId: string,
  options: TemplateCompatibilityOptions = {},
): boolean {
  const normalizedTemplateId = normalizeTemplateId(templateId);
  const normalizedDomainId = normalizeDomainId(domainId);
  if (!normalizedTemplateId || !normalizedDomainId) return false;

  const domainTemplateIds =
    options.domainTemplateIds instanceof Set
      ? options.domainTemplateIds
      : resolveDomainTemplateIds(normalizedDomainId);
  const allowUnscopedFallback = options.allowUnscopedFallback !== false;

  if (domainTemplateIds.has(normalizedTemplateId)) {
    return true;
  }

  const prefix = extractScopedPrefix(normalizedTemplateId);
  if (prefix && prefix === normalizedDomainId) {
    return true;
  }

  if (domainTemplateIds.size > 0) {
    return false;
  }

  if (!prefix) {
    return allowUnscopedFallback;
  }

  const strategy = getPlanningStrategyByDomainId(prefix);
  if (!strategy) {
    return allowUnscopedFallback;
  }

  return false;
}

export function scopeTemplateIdsByDomain(
  templateIds: string[],
  domainId: string,
  options: TemplateCompatibilityOptions = {},
): string[] {
  if (!Array.isArray(templateIds) || templateIds.length === 0) {
    return [];
  }

  const normalizedDomainId = normalizeDomainId(domainId);
  if (!normalizedDomainId) return [];

  const domainTemplateIds =
    options.domainTemplateIds instanceof Set
      ? options.domainTemplateIds
      : resolveDomainTemplateIds(normalizedDomainId);

  return templateIds.filter((templateId) =>
    isTemplateCompatibleWithDomain(templateId, normalizedDomainId, {
      domainTemplateIds,
      allowUnscopedFallback: options.allowUnscopedFallback,
    }),
  );
}
