import { normalizeObject } from './storageFallback';
import type {
  AutomationFixedSubjectSelector,
  AutomationLeagueQuerySelector,
  AutomationServerResolveSelector,
  AutomationTargetSelector,
} from './types';

export type AutomationTargetSelectorKind = 'subject' | 'collection' | 'query';

function normalizeLabel(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeKey(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function isAutomationSubjectTargetSelector(
  selector: AutomationTargetSelector | null | undefined,
): selector is AutomationFixedSubjectSelector {
  return Boolean(selector && selector.mode === 'fixed_subject');
}

export function isAutomationCollectionTargetSelector(
  selector: AutomationTargetSelector | null | undefined,
): selector is AutomationLeagueQuerySelector {
  return Boolean(selector && selector.mode === 'league_query');
}

export function isAutomationResolvableTargetSelector(
  selector: AutomationTargetSelector | null | undefined,
): selector is AutomationServerResolveSelector {
  return Boolean(selector && selector.mode === 'server_resolve');
}

export function getAutomationTargetSelectorKind(
  selector: AutomationTargetSelector | null | undefined,
): AutomationTargetSelectorKind | null {
  if (isAutomationSubjectTargetSelector(selector)) {
    return 'subject';
  }

  if (isAutomationCollectionTargetSelector(selector)) {
    return 'collection';
  }

  if (isAutomationResolvableTargetSelector(selector)) {
    return 'query';
  }

  return null;
}

export function normalizeAutomationTargetSelectorRecord(
  input: unknown,
): AutomationTargetSelector | undefined {
  const value = normalizeObject<Record<string, unknown>>(input);
  if (!value || typeof value.mode !== 'string') {
    return undefined;
  }

  if (
    value.mode === 'fixed_subject' &&
    typeof value.subjectId === 'string' &&
    typeof value.subjectLabel === 'string'
  ) {
    return {
      mode: 'fixed_subject',
      subjectId: value.subjectId,
      subjectLabel: value.subjectLabel,
    };
  }

  if (
    value.mode === 'league_query' &&
    typeof value.leagueKey === 'string' &&
    typeof value.leagueLabel === 'string'
  ) {
    return {
      mode: 'league_query',
      leagueKey: value.leagueKey,
      leagueLabel: value.leagueLabel,
    };
  }

  if (
    value.mode === 'server_resolve' &&
    typeof value.queryText === 'string' &&
    typeof value.displayLabel === 'string'
  ) {
    return {
      mode: 'server_resolve',
      queryText: value.queryText,
      displayLabel: value.displayLabel,
    };
  }

  return undefined;
}

export function getAutomationTargetSelectorLabel(
  selector: AutomationTargetSelector | null | undefined,
): string | null {
  if (isAutomationSubjectTargetSelector(selector)) {
    return normalizeLabel(selector.subjectLabel);
  }

  if (isAutomationCollectionTargetSelector(selector)) {
    return normalizeLabel(selector.leagueLabel);
  }

  if (!selector) {
    return null;
  }

  return normalizeLabel(selector.displayLabel);
}

export function getAutomationTargetSelectorSubjectId(
  selector: AutomationTargetSelector | null | undefined,
): string | null {
  if (!isAutomationSubjectTargetSelector(selector)) {
    return null;
  }

  return normalizeKey(selector.subjectId);
}

export function getAutomationTargetSelectorCollectionKey(
  selector: AutomationTargetSelector | null | undefined,
): string | null {
  if (!isAutomationCollectionTargetSelector(selector)) {
    return null;
  }

  const leagueKey = normalizeKey(selector.leagueKey);
  return leagueKey ? `league_query:${leagueKey}` : null;
}

export function getAutomationTargetSelectorLabelOrFallback(input: {
  selector: AutomationTargetSelector | null | undefined;
  fallback: string;
}): string {
  return getAutomationTargetSelectorLabel(input.selector) || input.fallback.trim();
}

export function buildAutomationTargetTitle(
  selector: AutomationTargetSelector | null | undefined,
  sourceText: string,
): string {
  return getAutomationTargetSelectorLabelOrFallback({
    selector,
    fallback: sourceText,
  });
}
