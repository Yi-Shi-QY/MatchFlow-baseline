import React from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WorkspaceShell } from '@/src/components/layout/WorkspaceShell';

export default function Memory() {
  const { memoryId } = useParams();
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const copy =
    language === 'zh'
      ? {
          title: memoryId ? '记忆详情' : '记忆',
          subtitle: memoryId
            ? '记忆详情页将在后续任务中接入正式数据与操作区。'
            : '记忆工作区将在后续任务中基于 manager memories 正式接入。',
          body: memoryId
            ? `当前占位路由已锁定：${memoryId}`
            : '记忆工作区已进入正式路由，本任务先冻结入口与导航层级。',
        }
      : {
          title: memoryId ? 'Memory Detail' : 'Memory',
          subtitle: memoryId
            ? 'The memory detail page will connect formal data and actions in a later task.'
            : 'The memory workspace will be wired to manager memories in a later task.',
          body: memoryId
            ? `Placeholder route is now frozen for: ${memoryId}`
            : 'The memory workspace now has a formal route. This task only freezes the entry and navigation layer.',
        };

  return (
    <WorkspaceShell language={language} section="memory" title={copy.title} subtitle={copy.subtitle}>
      <section className="rounded-[1.75rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/88 p-5 text-sm leading-6 text-[var(--mf-text-muted)] shadow-sm">
        {copy.body}
      </section>
    </WorkspaceShell>
  );
}
