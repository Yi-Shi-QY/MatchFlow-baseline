import { listRuntimeDomainPacks } from '@/src/domains/runtime/registry';
import type { AutomationDraft, AutomationParserOptions } from './types';

interface AutomationDomainParser {
  domainId: string;
  parse(sourceText: string, options: AutomationParserOptions): AutomationDraft[] | null;
}

function listBuiltinAutomationDomainParsers(): AutomationDomainParser[] {
  return listRuntimeDomainPacks()
    .map((runtimePack) => {
      const parse = runtimePack.automation?.parseCommand;
      if (typeof parse !== 'function') {
        return null;
      }

      return {
        domainId: runtimePack.manifest.domainId,
        parse,
      } satisfies AutomationDomainParser;
    })
    .filter((parser): parser is AutomationDomainParser => Boolean(parser));
}

export function listRegisteredAutomationParserDomainIds(): string[] {
  return listBuiltinAutomationDomainParsers().map((parser) => parser.domainId);
}

function compareParserPriority(
  left: AutomationDomainParser,
  right: AutomationDomainParser,
  defaultDomainId: string,
): number {
  const leftPriority = left.domainId === defaultDomainId ? 0 : 1;
  const rightPriority = right.domainId === defaultDomainId ? 0 : 1;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }
  return left.domainId.localeCompare(right.domainId);
}

export function parseAutomationCommandViaDomainParsers(
  sourceText: string,
  options: AutomationParserOptions,
): AutomationDraft[] | null {
  const parsers = listBuiltinAutomationDomainParsers().sort((left, right) =>
    compareParserPriority(left, right, options.defaultDomainId),
  );

  for (const parser of parsers) {
    const drafts = parser.parse(sourceText, options);
    if (Array.isArray(drafts) && drafts.length > 0) {
      return drafts;
    }
  }

  return null;
}
