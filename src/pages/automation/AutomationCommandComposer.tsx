import React from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import { translateText } from '@/src/i18n/translate';
import type { AutomationCommandComposerMode } from '@/src/services/automation';

interface AutomationCommandComposerProps {
  language: 'zh' | 'en';
  composerMode: AutomationCommandComposerMode;
  commandText: string;
  examples: string[];
  feedbackMessage: string;
  isSubmitting: boolean;
  onComposerModeChange: (value: AutomationCommandComposerMode) => void;
  onCommandTextChange: (value: string) => void;
  onUseExample: (value: string) => void;
  onSubmit: () => void;
}

function tr(language: 'zh' | 'en', key: string, zh: string, en: string) {
  return translateText(language, key, language === 'zh' ? zh : en);
}

export function AutomationCommandComposer({
  language,
  composerMode,
  commandText,
  examples,
  feedbackMessage,
  isSubmitting,
  onComposerModeChange,
  onCommandTextChange,
  onUseExample,
  onSubmit,
}: AutomationCommandComposerProps) {
  const copy = {
    title: tr(language, 'task_center.composer.title', '统一自然语言入口', 'Unified Natural Language Entry'),
    subtitle: tr(
      language,
      'task_center.composer.subtitle',
      '一句话描述目标和时间。系统会先判断这是立即分析还是自动化任务，再生成可确认的结构化草稿。',
      'Describe the target and timing in one sentence. MatchFlow will decide whether this should run now or become automation, then prepare structured drafts for confirmation.',
    ),
    placeholder: tr(
      language,
      'task_center.composer.placeholder',
      '例如：现在分析皇马 vs 巴萨；今晚 20:00 分析皇马 vs 巴萨；每天 09:00 分析英超和西甲全部比赛',
      'Example: analyze Real Madrid vs Barcelona now; tonight at 20:00 analyze Real Madrid vs Barcelona',
    ),
    actionSmart: tr(language, 'task_center.composer.action_smart', '理解指令', 'Understand Command'),
    actionAnalyzeNow: tr(
      language,
      'task_center.composer.action_analyze_now',
      '准备立即分析',
      'Prepare Instant Run',
    ),
    actionAutomation: tr(
      language,
      'task_center.composer.action_automation',
      '生成自动化草稿',
      'Generate Automation Drafts',
    ),
    examples: tr(language, 'task_center.composer.examples', '示例指令', 'Examples'),
    modeLabel: tr(language, 'task_center.composer.mode_label', '模式', 'Mode'),
    smart: tr(language, 'task_center.composer.smart', '智能', 'Smart'),
    analyzeNow: tr(language, 'task_center.composer.analyze_now', '立即分析', 'Analyze Now'),
    automation: tr(language, 'task_center.composer.automation', '自动化', 'Automation'),
  };

  const actionLabel =
    composerMode === 'analyze_now'
      ? copy.actionAnalyzeNow
      : composerMode === 'automation'
        ? copy.actionAutomation
        : copy.actionSmart;

  return (
    <Card className="border-[var(--mf-border)] bg-[var(--mf-surface)]">
      <CardContent className="p-4 space-y-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-[var(--mf-text)]">{copy.title}</h2>
          <p className="text-xs leading-relaxed text-[var(--mf-text-muted)]">
            {copy.subtitle}
          </p>
        </div>

        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-[var(--mf-text-muted)]">
            {copy.modeLabel}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {([
              ['smart', copy.smart],
              ['analyze_now', copy.analyzeNow],
              ['automation', copy.automation],
            ] as Array<[AutomationCommandComposerMode, string]>).map(([value, label]) => {
              const active = composerMode === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onComposerModeChange(value)}
                  className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${
                    active
                      ? 'border-[var(--mf-accent)] bg-[var(--mf-surface-muted)] text-[var(--mf-text)]'
                      : 'border-[var(--mf-border)] bg-[var(--mf-surface-strong)] text-[var(--mf-text-muted)]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <textarea
          value={commandText}
          onChange={(event) => onCommandTextChange(event.target.value)}
          placeholder={copy.placeholder}
          rows={4}
          className="w-full rounded-xl border border-[var(--mf-border)] bg-[var(--mf-surface-strong)] p-3 text-sm text-[var(--mf-text)] focus:outline-none focus:border-[var(--mf-accent)]"
        />

        <div className="space-y-2">
          <div className="text-[11px] uppercase tracking-wider text-[var(--mf-text-muted)]">
            {copy.examples}
          </div>
          <div className="flex flex-wrap gap-2">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => onUseExample(example)}
                className="rounded-full border border-[var(--mf-border)] bg-[var(--mf-surface-muted)] px-3 py-1.5 text-left text-[11px] text-[var(--mf-text)]"
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button onClick={onSubmit} className="flex-1 gap-2" disabled={isSubmitting}>
            <Send className="w-4 h-4" />
            {actionLabel}
          </Button>
        </div>

        {feedbackMessage ? (
          <div className="rounded-lg border border-[var(--mf-border)] bg-[var(--mf-surface-muted)] px-3 py-2 text-xs text-[var(--mf-text-muted)]">
            {feedbackMessage}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
