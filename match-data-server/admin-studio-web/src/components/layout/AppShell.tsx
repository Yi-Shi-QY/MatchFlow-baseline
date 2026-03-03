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
import { getAuthLabel } from '@/src/lib/adminSession';
import { logoutAccount } from '@/src/services/adminStudio';
import {
  ADMIN_STUDIO_SETTINGS_UPDATED_EVENT,
  getSettings,
  saveSettings,
} from '@/src/services/settings';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/app/datasources', label: 'Data Sources', icon: Database },
  { to: '/app/planning-templates', label: 'Planning Templates', icon: LayoutTemplate },
  { to: '/app/animation-templates', label: 'Animation Templates', icon: Sparkles },
  { to: '/app/agents', label: 'Agents', icon: Bot },
  { to: '/app/skills', label: 'Skills', icon: Wand2 },
  { to: '/app/domain-packs', label: 'Domain Packs', icon: PackageCheck },
  { to: '/app/validation-center', label: 'Validation Center', icon: CheckCircle2 },
  { to: '/app/release-center', label: 'Release Center', icon: History },
  { to: '/app/identity', label: 'Identity Center', icon: ShieldCheck },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

export default function AppShell() {
  const navigate = useNavigate();
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
              Admin Studio
            </div>
            <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
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
                  {item.label}
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
              {isLoggingOut ? 'Signing out...' : 'Sign out'}
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
