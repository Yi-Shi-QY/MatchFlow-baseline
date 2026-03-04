import React, { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Database,
  History,
  LayoutTemplate,
  LogOut,
  PackageCheck,
  Settings,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Button } from '@/src/components/ui/Button';
import { useI18n } from '@/src/i18n';
import { getAuthLabel } from '@/src/lib/adminSession';
import { logoutAccount } from '@/src/services/adminStudio';
import {
  ADMIN_STUDIO_SETTINGS_UPDATED_EVENT,
  getSettings,
  saveSettings,
} from '@/src/services/settings';

interface NavItem {
  to: string;
  labelEn: string;
  labelZh: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/app/datasources', labelEn: 'Data Sources', labelZh: '数据源', icon: Database },
  { to: '/app/planning-templates', labelEn: 'Planning Templates', labelZh: '规划模板', icon: LayoutTemplate },
  { to: '/app/animation-templates', labelEn: 'Animation Templates', labelZh: '动画模板', icon: Sparkles },
  { to: '/app/agents', labelEn: 'Agents', labelZh: '智能体', icon: Bot },
  { to: '/app/skills', labelEn: 'Skills', labelZh: '技能', icon: Wand2 },
  { to: '/app/domain-packs', labelEn: 'Domain Packs', labelZh: '领域包', icon: PackageCheck },
  { to: '/app/validation-center', labelEn: 'Validation Center', labelZh: '验证中心', icon: CheckCircle2 },
  { to: '/app/release-center', labelEn: 'Release Center', labelZh: '发布中心', icon: History },
  { to: '/app/identity', labelEn: 'Identity Center', labelZh: '身份中心', icon: ShieldCheck },
  { to: '/app/settings', labelEn: 'Settings', labelZh: '设置', icon: Settings },
];

export default function AppShell() {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useI18n();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [authLabel, setAuthLabel] = useState(() => getAuthLabel());

  useEffect(() => {
    const handleSettingsUpdated = () => setAuthLabel(getAuthLabel());
    window.addEventListener(ADMIN_STUDIO_SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
    return () => {
      window.removeEventListener(ADMIN_STUDIO_SETTINGS_UPDATED_EVENT, handleSettingsUpdated);
    };
  }, []);

  const subtitle = useMemo(() => authLabel, [authLabel]);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      const settings = getSettings();
      if (settings.authMode === 'account' && settings.accessToken.trim().length > 0) {
        await logoutAccount();
      } else {
        saveSettings({
          authMode: 'api_key',
          matchDataApiKey: '',
          authUser: null,
          accessToken: '',
          refreshToken: '',
          accessTokenExpiresAt: '',
          refreshTokenExpiresAt: '',
        });
      }
    } finally {
      setAuthLabel(getAuthLabel());
      setIsLoggingOut(false);
      navigate('/login', { replace: true });
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-black/40 p-4 lg:border-b-0 lg:border-r">
          <div className="mb-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <PackageCheck className="h-4 w-4 text-emerald-400" />
              {t('Admin Studio', '管理工作台')}
            </div>
            <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
            <div className="mt-2 flex items-center gap-1 rounded-lg border border-white/10 bg-zinc-900/70 p-1">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`flex-1 rounded px-2 py-1 text-[11px] transition ${
                  language === 'en'
                    ? 'bg-emerald-500/20 text-emerald-200'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage('zh')}
                className={`flex-1 rounded px-2 py-1 text-[11px] transition ${
                  language === 'zh'
                    ? 'bg-emerald-500/20 text-emerald-200'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                中文
              </button>
            </div>
          </div>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'text-zinc-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {language === 'zh' ? item.labelZh : item.labelEn}
                </NavLink>
              );
            })}
          </nav>
          <div className="mt-4 border-t border-white/10 pt-4">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
            >
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? t('Signing out...', '正在退出...') : t('Sign out', '退出登录')}
            </Button>
          </div>
        </aside>
        <main className="min-h-screen">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
