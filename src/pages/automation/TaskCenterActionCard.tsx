import React from 'react';
import { Button } from '@/src/components/ui/Button';
import {
  getTaskCenterAnchorId,
  type TaskCenterAction,
  type TaskCenterCard,
} from './taskCenterModel';

interface TaskCenterActionCardProps {
  card: TaskCenterCard;
  isSelected?: boolean;
  onPrimaryAction: (action: TaskCenterAction) => void;
}

function getTone(card: TaskCenterCard): string {
  if (card.kind === 'approval') {
    return 'border-emerald-400/25 bg-emerald-500/10';
  }
  if (card.kind === 'clarification') {
    return 'border-amber-400/25 bg-amber-500/10';
  }
  if (card.kind === 'exception') {
    return 'border-rose-400/25 bg-rose-500/10';
  }
  if (card.kind === 'running') {
    return 'border-sky-400/25 bg-sky-500/10';
  }
  return 'border-[var(--mf-border)] bg-[var(--mf-surface)]/92';
}

export function TaskCenterActionCard({
  card,
  isSelected = false,
  onPrimaryAction,
}: TaskCenterActionCardProps) {
  return (
    <article
      id={getTaskCenterAnchorId(card.target)}
      className={`rounded-[1.5rem] border p-4 shadow-sm transition-colors ${getTone(card)} ${
        isSelected ? 'ring-1 ring-[var(--mf-accent)]' : ''
      }`}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] text-[var(--mf-text-muted)]">
        {card.eyebrow}
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--mf-text)]">{card.title}</div>
      <p className="mt-2 text-sm leading-6 text-[var(--mf-text-muted)]">{card.description}</p>
      {card.meta.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {card.meta.map((item, index) => (
            <span
              key={`${card.id}:${index}`}
              className="rounded-full border border-white/10 bg-black/10 px-3 py-1 text-[11px] text-[var(--mf-text)]"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}
      <Button
        size="sm"
        className="mt-4 w-full rounded-2xl"
        onClick={() => onPrimaryAction(card.primaryAction.action)}
      >
        {card.primaryAction.label}
      </Button>
    </article>
  );
}
