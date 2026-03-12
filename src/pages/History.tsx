import React from 'react';
import { useTranslation } from 'react-i18next';
import { WorkspaceShell } from '@/src/components/layout/WorkspaceShell';

export default function History() {
  const { i18n } = useTranslation();
  const language = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const copy =
    language === 'zh'
      ? {
          title: '历史',
          subtitle: '最近完成结果、可继续主题和已保存主题会在后续任务中正式接入。',
          body: '历史工作区已进入正式路由，本任务仅先冻结导航与页面入口。',
        }
      : {
          title: 'History',
          subtitle: 'Recent results, resumable topics, and saved topics will be wired in later tasks.',
          body: 'The history workspace now has a formal route. This task only freezes the navigation and entry point.',
        };

  return (
    <WorkspaceShell language={language} section="history" title={copy.title} subtitle={copy.subtitle}>
      <section className="rounded-[1.75rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/88 p-5 text-sm leading-6 text-[var(--mf-text-muted)] shadow-sm">
        {copy.body}
      </section>
    </WorkspaceShell>
  );
}
