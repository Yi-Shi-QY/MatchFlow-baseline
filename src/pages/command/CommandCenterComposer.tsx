import React from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';

interface CommandCenterComposerProps {
  language: 'zh' | 'en';
  commandText: string;
  isSubmitting: boolean;
  onCommandTextChange: (value: string) => void;
  onSubmit: () => void;
}

export function CommandCenterComposer({
  language,
  commandText,
  isSubmitting,
  onCommandTextChange,
  onSubmit,
}: CommandCenterComposerProps) {
  const copy =
    language === 'zh'
      ? {
          placeholder: '直接问今天有哪些比赛，或者说今晚几点分析哪场比赛。',
          send: '发送',
        }
      : {
          placeholder: 'Ask what matches are on today, or tell me which match to analyze and when.',
          send: 'Send',
        };

  return (
    <section className="sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 mt-auto pt-3">
      <div className="rounded-[1.75rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/94 p-3 shadow-xl backdrop-blur-xl">
        <div className="rounded-[1.5rem] border border-[var(--mf-border)] bg-[var(--mf-surface-strong)] p-3">
          <textarea
            value={commandText}
            onChange={(event) => onCommandTextChange(event.target.value)}
            placeholder={copy.placeholder}
            rows={3}
            className="w-full resize-none bg-transparent text-sm leading-relaxed text-[var(--mf-text)] focus:outline-none"
          />
          <div className="mt-3 flex justify-end">
            <Button
              onClick={onSubmit}
              className="gap-2 rounded-2xl px-4"
              disabled={isSubmitting}
            >
              <Send className="h-4 w-4" />
              {copy.send}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
