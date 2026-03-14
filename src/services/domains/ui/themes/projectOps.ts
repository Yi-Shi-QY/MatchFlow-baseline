import type { DomainUiTheme } from '../themeTypes';

export const PROJECT_OPS_DOMAIN_UI_THEME: DomainUiTheme = {
  id: 'project_ops',
  result: {
    summary: {
      cardClassName:
        'flex flex-col border-[var(--mf-border)] bg-[linear-gradient(180deg,rgba(19,31,30,0.96),rgba(9,15,14,0.98))] overflow-hidden relative shadow-lg',
      headerClassName:
        'border-b border-[var(--mf-border)] py-3 px-4 flex flex-row items-center justify-between bg-[rgba(64,145,108,0.12)]',
    },
  },
};

export const DOMAIN_UI_THEME_ENTRIES: DomainUiTheme[] = [PROJECT_OPS_DOMAIN_UI_THEME];
