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
  sectionIconClassName: "text-[var(--mf-text-muted)]",
  cardClassName:
    "snap-center shrink-0 w-48 cursor-pointer active:scale-[0.98] transition-all border-[var(--mf-border)] bg-[var(--mf-surface-muted)] hover:bg-[var(--mf-surface)] overflow-hidden",
  activeCardClassName: "ring-1 ring-[var(--mf-accent)]",
  headerMetaClassName:
    "min-w-0 flex-1 text-[9px] text-[var(--mf-text-muted)] uppercase tracking-wider font-mono truncate",
  timestampClassName:
    "text-[9px] text-[var(--mf-text-muted)] font-mono flex items-center gap-1 whitespace-nowrap",
  deleteButtonClassName:
    "h-6 w-6 inline-flex items-center justify-center rounded-full border border-[var(--mf-border)] bg-[var(--mf-surface)] text-[var(--mf-text-muted)] hover:text-red-300 hover:bg-red-500/10 transition-colors",
  footerClassName: "mt-2 pt-2 border-t border-[var(--mf-border)]",
  activeStatusClassName: "text-[10px] text-[var(--mf-accent)] font-mono animate-pulse",
  completedStatusClassName: "text-[10px] text-[var(--mf-text-muted)] font-mono",
  distributionTrackClassName: "flex w-full h-1.5 rounded-full overflow-hidden",
  distributionLabelClassName:
    "flex justify-between text-[8px] text-[var(--mf-text-muted)] font-mono px-1",
  barPalette: ["#10b981", "#71717a", "#3b82f6", "#f59e0b", "#ef4444"],
};

const DEFAULT_SUMMARY_THEME: DomainResultSummaryTheme = {
  titleKey: "match.final_summary",
  cardClassName:
    "flex flex-col border-[var(--mf-border)] bg-[var(--mf-surface-strong)] overflow-hidden relative shadow-lg",
  headerClassName:
    "border-b border-[var(--mf-border)] py-3 px-4 flex flex-row items-center justify-between bg-[var(--mf-accent-soft)]",
  titleClassName: "flex items-center gap-2 text-[var(--mf-accent)] text-sm",
  contentClassName:
    "p-0 flex flex-col items-center justify-center bg-gradient-to-br from-[var(--mf-surface)] to-[var(--mf-bg)] relative overflow-hidden",
  heroNameClassName: "text-sm font-semibold text-[var(--mf-text)] text-center line-clamp-2 max-w-[260px]",
  heroCaptionClassName: "text-[10px] font-mono text-[var(--mf-text-muted)] text-center",
  distributionLabelClassName:
    "flex justify-between text-[10px] font-mono text-[var(--mf-text-muted)]",
  distributionTrackClassName: "h-1.5 bg-[var(--mf-surface)] rounded-full overflow-hidden",
  conclusionCardClassName:
    "rounded-lg border border-[var(--mf-border)] bg-[var(--mf-surface-muted)] p-2.5 space-y-1",
  conclusionMetaClassName: "text-[10px] text-[var(--mf-text-muted)]",
  quoteCardClassName:
    "mt-6 p-4 rounded-xl bg-[var(--mf-surface-muted)] border border-[var(--mf-border)] w-full",
  keyFactorClassName:
    "text-[10px] px-2 py-1 rounded-full bg-[var(--mf-surface)] text-[var(--mf-text)] border border-[var(--mf-border)]",
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
