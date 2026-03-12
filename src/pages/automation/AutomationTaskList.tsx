import React from 'react';
import { Activity, Calendar, Loader2, Play } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import { formatAutomationSchedule } from '@/src/services/automation';
import type { AutomationJob, AutomationRule } from '@/src/services/automation';

interface AutomationTaskListProps {
  language: 'zh' | 'en';
  rules: AutomationRule[];
  jobs: AutomationJob[];
  selectedJobId?: string | null;
  runningJobId?: string | null;
  onRunJobNow?: (jobId: string) => void;
}

function resolveRuleTargetLabel(rule: AutomationRule): string {
  if (rule.targetSelector.mode === 'league_query') {
    return rule.targetSelector.leagueLabel;
  }
  if (rule.targetSelector.mode === 'fixed_subject') {
    return rule.targetSelector.subjectLabel;
  }
  return rule.targetSelector.displayLabel;
}

function resolveJobTargetLabel(job: AutomationJob): string {
  if (job.targetSelector.mode === 'league_query') {
    return job.targetSelector.leagueLabel;
  }
  if (job.targetSelector.mode === 'fixed_subject') {
    return job.targetSelector.subjectLabel;
  }
  return job.targetSelector.displayLabel;
}

export function AutomationTaskList({
  language,
  rules,
  jobs,
  selectedJobId = null,
  runningJobId = null,
  onRunJobNow,
}: AutomationTaskListProps) {
  const copy =
    language === 'zh'
      ? {
          rules: '已启用规则',
          jobs: '待执行任务',
          emptyRules: '暂时还没有启用中的周期规则。',
          emptyJobs: '暂时还没有待执行任务。',
          nextRun: '下一次',
          scheduledFor: '计划执行',
          runNow: '立即执行',
          running: '执行中',
        }
      : {
          rules: 'Enabled Rules',
          jobs: 'Upcoming Jobs',
          emptyRules: 'No recurring rules enabled yet.',
          emptyJobs: 'No pending jobs yet.',
          nextRun: 'Next run',
          scheduledFor: 'Scheduled for',
          runNow: 'Run now',
          running: 'Running',
        };

  return (
    <section className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[var(--mf-accent)]" />
          <h3 className="text-sm font-semibold text-[var(--mf-text)]">{copy.rules}</h3>
        </div>
        {rules.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-[var(--mf-text-muted)]">
              {copy.emptyRules}
            </CardContent>
          </Card>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id} className="bg-[var(--mf-surface)]">
              <CardContent className="p-4 space-y-2">
                <div className="text-sm font-semibold text-[var(--mf-text)]">{rule.title}</div>
                <div className="text-xs text-[var(--mf-text-muted)]">
                  {resolveRuleTargetLabel(rule)}
                </div>
                <div className="text-xs text-[var(--mf-text-muted)]">
                  {copy.nextRun}: {formatAutomationSchedule(rule.schedule, language)}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[var(--mf-accent)]" />
          <h3 className="text-sm font-semibold text-[var(--mf-text)]">{copy.jobs}</h3>
        </div>
        {jobs.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-[var(--mf-text-muted)]">
              {copy.emptyJobs}
            </CardContent>
          </Card>
        ) : (
          jobs.map((job) => {
            const isRunning = job.state === 'running' || runningJobId === job.id;
            const isSelected = selectedJobId === job.id;
            return (
              <Card
                key={job.id}
                id={`automation-job-${job.id}`}
                className={`bg-[var(--mf-surface)] transition-colors ${
                  isSelected ? 'ring-1 ring-[var(--mf-accent)] bg-[var(--mf-surface-muted)]' : ''
                }`}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="text-sm font-semibold text-[var(--mf-text)]">{job.title}</div>
                  <div className="text-xs text-[var(--mf-text-muted)]">
                    {resolveJobTargetLabel(job)}
                  </div>
                  <div className="text-xs text-[var(--mf-text-muted)]">
                    {copy.scheduledFor}:{' '}
                    {new Date(job.scheduledFor).toLocaleString(
                      language === 'zh' ? 'zh-CN' : 'en-US',
                      {
                        hour12: false,
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      },
                    )}
                  </div>
                  <Button
                    type="button"
                    variant={isRunning ? 'secondary' : 'outline'}
                    size="sm"
                    className="w-full justify-center gap-2"
                    disabled={isRunning || !onRunJobNow}
                    onClick={() => onRunJobNow?.(job.id)}
                  >
                    {isRunning ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    {isRunning ? copy.running : copy.runNow}
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </section>
  );
}
