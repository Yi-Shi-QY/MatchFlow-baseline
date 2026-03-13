import React from 'react';
import { TaskCenterActionCard } from './TaskCenterActionCard';
import { TaskCenterSection } from './TaskCenterSection';
import type { TaskCenterAction, TaskCenterCard } from './taskCenterModel';

interface AutomationDraftListProps {
  items: TaskCenterCard[];
  language: 'zh' | 'en';
  selectedDraftId?: string | null;
  onPrimaryAction: (action: TaskCenterAction) => void;
}

export function AutomationDraftList({
  items,
  language,
  selectedDraftId = null,
  onPrimaryAction,
}: AutomationDraftListProps) {
  const copy =
    language === 'zh'
      ? {
          title: '待我处理',
          empty: '当前没有需要你立即处理的事项。',
        }
      : {
          title: 'Waiting',
          empty: 'There is nothing that needs your action right now.',
        };

  return (
    <TaskCenterSection title={copy.title} emptyText={copy.empty} hasItems={items.length > 0}>
      <div className="space-y-3">
        {items.map((item) => (
          <TaskCenterActionCard
            key={item.id}
            card={item}
            isSelected={item.target.type === 'draft' && item.target.id === selectedDraftId}
            onPrimaryAction={onPrimaryAction}
          />
        ))}
      </div>
    </TaskCenterSection>
  );
}
