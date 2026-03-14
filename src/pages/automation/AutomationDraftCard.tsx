import React from 'react';
import { CircleAlert } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import { translateText } from '@/src/i18n/translate';
import {
  formatAutomationSchedule,
  getAutomationExecutionTargetScope,
  getAutomationTargetSelectorLabel,
  getNextClarificationQuestion,
  type AutomationDraft,
} from '@/src/services/automation';
import type { ExecutionTicket } from '@/src/services/manager-workspace/executionTicketTypes';
import {
  buildExecutionApprovalCardModel,
  ExecutionApprovalCard,
} from '@/src/pages/command/ExecutionApprovalCard';

interface AutomationDraftCardProps {
  draft: AutomationDraft;
  executionTicket?: ExecutionTicket | null;
  language: 'zh' | 'en';
  isSelected?: boolean;
  className?: string;
  onActivateDraft: (draftId: string) => void;
  onDeleteDraft: (draftId: string) => void;
  onClarificationAnswer: (draftId: string, answer: string) => void;
}

function tr(language: 'zh' | 'en', key: string, zh: string, en: string) {
  return translateText(language, key, language === 'zh' ? zh : en);
}

export function resolveDraftTargetLabel(
  draft: AutomationDraft,
  language: 'zh' | 'en',
): string {
  return (
    getAutomationTargetSelectorLabel(draft.targetSelector) ||
    tr(language, 'task_center.draft_card.target_needed', '待补充目标', 'Target needed')
  );
}

export function AutomationDraftCard({
  draft,
  executionTicket = null,
  language,
  isSelected = false,
  className = '',
  onActivateDraft,
  onDeleteDraft,
  onClarificationAnswer,
}: AutomationDraftCardProps) {
  const [answer, setAnswer] = React.useState('');
  const question = getNextClarificationQuestion(draft, language);
  const targetScope = getAutomationExecutionTargetScope(draft.executionPolicy);
  const copy = {
    clarify: tr(language, 'task_center.draft_card.clarify', '待澄清', 'Needs clarification'),
    target: tr(language, 'task_center.draft_card.target', '目标', 'Target'),
    schedule: tr(language, 'task_center.draft_card.schedule', '时间', 'Schedule'),
    targetScope: tr(
      language,
      'task_center.draft_card.target_scope',
      '目标范围',
      'Target scope',
    ),
    answer: tr(language, 'task_center.draft_card.answer', '提交补充', 'Submit answer'),
    delete: tr(language, 'task_center.draft_card.delete', '删除草稿', 'Delete draft'),
    recurring: tr(language, 'task_center.draft_card.recurring', '周期规则', 'Recurring'),
    oneTime: tr(language, 'task_center.draft_card.one_time', '单次任务', 'One-time'),
    immediate: tr(language, 'task_center.draft_card.immediate', '立即执行', 'Instant'),
    collectionTarget: tr(
      language,
      'task_center.draft_card.collection_target',
      '集合目标',
      'Collection target',
    ),
    singleTarget: tr(
      language,
      'task_center.draft_card.single_target',
      '单个目标',
      'Single target',
    ),
  };

  if (draft.status === 'ready') {
    const approval = buildExecutionApprovalCardModel({
      draft,
      ticket: executionTicket,
      language,
    });

    return (
      <ExecutionApprovalCard
        model={approval}
        isSelected={isSelected}
        className={className}
        primaryAnchorId={`automation-draft-${draft.id}`}
        secondaryAnchorId={`execution-approval-${approval.approvalId}`}
        onPrimaryAction={() => onActivateDraft(draft.id)}
        onSecondaryAction={() => onDeleteDraft(draft.id)}
      />
    );
  }

  return (
    <Card
      id={`automation-draft-${draft.id}`}
      className={`bg-[var(--mf-surface)] transition-colors ${
        isSelected ? 'ring-1 ring-[var(--mf-accent)] bg-[var(--mf-surface-muted)]' : ''
      } ${className}`.trim()}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-[var(--mf-text)]">{draft.title}</div>
            <div className="flex flex-wrap gap-2 text-[11px] text-[var(--mf-text-muted)]">
              <span className="rounded-full border border-[var(--mf-border)] px-2 py-0.5">
                {draft.domainId}
              </span>
              <span className="rounded-full border border-[var(--mf-border)] px-2 py-0.5">
                {draft.intentType === 'recurring' ? copy.recurring : copy.oneTime}
              </span>
              {draft.activationMode === 'run_now' ? (
                <span className="rounded-full border border-[var(--mf-border)] px-2 py-0.5">
                  {copy.immediate}
                </span>
              ) : null}
            </div>
          </div>
          <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
            {copy.clarify}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 text-xs text-[var(--mf-text-muted)]">
          <div>
            <span className="text-[10px] uppercase tracking-wider">{copy.target}</span>
            <div className="mt-1 text-[var(--mf-text)]">
              {resolveDraftTargetLabel(draft, language)}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider">{copy.schedule}</span>
            <div className="mt-1 text-[var(--mf-text)]">
              {formatAutomationSchedule(draft.schedule, language)}
            </div>
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-wider">{copy.targetScope}</span>
            <div className="mt-1 text-[var(--mf-text)]">
              {targetScope === 'collection' ? copy.collectionTarget : copy.singleTarget}
            </div>
          </div>
        </div>

        {question ? (
          <div className="space-y-2 rounded-xl border border-[var(--mf-border)] bg-[var(--mf-surface-muted)] p-3">
            <div className="flex items-start gap-2 text-xs text-[var(--mf-text)]">
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 text-[var(--mf-accent)]" />
              <span>{question.prompt}</span>
            </div>
            <input
              type="text"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder={question.placeholder}
              className="w-full rounded-lg border border-[var(--mf-border)] bg-[var(--mf-surface)] p-2 text-sm text-[var(--mf-text)] focus:border-[var(--mf-accent)] focus:outline-none"
            />
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                onClarificationAnswer(draft.id, answer);
                setAnswer('');
              }}
            >
              {copy.answer}
            </Button>
          </div>
        ) : null}

        <Button
          variant="ghost"
          className="w-full text-[var(--mf-text-muted)]"
          onClick={() => onDeleteDraft(draft.id)}
        >
          {copy.delete}
        </Button>
      </CardContent>
    </Card>
  );
}
