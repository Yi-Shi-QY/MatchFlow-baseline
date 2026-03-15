import React from 'react';
import { CheckCircle2, Trash2 } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { translateText } from '@/src/i18n/translate';
import {
  formatAutomationSchedule,
  getAutomationTargetSelectorLabel,
  type AutomationDraft,
} from '@/src/services/automation';
import {
  formatManagerSequencePreference,
  formatManagerSourcePreferences,
} from '@/src/services/manager-legacy/analysisProfile';
import type { ExecutionTicket } from '@/src/services/manager-workspace/executionTicketTypes';

export interface ExecutionApprovalCardModel {
  approvalId: string;
  draftId: string;
  ticketId: string | null;
  title: string;
  eyebrow: string;
  summary: string;
  whatLabel: string;
  whatValue: string;
  targetLabel: string;
  targetValue: string;
  whenLabel: string;
  whenValue: string;
  profileLabel?: string;
  profileValue?: string | null;
  whyLabel: string;
  whyValue: string;
  primaryActionLabel: string;
  secondaryActionLabel: string;
}

interface BuildExecutionApprovalCardModelInput {
  draft: AutomationDraft;
  ticket?: ExecutionTicket | null;
  language: 'zh' | 'en';
}

interface ExecutionApprovalCardProps {
  model: ExecutionApprovalCardModel;
  isSelected?: boolean;
  className?: string;
  primaryAnchorId?: string;
  secondaryAnchorId?: string;
  onPrimaryAction: () => void;
  onSecondaryAction?: () => void;
}

function tr(language: 'zh' | 'en', key: string, zh: string, en: string) {
  return translateText(language, key, language === 'zh' ? zh : en);
}

function resolveApprovalTargetLabel(
  draft: AutomationDraft,
  ticket: ExecutionTicket | null | undefined,
  language: 'zh' | 'en',
): string {
  if (ticket?.target.targetLabel) {
    return ticket.target.targetLabel;
  }

  return (
    getAutomationTargetSelectorLabel(draft.targetSelector) ||
    tr(language, 'task_center.draft_card.target_needed', '待补充目标', 'Target needed')
  );
}

function resolveApprovalWhatValue(
  draft: AutomationDraft,
  language: 'zh' | 'en',
): string {
  if (draft.activationMode === 'run_now') {
    return tr(
      language,
      'command_center.approval.what_immediate',
      '立即进入正式分析',
      'Start the formal analysis now',
    );
  }

  if (draft.intentType === 'recurring') {
    return tr(
      language,
      'command_center.approval.what_recurring',
      '启用周期自动化',
      'Enable recurring automation',
    );
  }

  return tr(
    language,
    'command_center.approval.what_scheduled',
    '安排一次性任务',
    'Schedule a one-time automation',
  );
}

