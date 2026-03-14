import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Brain,
  Bot,
  Database,
  History as HistoryIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  SquareKanban,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { cn } from '@/src/lib/utils';
import {
  getPrimaryWorkspaceNav,
  type WorkspaceNavId,
} from '@/src/services/navigation/workspaceNav';
import { useWorkspaceNavigation } from '@/src/services/navigation/useWorkspaceNavigation';

interface WorkspaceShellProps {
  language: 'zh' | 'en';
  section: WorkspaceNavId;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  contentClassName?: string;
  hideHeader?: boolean;
}

const navIconMap = {
  chat: Bot,
  tasks: SquareKanban,
  sources: Database,
  history: HistoryIcon,
  memory: Brain,
  settings: Settings,
} satisfies Record<string, React.ComponentType<{ className?: string }>>;

export function WorkspaceShell({
  language,
  section,
  title,
  subtitle,
  children,
  headerActions,
  contentClassName,
  hideHeader = false,
}: WorkspaceShellProps) {
  const { openPrimaryRoute } = useWorkspaceNavigation();
  const { t } = useTranslation();
  const [navOpen, setNavOpen] = React.useState(false);
  const navItems = React.useMemo(() => getPrimaryWorkspaceNav(), []);
  const copy = React.useMemo(
    () => ({
      open: t('workspace.shell.open_sidebar', {
        defaultValue: language === 'zh' ? '展开侧栏' : 'Open sidebar',
      }),
      close: t('workspace.shell.close_sidebar', {
        defaultValue: language === 'zh' ? '收起侧栏' : 'Close sidebar',
      }),
      brand: t('workspace.shell.brand', {
        defaultValue: language === 'zh' ? 'MatchFlow 工作区' : 'MatchFlow Workspace',
      }),
      mobile: t('workspace.shell.mobile', {
        defaultValue: language === 'zh' ? '移动工作区' : 'Mobile Workspace',
      }),
    }),
    [language, t],
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[var(--mf-bg)] text-[var(--mf-text)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-6rem] h-72 w-72 rounded-full bg-[var(--mf-accent-soft)] blur-3xl" />
        <div className="absolute bottom-[-8rem] right-[-10%] h-80 w-80 rounded-full bg-white/5 blur-3xl" />
      </div>

      <Button
        variant="secondary"
        size="icon"
        className="fixed left-3 top-[calc(1rem+env(safe-area-inset-top))] z-40 h-11 w-11 rounded-2xl border border-[var(--mf-border)] bg-[var(--mf-surface)]/95 shadow-lg backdrop-blur-md"
        aria-label={navOpen ? copy.close : copy.open}
        onClick={() => setNavOpen((prev) => !prev)}
      >
        {navOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
      </Button>

      {navOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={() => setNavOpen(false)}
          aria-label={copy.close}
        />
      ) : null}

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-full w-[17rem] flex-col border-r border-[var(--mf-border)] bg-[var(--mf-surface)]/96 px-3 pb-4 pt-[calc(1rem+env(safe-area-inset-top)+3.25rem)] shadow-2xl backdrop-blur-xl transition-transform duration-200',
          navOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="rounded-2xl border border-[var(--mf-border)] bg-[var(--mf-surface-strong)] px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
            {copy.brand}
          </div>
          <div className="mt-2 text-sm font-semibold text-[var(--mf-text)]">{title}</div>
          <div className="mt-1 text-xs leading-relaxed text-[var(--mf-text-muted)]">{subtitle}</div>
        </div>

        <nav className="mt-4 space-y-2">
          {navItems.map((item) => {
            const Icon = navIconMap[item.iconKey] ?? Settings;
            const active = item.id === section;
            return (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-colors',
                  active
                    ? 'border-[var(--mf-accent)] bg-[var(--mf-accent-soft)] text-[var(--mf-text)]'
                    : 'border-[var(--mf-border)] bg-[var(--mf-surface-strong)] text-[var(--mf-text-muted)] hover:bg-[var(--mf-surface-muted)]',
                )}
                onClick={() => {
                  openPrimaryRoute(item.route);
                  setNavOpen(false);
                }}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/20">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">{t(item.titleKey)}</div>
                  <div className="text-[11px] text-[var(--mf-text-muted)]">{t(item.hintKey)}</div>
                </div>
              </button>
            );
          })}
        </nav>
      </aside>

      <div
        className={cn(
          'relative z-10 px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]',
          hideHeader ? 'min-h-screen' : '',
        )}
      >
        {!hideHeader ? (
          <header className="mx-auto flex max-w-md items-start justify-between gap-3 rounded-[1.75rem] border border-[var(--mf-border)] bg-[var(--mf-surface)]/88 px-4 py-4 pl-14 shadow-lg backdrop-blur-xl">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--mf-text-muted)]">
                {copy.mobile}
              </div>
              <h1 className="mt-2 text-lg font-semibold tracking-tight text-[var(--mf-text)]">
                {title}
              </h1>
              <p className="mt-1 text-xs leading-relaxed text-[var(--mf-text-muted)]">
                {subtitle}
              </p>
            </div>
            {headerActions ? <div className="flex shrink-0 items-center gap-2">{headerActions}</div> : null}
          </header>
        ) : null}

        <main
          className={cn(
            'mx-auto flex max-w-md flex-col gap-5',
            hideHeader ? 'min-h-screen pt-0' : 'mt-5',
            contentClassName,
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
