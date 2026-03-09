import type { AnalysisDomain } from "../types";
import type {
  DomainHomeHistoryTheme,
  DomainResultSummaryTheme,
  DomainUiTheme,
  ResolvedDomainUiTheme,
} from "./themeTypes";

type DomainThemeModule = {
  DOMAIN_UI_THEME_ENTRIES?: DomainUiTheme[];
};

const DEFAULT_HISTORY_THEME: DomainHomeHistoryTheme = {
  sectionTitleKey: "home.history_analysis",
  sectionIconClassName: "text-zinc-400",
  cardClassName:
    "snap-center shrink-0 w-48 cursor-pointer active:scale-[0.98] transition-all border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-700 overflow-hidden",
  activeCardClassName: "ring-1 ring-emerald-500/50",
  headerMetaClassName: "min-w-0 flex-1 text-[9px] text-zinc-500 uppercase tracking-wider font-mono truncate",
  timestampClassName: "text-[9px] text-zinc-600 font-mono flex items-center gap-1 whitespace-nowrap",
  deleteButtonClassName:
    "h-6 w-6 inline-flex items-center justify-center rounded-full border border-white/10 bg-zinc-800/80 text-zinc-400 hover:text-red-300 hover:bg-red-500/10 transition-colors",
  footerClassName: "mt-2 pt-2 border-t border-white/5",
  activeStatusClassName: "text-[10px] text-emerald-400 font-mono animate-pulse",
  completedStatusClassName: "text-[10px] text-zinc-500 font-mono",
  distributionTrackClassName: "flex w-full h-1.5 rounded-full overflow-hidden",
  distributionLabelClassName: "flex justify-between text-[8px] text-zinc-500 font-mono px-1",
  barPalette: ["#10b981", "#71717a", "#3b82f6", "#f59e0b", "#ef4444"],
};

const DEFAULT_SUMMARY_THEME: DomainResultSummaryTheme = {
  titleKey: "match.final_summary",
  cardClassName:
    "flex flex-col border-emerald-500/30 bg-zinc-950 overflow-hidden relative shadow-lg shadow-emerald-500/10",
  headerClassName:
    "border-b border-white/5 py-3 px-4 flex flex-row items-center justify-between bg-emerald-500/10",
  titleClassName: "flex items-center gap-2 text-emerald-400 text-sm",
  contentClassName:
    "p-0 flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-black relative overflow-hidden",
  heroNameClassName: "text-sm font-semibold text-zinc-100 text-center line-clamp-2 max-w-[260px]",
  heroCaptionClassName: "text-[10px] font-mono text-zinc-500 text-center",
  distributionLabelClassName: "flex justify-between text-[10px] font-mono text-zinc-400",
  distributionTrackClassName: "h-1.5 bg-zinc-800 rounded-full overflow-hidden",
  conclusionCardClassName: "rounded-lg border border-white/10 bg-black/40 p-2.5 space-y-1",
  conclusionMetaClassName: "text-[10px] text-zinc-400",
  quoteCardClassName: "mt-6 p-4 rounded-xl bg-black/50 border border-white/5 w-full",
  keyFactorClassName: "text-[10px] px-2 py-1 rounded-full bg-zinc-800 text-zinc-300 border border-white/10",
  barPalette: ["#10b981", "#71717a", "#3b82f6", "#f59e0b", "#ef4444"],
};

function mergeDomainUiTheme(theme: DomainUiTheme): ResolvedDomainUiTheme {
  return {
    id: theme.id,
    home: {
      history: {
        ...DEFAULT_HISTORY_THEME,
        ...(theme.home?.history || {}),
        barPalette: theme.home?.history?.barPalette || DEFAULT_HISTORY_THEME.barPalette,
      },
    },
    result: {
      summary: {
        ...DEFAULT_SUMMARY_THEME,
        ...(theme.result?.summary || {}),
        barPalette: theme.result?.summary?.barPalette || DEFAULT_SUMMARY_THEME.barPalette,
      },
    },
  };
}

function collectBuiltinDomainUiThemes(): Record<string, ResolvedDomainUiTheme> {
  const modules = import.meta.glob("./themes/*.ts", { eager: true }) as Record<
    string,
    DomainThemeModule
  >;
  const entries = Object.entries(modules)
    .sort(([pathA], [pathB]) => pathA.localeCompare(pathB))
    .flatMap(([modulePath, module]) => {
      const themeEntries = Array.isArray(module.DOMAIN_UI_THEME_ENTRIES)
        ? module.DOMAIN_UI_THEME_ENTRIES
        : [];
      return themeEntries.map((theme) => ({ theme, modulePath }));
    });

  const themeMap: Record<string, ResolvedDomainUiTheme> = {};
  const sourceById: Record<string, string> = {};
  entries.forEach(({ theme, modulePath }) => {
    if (!theme || typeof theme.id !== "string" || theme.id.trim().length === 0) {
      return;
    }
    const themeId = theme.id.trim();
    if (themeMap[themeId]) {
      throw new Error(
        `[domains/ui] Duplicate domain theme id "${themeId}" in ${modulePath}. ` +
          `Already registered in ${sourceById[themeId]}.`,
      );
    }
    themeMap[themeId] = mergeDomainUiTheme(theme);
    sourceById[themeId] = modulePath;
  });

  return themeMap;
}

export const BUILTIN_DOMAIN_UI_THEMES: Record<string, ResolvedDomainUiTheme> =
  collectBuiltinDomainUiThemes();

function getFallbackDomainUiTheme(): ResolvedDomainUiTheme {
  return (
    BUILTIN_DOMAIN_UI_THEMES.football ||
    Object.values(BUILTIN_DOMAIN_UI_THEMES)[0] ||
    mergeDomainUiTheme({ id: "default" })
  );
}

export function assertBuiltinDomainUiTheme(domainId: string): void {
  if (!BUILTIN_DOMAIN_UI_THEMES[domainId]) {
    throw new Error(
      `Domain ${domainId} must export DOMAIN_UI_THEME_ENTRIES in domains/ui/themes/${domainId}.ts`,
    );
  }
}

export function getDomainUiTheme(domain: AnalysisDomain): ResolvedDomainUiTheme {
  return BUILTIN_DOMAIN_UI_THEMES[domain.id] || getFallbackDomainUiTheme();
}
