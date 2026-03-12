import React from 'react';
import { CheckCircle2, CircleAlert, Trash2 } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import {
  formatAutomationSchedule,
  getNextClarificationQuestion,
  type AutomationDraft,
} from '@/src/services/automation';

interface AutomationDraftCardProps {
  draft: AutomationDraft;
  language: 'zh' | 'en';
  isSelected?: boolean;
  className?: string;
  onActivateDraft: (draftId: string) => void;
  onDeleteDraft: (draftId: string) => void;
  onClarificationAnswer: (draftId: string, answer: string) => void;
}

export function resolveDraftTargetLabel(
  draft: AutomationDraft,
  language: 'zh' | 'en',
): string {
  if (!draft.targetSelector) {
    return language === 'zh' ? '待补充目标' : 'Target needed';
  }
  if (draft.targetSelector.mode === 'league_query') {
    return draft.targetSelector.leagueLabel;
  }
  if (draft.targetSelector.mode === 'fixed_subject') {
    return draft.targetSelector.subjectLabel;
  }
  return draft.targetSelector.displayLabel;
}

export function AutomationDraftCard({
  draft,
  language,
  isSelected = false,
  className = '',
  onActivateDraft,
  onDeleteDraft,
  onClarificationAnswer,
}: AutomationDraftCardProps) {
  const [answer, setAnswer] = React.useState('');
  const question = getNextClarificationQuestion(draft, language);
  const copy =
    language === 'zh'
      ? {
          ready: '可确认',
          clarify: '待澄清',
          target: '目标',
          schedule: '时间',
          intent: '类型',
          activate: '确认并保存',
          runNow: '立即分析',
          delete: '删除',
          answer: '提交补充',
          recurring: '周期规则',
          oneTime: '单次任务',
          immediate: '立即执行',
          allMatches: '全量展开',
          singleTarget: '单目标',
        }
      : {
          ready: 'Ready',
          clarify: 'Needs clarification',
          target: 'Target',
          schedule: 'Schedule',
          intent: 'Type',
          activate: 'Confirm and Save',
          runNow: 'Analyze now',
          delete: 'Delete',
          answer: 'Submit answer',
          recurring: 'Recurring',
          oneTime: 'One-time',
          immediate: 'Instant',
          allMatches: 'Expand all matches',
          singleTarget: 'Single target',
        };

  return (
    <Card
      id={`automation-draft-${draft.id}`}
      className={`bg-[var(--mf-surface)] transition-colors ${
        isSelected ? 'ring-1 ring-[var(--mf-accent)] bg-[var(--mf-surface-muted)]' : ''
      } ${className}`}
    >
      <CardContent className="p-4 space-y-3">
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
          <span
            className={`rounded-full px-2 py-1 text-[11px] ${
              draft.status === 'ready'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-amber-500/10 text-amber-300'
            }`}
          >
            {draft.status === 'ready' ? copy.ready : copy.clarify}
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
            <span className="text-[10px] uppercase tracking-wider">{copy.intent}</span>
            <div className="mt-1 text-[var(--mf-text)]">
              {draft.executionPolicy.targetExpansion === 'all_matches'
                ? copy.allMatches
                : copy.singleTarget}
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
              className="w-full rounded-lg border border-[var(--mf-border)] bg-[var(--mf-surface)] p-2 text-sm text-[var(--mf-text)] focus:outline-none focus:border-[var(--mf-accent)]"
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
        ) : (
          <Button
            className="w-full gap-2"
            onClick={() => onActivateDraft(draft.id)}
            disabled={draft.status !== 'ready'}
          >
            <CheckCircle2 className="w-4 h-4" />
            {draft.activationMode === 'run_now' ? copy.runNow : copy.activate}
          </Button>
        )}

        <Button
          variant="ghost"
          className="w-full gap-2 text-[var(--mf-text-muted)]"
          onClick={() => onDeleteDraft(draft.id)}
        >
          <Trash2 className="w-4 h-4" />
          {copy.delete}
        </Button>
      </CardContent>
    </Card>
  );
}