function resolveApprovalWhenValue(
  draft: AutomationDraft,
  ticket: ExecutionTicket | null | undefined,
  language: 'zh' | 'en',
): string {
  if (draft.activationMode === 'run_now') {
    return tr(
      language,
      'command_center.approval.when_immediate',
      '确认后立即开始',
      'Immediately after confirmation',
    );
  }

  if (draft.schedule) {
    return formatAutomationSchedule(draft.schedule, language);
  }

  if (ticket?.target.scheduledFor) {
    const value = new Date(ticket.target.scheduledFor);
    if (!Number.isNaN(value.getTime())) {
      return value.toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US', {
        hour12: false,
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }

  return tr(
    language,
    'command_center.approval.when_pending',
    '确认后按当前设置执行',
    'Run with the current settings after confirmation',
  );
}

function resolveApprovalWhyValue(
  draft: AutomationDraft,
  language: 'zh' | 'en',
): string {
  if (draft.activationMode === 'run_now') {
    return tr(
      language,
      'command_center.approval.why_immediate',
      '这样会创建正式执行链路，并把后续进展持续写回到对话里。',
      'This turns the draft into a real execution and keeps later progress visible in the conversation.',
    );
  }

  if (draft.intentType === 'recurring') {
    return tr(
      language,
      'command_center.approval.why_recurring',
      '这样会启用正式规则，后续按计划自动执行，不再停留在草稿状态。',
      'This enables the real rule so future runs execute on schedule instead of staying as a draft.',
    );
  }

  return tr(
    language,
    'command_center.approval.why_scheduled',
    '这样会创建正式任务，并锁定这次计划执行的时间和目标。',
    'This creates the real job and locks in the planned target and schedule.',
  );
}

export function buildExecutionApprovalCardModel(
  input: BuildExecutionApprovalCardModelInput,
): ExecutionApprovalCardModel {
  const { draft, ticket, language } = input;
  const targetValue = resolveApprovalTargetLabel(draft, ticket, language);
  const whenValue = resolveApprovalWhenValue(draft, ticket, language);
  const profileValue =
    draft.analysisProfile &&
    draft.analysisProfile.selectedSourceIds.length > 0 &&
    draft.analysisProfile.sequencePreference.length > 0
      ? language === 'zh'
        ? `已识别因素：${formatManagerSourcePreferences(language, draft.analysisProfile.selectedSourceIds)}；顺序：${formatManagerSequencePreference(language, draft.analysisProfile.sequencePreference)}。`
        : `Recognized factors: ${formatManagerSourcePreferences(language, draft.analysisProfile.selectedSourceIds)}; order: ${formatManagerSequencePreference(language, draft.analysisProfile.sequencePreference)}.`
      : null;

  return {
    approvalId: ticket?.id || draft.id,
    draftId: draft.id,
    ticketId: ticket?.id || null,
    title: draft.title,
    eyebrow: tr(
      language,
      'command_center.approval.eyebrow',
      '待确认执行',
      'Approval needed',
    ),
    summary: `${targetValue} · ${whenValue}`,
    whatLabel: tr(language, 'command_center.approval.what_label', '执行内容', 'What'),
    whatValue: resolveApprovalWhatValue(draft, language),
    targetLabel: tr(language, 'command_center.approval.target_label', '执行目标', 'Target'),
    targetValue,
    whenLabel: tr(language, 'command_center.approval.when_label', '执行时间', 'When'),
    whenValue,
    profileLabel: profileValue
      ? tr(language, 'command_center.approval.profile_label', '已识别配置', 'Recognized profile')
      : undefined,
    profileValue,
    whyLabel: tr(
      language,
      'command_center.approval.why_label',
      '为什么现在确认',
      'Why confirm now',
    ),
    whyValue: resolveApprovalWhyValue(draft, language),
    primaryActionLabel:
      draft.activationMode === 'run_now'
        ? tr(language, 'command_center.home.approval.analyze_now', '立即分析', 'Analyze now')
        : tr(language, 'command_center.home.approval.confirm_run', '确认执行', 'Confirm run'),
    secondaryActionLabel: tr(
      language,
      'command_center.approval.delete',
      '删除草稿',
      'Delete draft',
    ),
  };
}

export function ExecutionApprovalCard({
  model,
  isSelected = false,
  className = '',
  primaryAnchorId,
  secondaryAnchorId,
  onPrimaryAction,
  onSecondaryAction,
}: ExecutionApprovalCardProps) {
  const content = (
    <article
      className={`rounded-[1.5rem] border border-emerald-400/25 bg-emerald-500/10 p-4 shadow-sm transition-colors ${
        isSelected ? 'ring-1 ring-[var(--mf-accent)]' : ''
      } ${className}`.trim()}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--mf-text-muted)]">
        {model.eyebrow}
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--mf-text)]">{model.title}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--mf-text-muted)]">{model.summary}</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--mf-text-muted)]">
            {model.whatLabel}
          </div>
          <div className="mt-1 text-sm text-[var(--mf-text)]">{model.whatValue}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--mf-text-muted)]">
            {model.targetLabel}
          </div>
          <div className="mt-1 text-sm text-[var(--mf-text)]">{model.targetValue}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--mf-text-muted)]">
            {model.whenLabel}
          </div>
          <div className="mt-1 text-sm text-[var(--mf-text)]">{model.whenValue}</div>
        </div>
        {model.profileLabel && model.profileValue ? (
          <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--mf-text-muted)]">
              {model.profileLabel}
            </div>
            <div className="mt-1 text-sm text-[var(--mf-text)]">{model.profileValue}</div>
          </div>
        ) : null}
        <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--mf-text-muted)]">
            {model.whyLabel}
          </div>
          <div className="mt-1 text-sm text-[var(--mf-text)]">{model.whyValue}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button className="w-full gap-2 sm:flex-1" onClick={onPrimaryAction}>
          <CheckCircle2 className="h-4 w-4" />
          {model.primaryActionLabel}
        </Button>
        {onSecondaryAction ? (
          <Button
            variant="outline"
            className="w-full gap-2 sm:flex-1"
            onClick={onSecondaryAction}
          >
            <Trash2 className="h-4 w-4" />
            {model.secondaryActionLabel}
          </Button>
        ) : null}
      </div>
    </article>
  );

  if (!primaryAnchorId && !secondaryAnchorId) {
    return content;
  }

  return (
    <div id={primaryAnchorId}>
      {secondaryAnchorId && secondaryAnchorId !== primaryAnchorId ? (
        <span id={secondaryAnchorId} className="sr-only" aria-hidden="true" />
      ) : null}
      {content}
    </div>
  );
}
