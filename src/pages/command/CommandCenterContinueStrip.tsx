import React from 'react';
import { Button } from '@/src/components/ui/Button';
import { translateText } from '@/src/i18n/translate';
import type {
  CommandCenterContinueAction,
  CommandCenterContinueCard,
} from './homeLayoutModel';

interface CommandCenterContinueStripProps {
  language: 'zh' | 'en';
  cards: CommandCenterContinueCard[];
  onAction: (action: CommandCenterContinueAction) => void;
}

function tr(language: 'zh' | 'en', key: string, zh: string, en: string) {
  return translateText(language, key, language === 'zh' ? zh : en);
}

export function CommandCenterContinueStrip({
  language,
  cards,
  onAction,
}: CommandCenterContinueStripProps) {
  if (cards.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <div className="text-[11px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
        {tr(language, 'command_center.sections.continue', '继续区', 'Continue')}
      </div>

      <div className="flex snap-x gap-3 overflow-x-auto pb-1">
        {cards.map((card) => (
          <article
            key={card.id}
            className="min-w-[15.5rem] snap-start rounded-[1.5rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/92 p-4 shadow-sm"
          >
            <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--mf-text-muted)]">
              {card.eyebrow}
            </div>
            <div className="mt-2 text-sm font-semibold text-[var(--mf-text)]">{card.title}</div>
            {card.chips && card.chips.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {card.chips.map((chip) => (
                  <span
                    key={`${card.id}:${chip}`}
                    className="rounded-full border border-[var(--mf-border)] bg-[var(--mf-surface-2)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--mf-text-muted)]"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="mt-2 text-xs leading-5 text-[var(--mf-text-muted)]">{card.description}</p>
            <Button
              size="sm"
              className="mt-4 w-full rounded-2xl"
              onClick={() => onAction(card.action)}
            >
              {card.primaryActionLabel}
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}
