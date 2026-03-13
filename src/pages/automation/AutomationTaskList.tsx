import React from 'react';
import { TaskCenterActionCard } from './TaskCenterActionCard';
import { TaskCenterSection } from './TaskCenterSection';
import type { TaskCenterAction, TaskCenterCard } from './taskCenterModel';

interface AutomationTaskListProps {
  items: TaskCenterCard[];
  title: string;
  emptyText: string;
  selectedRuleId?: string | null;
  selectedJobId?: string | null;
  selectedRunId?: string | null;
  onPrimaryAction: (action: TaskCenterAction) => void;
}

export function AutomationTaskList({
  items,
  title,
  emptyText,
  selectedRuleId = null,
  selectedJobId = null,
  selectedRunId = null,
  onPrimaryAction,
}: AutomationTaskListProps) {
  return (
    <TaskCenterSection title={title} emptyText={emptyText} hasItems={items.length > 0}>
      <div className="space-y-3">
        {items.map((item) => {
          const isSelected =
            (item.target.type === 'rule' && item.target.id === selectedRuleId) ||
            (item.target.type === 'job' && item.target.id === selectedJobId) ||
            (item.target.type === 'run' && item.target.id === selectedRunId);

          return (
            <TaskCenterActionCard
              key={item.id}
              card={item}
              isSelected={isSelected}
              onPrimaryAction={onPrimaryAction}
            />
          );
        })}
      </div>
    </TaskCenterSection>
  );
}
