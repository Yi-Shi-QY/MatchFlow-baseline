import React from 'react';
import { translateText } from '@/src/i18n/translate';
import { TaskCenterActionCard } from './TaskCenterActionCard';
import { TaskCenterSection } from './TaskCenterSection';
import type { TaskCenterAction, TaskCenterCard } from './taskCenterModel';

interface AutomationDraftListProps {
  items: TaskCenterCard[];
  language: 'zh' | 'en';
  selectedDraftId?: string | null;
  onAction: (action: TaskCenterAction) => void;
}

function tr(language: 'zh' | 'en', key: string, zh: string, en: string) {
  return translateText(language, key, language === 'zh' ? zh : en);
}

export function AutomationDraftList({
  items,
  language,
  selectedDraftId = null,
  onAction,
}: AutomationDraftListProps) {
  const copy = {
    title: tr(language, 'task_center.sections.waiting_title', '待我处理', 'Waiting'),
    empty: tr(
      language,
      'task_center.sections.waiting_empty',
      '当前没有需要你立即处理的事项。',
      'There is nothing that needs your action right now.',
    ),
  };

  return (
    <TaskCenterSection title={copy.title} emptyText={copy.empty} hasItems={items.length > 0}>
      <div className="space-y-3">
        {items.map((item) => (
          <TaskCenterActionCard
            key={item.id}
            card={item}
            isSelected={item.target.type === 'draft' && item.target.id === selectedDraftId}
            onAction={onAction}
          />
        ))}
      </div>
    </TaskCenterSection>
  );
}
