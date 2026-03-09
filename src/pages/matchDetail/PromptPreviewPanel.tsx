import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ChevronUp, Code2, LayoutTemplate } from 'lucide-react';

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

interface PromptPreviewPanelProps {
  isPreviewExpanded: boolean;
  onTogglePreview: () => void;
  showJson: boolean;
  onToggleJson: () => void;
  editableData: string;
  onChangeEditableData: (value: string) => void;
  renderHumanReadableForm: () => React.ReactNode;
  t: TranslateFn;
}

export function PromptPreviewPanel({
  isPreviewExpanded,
  onTogglePreview,
  showJson,
  onToggleJson,
  editableData,
  onChangeEditableData,
  renderHumanReadableForm,
  t,
}: PromptPreviewPanelProps) {
  return (
    <div className="mt-4 flex flex-col gap-2 flex-1">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 cursor-pointer group" onClick={onTogglePreview}>
          <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer group-hover:text-zinc-300 transition-colors">
            {t('match.agent_prompt_preview')}
          </label>
          {isPreviewExpanded ? (
            <ChevronUp className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
          ) : (
            <ChevronDown className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
          )}
        </div>

        {isPreviewExpanded && (
          <button
            onClick={onToggleJson}
            className="text-[10px] text-emerald-500 hover:text-emerald-400 flex items-center gap-1 font-mono uppercase tracking-wider bg-emerald-500/10 px-2 py-1 rounded transition-colors"
          >
            {showJson ? <LayoutTemplate className="w-3 h-3" /> : <Code2 className="w-3 h-3" />}
            {showJson ? t('match.form_view') : t('match.json_view')}
          </button>
        )}
      </div>

      <AnimatePresence>
        {isPreviewExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-2 overflow-hidden"
          >
            {showJson ? (
              <textarea
                className="w-full min-h-[200px] bg-zinc-950 border border-white/10 rounded-xl p-4 text-xs font-mono text-zinc-300 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                value={editableData}
                onChange={(e) => onChangeEditableData(e.target.value)}
              />
            ) : (
              <div className="w-full min-h-[200px] bg-zinc-950/50 border border-white/10 rounded-xl p-4 overflow-y-auto max-h-[400px]">
                {renderHumanReadableForm()}
              </div>
            )}
            <p className="text-[10px] text-zinc-500">
              {showJson ? t('match.edit_json_hint') : t('match.edit_form_hint')}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
