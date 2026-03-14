import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleSlash,
  LoaderCircle,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { translateText } from '@/src/i18n/translate';
import type { CommandCenterFeedItem } from './feedAdapter';

interface ExecutionEventCardProps {
  language: 'zh' | 'en';
  item: Pick<CommandCenterFeedItem, 'text' | 'automationEvent' | 'navigationIntent'>;
  onOpenRoute: (route: string) => void;
}

function tr(language: 'zh' | 'en', key: string, zh: string, en: string) {
  return translateText(language, key, language === 'zh' ? zh : en);
}

function getTone(input: {
  automationPhase?: NonNullable<CommandCenterFeedItem['automationEvent']>['phase'];
  isNavigationIntent: boolean;
}) {
  if (input.isNavigationIntent) {
    return {
      shell: 'border-indigo-400/30 bg-indigo-500/10',
      badge: 'border-indigo-400/35 bg-indigo-500/15 text-indigo-100',
      icon: 'text-indigo-200',
    };
  }

  switch (input.automationPhase) {
    case 'completed':
      return {
        shell: 'border-emerald-400/30 bg-emerald-500/10',
        badge: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100',
        icon: 'text-emerald-200',
      };
    case 'failed':
      return {
        shell: 'border-rose-400/30 bg-rose-500/10',
        badge: 'border-rose-400/35 bg-rose-500/15 text-rose-100',
        icon: 'text-rose-200',
      };
    case 'cancelled':
      return {
        shell: 'border-zinc-400/30 bg-zinc-500/10',
        badge: 'border-zinc-400/35 bg-zinc-500/15 text-zinc-100',
        icon: 'text-zinc-200',
      };
    default:
      return {
        shell: 'border-sky-400/30 bg-sky-500/10',
        badge: 'border-sky-400/35 bg-sky-500/15 text-sky-100',
        icon: 'text-sky-200',
      };
  }
}

function getIcon(input: {
  automationPhase?: NonNullable<CommandCenterFeedItem['automationEvent']>['phase'];
  isNavigationIntent: boolean;
}) {
  if (input.isNavigationIntent) {
    return ArrowRight;
  }

  switch (input.automationPhase) {
    case 'completed':
      return CheckCircle2;
    case 'failed':
      return AlertTriangle;
    case 'cancelled':
      return CircleSlash;
    default:
      return LoaderCircle;
  }
}

function getNavigationSummary(
  route: string,
  language: 'zh' | 'en',
): { title: string; description: string; actionLabel: string } {
  if (route.startsWith('/subject/')) {
    return {
      title: tr(
        language,
        'command_center.execution_event.navigation.subject_title',
        '\u5206\u6790\u7ed3\u679c\u5df2\u51c6\u5907\u597d',
        'Analysis result is ready',
      ),
      description: tr(
        language,
        'command_center.execution_event.navigation.subject_description',
        '\u5df2\u751f\u6210\u8df3\u8f6c\u610f\u56fe\uff0c\u53ef\u4ee5\u76f4\u63a5\u6253\u5f00\u7ed3\u679c\u9875\u9762\u3002',
        'A navigation target is ready. You can open the result page directly.',
      ),
      actionLabel: tr(
        language,
        'command_center.execution_event.navigation.subject_action',
        '\u6253\u5f00\u7ed3\u679c',
        'Open result',
      ),
    };
  }

  if (route.startsWith('/automation')) {
    return {
      title: tr(
        language,
        'command_center.execution_event.navigation.automation_title',
        '\u4efb\u52a1\u4e2d\u5fc3\u5df2\u51c6\u5907\u597d',
        'Task center is ready',
      ),
      description: tr(
        language,
        'command_center.execution_event.navigation.automation_description',
        '\u5df2\u751f\u6210\u53ef\u6253\u5f00\u7684\u4efb\u52a1\u5165\u53e3\uff0c\u53ef\u4ee5\u7ee7\u7eed\u67e5\u770b\u8be6\u60c5\u3002',
        'A task destination is ready. You can open it to review the details.',
      ),
      actionLabel: tr(
        language,
        'command_center.execution_event.navigation.automation_action',
        '\u6253\u5f00\u4efb\u52a1',
        'Open task',
      ),
    };
  }

  return {
    title: tr(
      language,
      'command_center.execution_event.navigation.generic_title',
      '\u5df2\u751f\u6210\u53ef\u6253\u5f00\u7684\u4e0b\u4e00\u6b65',
      'Next step is ready',
    ),
    description: tr(
      language,
      'command_center.execution_event.navigation.generic_description',
      '\u5df2\u751f\u6210\u8df3\u8f6c\u610f\u56fe\uff0c\u53ef\u4ee5\u7ee7\u7eed\u6253\u5f00\u5bf9\u5e94\u9875\u9762\u3002',
      'A navigation target is ready. You can continue by opening the destination page.',
    ),
    actionLabel: tr(
      language,
      'command_center.execution_event.navigation.generic_action',
      '\u6253\u5f00',
      'Open',
    ),
  };
}

