import React from 'react';
import { LoaderCircle, Send } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { translateText } from '@/src/i18n/translate';

interface CommandCenterComposerProps {
  language: 'zh' | 'en';
  commandText: string;
  placeholder?: string;
  isSubmitting: boolean;
  onCommandTextChange: (value: string) => void;
  onSubmit: () => void;
}

function tr(language: 'zh' | 'en', key: string, zh: string, en: string) {
  return translateText(language, key, language === 'zh' ? zh : en);
}

const COMPOSER_MAX_HEIGHT_PX = 132;

export function CommandCenterComposer({
  language,
  commandText,
  placeholder,
  isSubmitting,
  onCommandTextChange,
  onSubmit,
}: CommandCenterComposerProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const [isLaunchAnimating, setIsLaunchAnimating] = React.useState(false);
  const normalizedText = commandText.trim();
  const canSubmit = normalizedText.length > 0 && !isSubmitting && !isLaunchAnimating;
  const isBusy = isSubmitting || isLaunchAnimating;
  const copy = {
    placeholder:
      typeof placeholder === 'string' && placeholder.trim().length > 0
        ? placeholder.trim()
        : tr(
            language,
            'command_center.composer.placeholder',
            '直接说出你要分析什么、何时执行。',
            'Describe what you want to analyze and when to run it.',
          ),
    send: tr(language, 'command_center.composer.send', '发送', 'Send'),
    sending: tr(language, 'command_center.composer.sending', '发送中', 'Sending'),
  };

  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
  }, [commandText]);

  React.useEffect(() => {
    if (!isLaunchAnimating) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setIsLaunchAnimating(false);
    }, 520);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [isLaunchAnimating]);

  const handleSubmit = React.useCallback(() => {
    if (!normalizedText || isSubmitting || isLaunchAnimating) {
      return;
    }

    setIsLaunchAnimating(true);
    onSubmit();
  }, [isLaunchAnimating, isSubmitting, normalizedText, onSubmit]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
        return;
      }

      event.preventDefault();
      handleSubmit();
    },
    [handleSubmit],
  );

  return (
    <section className="w-full">
      <div className="rounded-[1.65rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/94 p-2.5 shadow-[0_20px_50px_rgba(3,7,18,0.22)] backdrop-blur-xl">
        <div
          className={`relative flex items-end gap-2 rounded-[1.35rem] border px-3 py-2.5 transition-all duration-300 ${
            isBusy
              ? 'border-[var(--mf-accent)]/45 bg-[var(--mf-surface-strong)] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_18px_32px_rgba(15,23,42,0.18)]'
              : 'border-[var(--mf-border)] bg-[var(--mf-surface-strong)]'
          }`}
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-10 rounded-t-[1.35rem] bg-gradient-to-b from-white/8 to-transparent" />

          <textarea
            ref={textareaRef}
            value={commandText}
            onChange={(event) => onCommandTextChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={copy.placeholder}
            rows={1}
            className="relative max-h-[132px] min-h-[1.5rem] flex-1 resize-none bg-transparent py-1 text-sm leading-6 text-[var(--mf-text)] placeholder:text-[var(--mf-text-muted)] focus:outline-none"
          />

          <Button
            type="button"
            aria-label={isSubmitting ? copy.sending : copy.send}
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl p-0 transition-all duration-300 ${
              canSubmit
                ? 'bg-[var(--mf-accent)] text-[var(--mf-on-accent)] shadow-[0_12px_28px_rgba(59,130,246,0.32)] hover:bg-[var(--mf-accent-hover)]'
                : 'bg-[var(--mf-surface-muted)] text-[var(--mf-text-muted)] shadow-none'
            } ${isBusy ? 'scale-[0.96]' : 'active:scale-95'}`}
          >
            <span
              className={`absolute inset-0 bg-gradient-to-br from-white/24 via-transparent to-black/10 transition-opacity duration-300 ${
                canSubmit ? 'opacity-100' : 'opacity-50'
              }`}
            />
            <span
              className={`absolute inset-0 rounded-2xl border border-white/10 transition-all duration-300 ${
                isLaunchAnimating ? 'scale-110 opacity-100' : 'scale-100 opacity-0'
              }`}
            />

            <span className="relative flex h-full w-full items-center justify-center">
              <Send
                className={`absolute h-[1.125rem] w-[1.125rem] transition-all duration-300 ${
                  isBusy ? 'translate-x-2 -translate-y-2 scale-75 opacity-0' : 'opacity-100'
                }`}
              />
              <LoaderCircle
                className={`absolute h-[1.125rem] w-[1.125rem] transition-all duration-300 ${
                  isSubmitting ? 'scale-100 opacity-100 animate-spin' : 'scale-75 opacity-0'
                }`}
              />
            </span>
          </Button>
        </div>
      </div>
    </section>
  );
}
