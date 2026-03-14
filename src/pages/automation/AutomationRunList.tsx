import React from 'react';
import { TaskCenterActionCard } from './TaskCenterActionCard';
import { TaskCenterSection } from './TaskCenterSection';
import type { TaskCenterAction, TaskCenterCard } from './taskCenterModel';

interface AutomationRunListProps {
  items: TaskCenterCard[];
  title: string;
  emptyText: string;
  selectedRunId?: string | null;
  onAction: (action: TaskCenterAction) => void;
}

export function AutomationRunList({
  items,
  title,
  emptyText,
  selectedRunId = null,
  onAction,
}: AutomationRunListProps) {
  return (
    <TaskCenterSection title={title} emptyText={emptyText} hasItems={items.length > 0}>
      <div className="space-y-3">
        {items.map((item) => (
          <TaskCenterActionCard
            key={item.id}
            card={item}
            isSelected={item.target.type === 'run' && item.target.id === selectedRunId}
            onAction={onAction}
          />
        ))}
      </div>
    </TaskCenterSection>
  );
}
