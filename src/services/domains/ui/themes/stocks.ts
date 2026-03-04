import type { DomainUiTheme } from "../themeTypes";

export const STOCKS_DOMAIN_UI_THEME: DomainUiTheme = {
  id: "stocks",
  home: {
    history: {
      cardClassName:
        "snap-center shrink-0 w-48 cursor-pointer active:scale-[0.98] transition-all rounded-xl border-sky-800/70 bg-slate-950/85 hover:bg-slate-950 hover:border-sky-500/70 overflow-hidden shadow-md shadow-sky-900/20",
      activeCardClassName: "ring-1 ring-sky-400/65",
      headerMetaClassName:
        "min-w-0 flex-1 text-[9px] text-sky-700 uppercase tracking-wider font-mono truncate",
      timestampClassName: "text-[9px] text-slate-500 font-mono flex items-center gap-1 whitespace-nowrap",
      footerClassName: "mt-2 pt-2 border-t border-sky-500/10",
      activeStatusClassName: "text-[10px] text-sky-300 font-mono animate-pulse",
      completedStatusClassName: "text-[10px] text-sky-100/75 font-mono",
      distributionLabelClassName: "flex justify-between text-[8px] text-sky-700 font-mono px-1",
      barPalette: ["#38bdf8", "#10b981", "#f59e0b", "#f43f5e", "#64748b"],
    },
  },
  result: {
    summary: {
      cardClassName:
        "flex flex-col rounded-xl border-sky-300/45 bg-slate-950 overflow-hidden relative shadow-xl shadow-sky-500/20",
      headerClassName:
        "border-b border-sky-500/20 py-3 px-4 flex flex-row items-center justify-between bg-sky-500/10",
      titleClassName: "flex items-center gap-2 text-sky-300 text-sm",
      contentClassName:
        "p-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-black relative overflow-hidden",
      heroNameClassName: "text-sm font-semibold text-sky-100 text-center line-clamp-2 max-w-[260px]",
      heroCaptionClassName: "text-[10px] font-mono text-sky-100/60 text-center",
      distributionLabelClassName: "flex justify-between text-[10px] font-mono text-sky-100/75",
      distributionTrackClassName: "h-1.5 bg-slate-800 rounded-full overflow-hidden",
      conclusionCardClassName:
        "rounded-lg border border-sky-500/20 bg-sky-950/10 p-2.5 space-y-1",
      conclusionMetaClassName: "text-[10px] text-sky-100/70",
      quoteCardClassName: "mt-6 p-4 rounded-xl bg-sky-950/15 border border-sky-500/20 w-full",
      keyFactorClassName:
        "text-[10px] px-2 py-1 rounded-full bg-slate-800 text-sky-100 border border-sky-500/20",
      barPalette: ["#38bdf8", "#10b981", "#f59e0b", "#f43f5e", "#64748b"],
    },
  },
};

export const DOMAIN_UI_THEME_ENTRIES: DomainUiTheme[] = [STOCKS_DOMAIN_UI_THEME];