function buildAutomationMetrics(
  item: NonNullable<CommandCenterFeedItem['automationEvent']>,
  language: 'zh' | 'en',
) {
  return [
    item.provider
      ? {
          id: 'provider',
          label: tr(
            language,
            'command_center.execution_event.metric_provider',
            '\u6a21\u578b\u6e90',
            'Provider',
          ),
          value: item.provider,
        }
      : null,
    item.model
      ? {
          id: 'model',
          label: tr(
            language,
            'command_center.execution_event.metric_model',
            '\u6a21\u578b',
            'Model',
          ),
          value: item.model,
        }
      : null,
    typeof item.totalTokens === 'number' && item.totalTokens > 0
      ? {
          id: 'tokens',
          label: tr(
            language,
            'command_center.execution_event.metric_tokens',
            'Token',
            'Tokens',
          ),
          value: String(item.totalTokens),
        }
      : null,
  ].filter((metric): metric is { id: string; label: string; value: string } => Boolean(metric));
}

export function ExecutionEventCard({
  language,
  item,
  onOpenRoute,
}: ExecutionEventCardProps) {
  const automationEvent = item.automationEvent;
  const navigationIntent = item.navigationIntent;
  if (!automationEvent && !navigationIntent) {
    return null;
  }

  const isNavigationIntent = Boolean(navigationIntent && !automationEvent);
  const tone = getTone({
    automationPhase: automationEvent?.phase,
    isNavigationIntent,
  });
  const Icon = getIcon({
    automationPhase: automationEvent?.phase,
    isNavigationIntent,
  });
  const navigationSummary = navigationIntent
    ? getNavigationSummary(navigationIntent.route, language)
    : null;
  const title = automationEvent?.title || navigationSummary?.title || '';
  const description =
    item.text ||
    (automationEvent?.errorMessage || navigationSummary?.description || '');
  const actionLabel =
    automationEvent
      ? automationEvent.phase === 'completed'
        ? tr(language, 'command_center.execution_event.open_result', '\u67e5\u770b\u7ed3\u679c', 'Open result')
        : automationEvent.phase === 'failed'
          ? tr(language, 'command_center.execution_event.open_issue', '\u67e5\u770b\u95ee\u9898', 'Review issue')
          : automationEvent.phase === 'cancelled'
            ? tr(language, 'command_center.execution_event.open_task', '\u67e5\u770b\u4efb\u52a1', 'Open task')
            : tr(language, 'command_center.execution_event.open_progress', '\u67e5\u770b\u8fdb\u5ea6', 'View progress')
      : navigationSummary?.actionLabel || tr(language, 'command_center.execution_event.open', '\u6253\u5f00', 'Open');
  const badgeLabel =
    automationEvent
      ? automationEvent.phase === 'completed'
        ? tr(language, 'command_center.execution_event.badge_completed', '\u5df2\u5b8c\u6210', 'Completed')
        : automationEvent.phase === 'failed'
          ? tr(language, 'command_center.execution_event.badge_failed', '\u6267\u884c\u5931\u8d25', 'Failed')
          : automationEvent.phase === 'cancelled'
            ? tr(language, 'command_center.execution_event.badge_cancelled', '\u5df2\u53d6\u6d88', 'Cancelled')
            : tr(language, 'command_center.execution_event.badge_running', '\u6267\u884c\u4e2d', 'Running')
      : tr(language, 'command_center.execution_event.badge_navigation', '\u8df3\u8f6c\u5c31\u7eea', 'Navigation');
  const eyebrow = automationEvent
    ? tr(language, 'command_center.execution_event.automation_eyebrow', '\u81ea\u52a8\u5316\u6267\u884c', 'Automation')
    : tr(language, 'command_center.execution_event.navigation_eyebrow', '\u6267\u884c\u8df3\u8f6c', 'Execution route');
  const route = automationEvent?.route || navigationIntent?.route || '';
  const metrics = automationEvent ? buildAutomationMetrics(automationEvent, language) : [];

  return (
    <div
      className={`max-w-[90%] rounded-[1.5rem] border px-4 py-3 shadow-sm ${tone.shell}`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/15 ${tone.icon}`}
        >
          <Icon
            className={`h-4 w-4 ${
              automationEvent?.phase === 'started' ? 'animate-spin' : ''
            }`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] ${tone.badge}`}
            >
              {badgeLabel}
            </span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--mf-text-muted)]">
              {eyebrow}
            </span>
          </div>

          <div className="mt-2 text-sm font-semibold text-[var(--mf-text)]">{title}</div>
          {description ? (
            <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[var(--mf-text-muted)]">
              {description}
            </p>
          ) : null}

          {metrics.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {metrics.map((metric) => (
                <div
                  key={metric.id}
                  className="rounded-full border border-white/10 bg-black/10 px-3 py-1.5 text-[11px] text-[var(--mf-text)]"
                >
                  <span className="text-[var(--mf-text-muted)]">{metric.label}: </span>
                  <span>{metric.value}</span>
                </div>
              ))}
            </div>
          ) : null}

          {route ? (
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                className="rounded-2xl border-white/15 bg-black/10"
                onClick={() => onOpenRoute(route)}
              >
                {actionLabel}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
