import { parseAutomationCommandViaDomainParsers } from './domainParsers';
import { detectAutomationExecutionTargetScope } from './executionPolicy';
import {
  createAutomationDraft,
  detectAutomationIntentType,
  parseAutomationTime,
  parseMatchupAutomationSelector,
} from './parserCore';
import type { AutomationDraft, AutomationParserOptions } from './types';

export function parseAutomationCommand(
  sourceText: string,
  options: AutomationParserOptions,
): AutomationDraft[] {
  const normalized = sourceText.trim();
  if (!normalized) {
    return [];
  }

  const now = options.now || new Date();
  const parsedByDomain = parseAutomationCommandViaDomainParsers(normalized, {
    ...options,
    now,
  });
  if (parsedByDomain && parsedByDomain.length > 0) {
    return parsedByDomain;
  }

  const intentType = detectAutomationIntentType(normalized);
  const schedule = parseAutomationTime(normalized, intentType, now);
  const matchupSelector = parseMatchupAutomationSelector(normalized);
  const targetScope = detectAutomationExecutionTargetScope(normalized);

  if (matchupSelector) {
    return [
      createAutomationDraft({
        sourceText: normalized,
        intentType,
        domainId: options.defaultDomainId,
        schedule,
        targetSelector: matchupSelector,
        targetScope,
      }),
    ];
  }

  if (/(stocks|stock|美股|股市)/i.test(normalized)) {
    return [
      createAutomationDraft({
        sourceText: normalized,
        intentType,
        domainId: 'stocks',
        schedule,
        targetSelector: {
          mode: 'server_resolve',
          queryText: normalized,
          displayLabel: 'Stocks automation query',
        },
        targetScope,
      }),
    ];
  }

  return [
    createAutomationDraft({
      sourceText: normalized,
      intentType,
      domainId: options.defaultDomainId,
      schedule,
      targetSelector: undefined,
      targetScope,
    }),
  ];
}
