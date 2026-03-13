import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Select } from '@/src/components/ui/Select';
import type { SettingsItemRowModel } from './settingsHomeModel';

interface SettingsItemRowProps {
  item: SettingsItemRowModel;
  onToggle: (item: SettingsItemRowModel) => void;
  onSelect: (item: SettingsItemRowModel, value: string) => void;
  onNavigate: (route: string) => void;
}

export function SettingsItemRow({
  item,
  onToggle,
  onSelect,
  onNavigate,
}: SettingsItemRowProps) {
  return (
    <div className="rounded-[1.4rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/92 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-[var(--mf-text)]">{item.label}</div>
          <div className="mt-1 text-sm leading-6 text-[var(--mf-text-muted)]">{item.description}</div>
        </div>

        <div className="w-[42%] shrink-0">
          {item.control === 'select' && item.options ? (
            <Select
              value={String(item.value || '')}
              onChange={(value) => onSelect(item, value)}
              options={item.options}
            />
          ) : null}

          {item.control === 'toggle' ? (
            <Button
              variant={item.value ? 'default' : 'outline'}
              className="w-full rounded-2xl"
              onClick={() => onToggle(item)}
            >
              {item.valueLabel}
            </Button>
          ) : null}

          {item.control === 'link' && item.route ? (
            <Button
              variant="outline"
              className="w-full justify-between rounded-2xl"
              onClick={() => onNavigate(item.route!)}
            >
              <span className="truncate">{item.valueLabel}</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
