import type { DomainUiTheme } from "../themeTypes";

export const FENGSHUI_DOMAIN_UI_THEME: DomainUiTheme = {
  id: "fengshui",
  home: {
    history: {
      cardClassName:
        "snap-center shrink-0 w-48 cursor-pointer active:scale-[0.98] transition-all rounded-2xl border-cyan-800/70 bg-slate-950/70 hover:bg-slate-950 hover:border-cyan-500/70 overflow-hidden shadow-md shadow-cyan-900/20",
      activeCardClassName: "ring-1 ring-cyan-400/60",
      headerMetaClassName:
        "min-w-0 flex-1 text-[9px] text-cyan-700 uppercase tracking-wider font-mono truncate",
      timestampClassName: "text-[9px] text-slate-500 font-mono flex items-center gap-1 whitespace-nowrap",
      footerClassName: "mt-2 pt-2 border-t border-cyan-500/10",
      activeStatusClassName: "text-[10px] text-cyan-300 font-mono animate-pulse",
      completedStatusClassName: "text-[10px] text-cyan-200/70 font-mono",
      distributionLabelClassName: "flex justify-between text-[8px] text-cyan-700 font-mono px-1",
      barPalette: ["#22d3ee", "#0ea5e9", "#14b8a6", "#f59e0b", "#475569"],
    },
  },
  result: {
    summary: {
      cardClassName:
        "flex flex-col rounded-2xl border-cyan-300/40 bg-slate-950 overflow-hidden relative shadow-xl shadow-cyan-500/20",
      headerClassName:
        "border-b border-cyan-500/20 py-3 px-4 flex flex-row items-center justify-between bg-cyan-500/10",
      titleClassName: "flex items-center gap-2 text-cyan-300 text-sm",
      contentClassName:
        "p-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-black relative overflow-hidden",
      heroNameClassName: "text-sm font-semibold text-cyan-100 text-center line-clamp-2 max-w-[260px]",
      heroCaptionClassName: "text-[10px] font-mono text-cyan-200/60 text-center",
      distributionLabelClassName: "flex justify-between text-[10px] font-mono text-cyan-100/70",
      distributionTrackClassName: "h-1.5 bg-slate-800 rounded-full overflow-hidden",
      conclusionCardClassName:
        "rounded-lg border border-cyan-500/20 bg-cyan-950/10 p-2.5 space-y-1",
      conclusionMetaClassName: "text-[10px] text-cyan-100/70",
      quoteCardClassName: "mt-6 p-4 rounded-xl bg-cyan-950/15 border border-cyan-500/15 w-full",
      keyFactorClassName:
        "text-[10px] px-2 py-1 rounded-full bg-slate-800 text-cyan-100 border border-cyan-500/20",
      barPalette: ["#22d3ee", "#14b8a6", "#0ea5e9", "#f59e0b", "#64748b"],
    },
  },
};

export const DOMAIN_UI_THEME_ENTRIES: DomainUiTheme[] = [FENGSHUI_DOMAIN_UI_THEME];
