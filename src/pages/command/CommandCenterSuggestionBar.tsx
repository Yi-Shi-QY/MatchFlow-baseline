import React from 'react';
import { Button } from '@/src/components/ui/Button';
import { translateText } from '@/src/i18n/translate';
import type { CommandCenterSuggestionChip } from './homeLayoutModel';

interface CommandCenterSuggestionBarProps {
  language: 'zh' | 'en';
  chips: CommandCenterSuggestionChip[];
  onSelect: (chip: CommandCenterSuggestionChip) => void;
}

function tr(language: 'zh' | 'en', key: string, zh: string, en: string) {
  return translateText(language, key, language === 'zh' ? zh : en);
}

export function CommandCenterSuggestionBar({
  language,
  chips,
  onSelect,
}: CommandCenterSuggestionBarProps) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
        {tr(language, 'command_center.sections.suggestions', '建议操作', 'Suggestions')}
      </div>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <Button
            key={chip.id}
            type="button"
            variant="secondary"
            size="sm"
            className="h-auto rounded-full px-3 py-2 text-left text-xs leading-5"
            onClick={() => onSelect(chip)}
          >
            {chip.label}
          </Button>
        ))}
      </div>
    </section>
  );
}
