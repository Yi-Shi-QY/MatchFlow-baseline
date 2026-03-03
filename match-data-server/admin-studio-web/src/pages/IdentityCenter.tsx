import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Select } from '@/src/components/ui/Select';
import {
  AdminAuditLog,
  AdminPermission,
  AdminRole,
  AdminStudioApiError,
  AdminUser,
  createAdminPermission,
  createAdminRole,
  createAdminUser,
  listAdminAuditLogs,
  listAdminPermissions,
  listAdminRoles,
  listAdminUsers,
  setAdminRolePermissions,
  setAdminUserRoles,
} from '@/src/services/adminStudio';
import { getSettings, saveSettings } from '@/src/services/settings';

type FeedbackTone = 'success' | 'error' | 'info';

function parseCsv(input: string): string[] {
  return Array.from(
    new Set(
      String(input || '')
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    ),
  );
}

function summarizeError(error: unknown): string {
  if (error instanceof AdminStudioApiError) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Unknown error';
}

function formatTime(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export default function IdentityCenter() {
  const navigate = useNavigate();
  const settings = getSettings();

  const [serverUrlInput, setServerUrlInput] = useState(settings.matchDataServerUrl);
  const [apiKeyInput, setApiKeyInput] = useState(settings.matchDataApiKey);
  const [feedback, setFeedback] = useState<{ tone: FeedbackTone; message: string } | null>(null);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [userSearch, setUserSearch] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [auditAction, setAuditAction] = useState('');
  const [auditActorUserId, setAuditActorUserId] = useState('');

  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRoles, setNewUserRoles] = useState('');

  const [newRoleCode, setNewRoleCode] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newRolePermissions, setNewRolePermissions] = useState('');

  const [newPermissionCode, setNewPermissionCode] = useState('');
  const [newPermissionName, setNewPermissionName] = useState('');

  const [bindUserId, setBindUserId] = useState('');
  const [bindRoleCodes, setBindRoleCodes] = useState('');
  const [bindRoleId, setBindRoleId] = useState('');
  const [bindPermissionCodes, setBindPermissionCodes] = useState('');

  async function refreshAll() {
    setIsLoading(true);
    try {
      const [usersResult, rolesResult, permissionsResult, auditResult] = await Promise.all([
        listAdminUsers({
          search: userSearch.trim() || undefined,
          status:
            userStatusFilter === 'all'
              ? undefined
              : (userStatusFilter as 'active' | 'disabled'),
          limit: 100,
        }),
        listAdminRoles(),
        listAdminPermissions(),
        listAdminAuditLogs({
          action: auditAction.trim() || undefined,
          actorUserId: auditActorUserId.trim() || undefined,
          limit: 100,
        }),
      ]);
      setUsers(usersResult.data || []);
      setRoles(rolesResult.data || []);
      setPermissions(permissionsResult.data || []);
      setAuditLogs(auditResult.data || []);
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshAll();
  }, []);

  function handleSaveConnection() {
    saveSettings({
      matchDataServerUrl: serverUrlInput.trim(),
      matchDataApiKey: apiKeyInput.trim(),
    });
    setFeedback({ tone: 'success', message: 'Connection settings saved.' });
  }

  async function handleCreateUser() {
    if (!newUserUsername.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      setFeedback({ tone: 'error', message: 'username/email/password are required.' });
      return;
    }
    setIsSaving(true);
    try {
      await createAdminUser({
        username: newUserUsername.trim(),
        email: newUserEmail.trim(),
        password: newUserPassword,
        roleCodes: parseCsv(newUserRoles),
      });
      setFeedback({ tone: 'success', message: 'User created.' });
      setNewUserUsername('');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRoles('');
      await refreshAll();
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateRole() {
    if (!newRoleCode.trim() || !newRoleName.trim()) {
      setFeedback({ tone: 'error', message: 'role code/name are required.' });
      return;
    }
    setIsSaving(true);
    try {
      await createAdminRole({
        code: newRoleCode.trim(),
        name: newRoleName.trim(),
        permissionCodes: parseCsv(newRolePermissions),
      });
      setFeedback({ tone: 'success', message: 'Role created.' });
      setNewRoleCode('');
      setNewRoleName('');
      setNewRolePermissions('');
      await refreshAll();
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreatePermission() {
    if (!newPermissionCode.trim() || !newPermissionName.trim()) {
      setFeedback({ tone: 'error', message: 'permission code/name are required.' });
      return;
    }
    setIsSaving(true);
    try {
      await createAdminPermission({
        code: newPermissionCode.trim(),
        name: newPermissionName.trim(),
      });
      setFeedback({ tone: 'success', message: 'Permission created.' });
      setNewPermissionCode('');
      setNewPermissionName('');
      await refreshAll();
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBindUserRoles() {
    if (!bindUserId.trim()) {
      setFeedback({ tone: 'error', message: 'userId is required for role binding.' });
      return;
    }
    setIsSaving(true);
    try {
      await setAdminUserRoles(bindUserId.trim(), parseCsv(bindRoleCodes));
      setFeedback({ tone: 'success', message: 'User roles updated.' });
      await refreshAll();
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBindRolePermissions() {
    if (!bindRoleId.trim()) {
      setFeedback({ tone: 'error', message: 'roleId is required for permission binding.' });
      return;
    }
    setIsSaving(true);
    try {
      await setAdminRolePermissions(bindRoleId.trim(), parseCsv(bindPermissionCodes));
      setFeedback({ tone: 'success', message: 'Role permissions updated.' });
      await refreshAll();
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-black pb-10 font-sans text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/85 px-4 pb-4 pt-4 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/')}>
                <ShieldCheck className="h-4 w-4" />
                Catalog Studio
              </Button>
              <h1 className="text-base font-bold tracking-tight text-white">Identity Center</h1>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => void refreshAll()}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-[1fr_1fr_auto]">
            <input type="text" value={serverUrlInput} onChange={(event) => setServerUrlInput(event.target.value)} placeholder="Server URL" className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none" />
            <input type="password" value={apiKeyInput} onChange={(event) => setApiKeyInput(event.target.value)} placeholder="API Key" className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none" />
            <Button variant="secondary" size="sm" onClick={handleSaveConnection}>Save Connection</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-4 pt-4 lg:grid-cols-[1fr_1fr]">
        {feedback && (
          <div className={`col-span-1 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs lg:col-span-2 ${feedback.tone === 'success' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : feedback.tone === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-blue-500/30 bg-blue-500/10 text-blue-300'}`}>
            {feedback.tone === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            {feedback.tone === 'error' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}
        <Card className="border-zinc-800 bg-zinc-950"><CardContent className="space-y-3 p-4"><h2 className="text-sm font-semibold text-white">Users</h2><div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px]"><input type="text" value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="search users" className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none" /><Select value={userStatusFilter} onChange={setUserStatusFilter} options={[{ value: 'all', label: 'all status' }, { value: 'active', label: 'active' }, { value: 'disabled', label: 'disabled' }]} /></div><Button variant="secondary" size="sm" onClick={() => void refreshAll()} className="w-full">Apply User Filter</Button><div className="max-h-[160px] space-y-1 overflow-auto rounded-lg border border-white/10 bg-zinc-900 p-2 text-[11px]">{users.map((item) => <div key={item.id} className="rounded border border-white/10 bg-black/40 px-2 py-1.5"><div className="font-mono text-zinc-300">{item.id}</div><div className="text-zinc-400">{item.username} | {item.email}</div><div className="text-zinc-500">roles={(item.roles || []).join(', ') || '-'} | {item.status}</div></div>)}</div><input type="text" value={newUserUsername} onChange={(event) => setNewUserUsername(event.target.value)} placeholder="new username" className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none" /><input type="text" value={newUserEmail} onChange={(event) => setNewUserEmail(event.target.value)} placeholder="new email" className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none" /><input type="password" value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} placeholder="new password" className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none" /><input type="text" value={newUserRoles} onChange={(event) => setNewUserRoles(event.target.value)} placeholder="role codes csv" className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none" /><Button onClick={() => void handleCreateUser()} disabled={isSaving} className="w-full">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create User'}</Button></CardContent></Card>
        <Card className="border-zinc-800 bg-zinc-950"><CardContent className="space-y-3 p-4"><h2 className="text-sm font-semibold text-white">Roles / Permissions</h2><div className="max-h-[160px] space-y-1 overflow-auto rounded-lg border border-white/10 bg-zinc-900 p-2 text-[11px]">{roles.map((item) => <div key={item.id} className="rounded border border-white/10 bg-black/40 px-2 py-1.5"><div className="font-mono text-zinc-300">{item.id}</div><div className="text-zinc-400">{item.code} | {item.name}</div><div className="text-zinc-500">permissions={(item.permissions || []).join(', ') || '-'}</div></div>)}</div><input type="text" value={newRoleCode} onChange={(event) => setNewRoleCode(event.target.value)} placeholder="new role code" className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none" /><input type="text" value={newRoleName} onChange={(event) => setNewRoleName(event.target.value)} placeholder="new role name" className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none" /><input type="text" value={newRolePermissions} onChange={(event) => setNewRolePermissions(event.target.value)} placeholder="permission codes csv" className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none" /><Button onClick={() => void handleCreateRole()} disabled={isSaving} className="w-full">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Role'}</Button><div className="max-h-[130px] space-y-1 overflow-auto rounded-lg border border-white/10 bg-zinc-900 p-2 text-[11px]">{permissions.map((item) => <div key={item.id} className="rounded border border-white/10 bg-black/40 px-2 py-1.5"><div className="font-mono text-zinc-300">{item.code}</div><div className="text-zinc-500">{item.name}</div></div>)}</div><input type="text" value={newPermissionCode} onChange={(event) => setNewPermissionCode(event.target.value)} placeholder="new permission code" className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none" /><input type="text" value={newPermissionName} onChange={(event) => setNewPermissionName(event.target.value)} placeholder="new permission name" className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none" /><Button onClick={() => void handleCreatePermission()} disabled={isSaving} className="w-full">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Permission'}</Button></CardContent></Card>
        <Card className="border-zinc-800 bg-zinc-950 lg:col-span-2"><CardContent className="space-y-3 p-4"><h2 className="text-sm font-semibold text-white">Bindings & Audit</h2><div className="grid grid-cols-1 gap-2 lg:grid-cols-2"><div className="space-y-2 rounded-lg border border-white/10 bg-zinc-900 p-3"><div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Bind User Roles</div><input type="text" value={bindUserId} onChange={(event) => setBindUserId(event.target.value)} placeholder="userId" className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none" /><input type="text" value={bindRoleCodes} onChange={(event) => setBindRoleCodes(event.target.value)} placeholder="role codes csv" className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none" /><Button variant="secondary" onClick={() => void handleBindUserRoles()} disabled={isSaving} className="w-full">Set User Roles</Button></div><div className="space-y-2 rounded-lg border border-white/10 bg-zinc-900 p-3"><div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Bind Role Permissions</div><input type="text" value={bindRoleId} onChange={(event) => setBindRoleId(event.target.value)} placeholder="roleId" className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none" /><input type="text" value={bindPermissionCodes} onChange={(event) => setBindPermissionCodes(event.target.value)} placeholder="permission codes csv" className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none" /><Button variant="secondary" onClick={() => void handleBindRolePermissions()} disabled={isSaving} className="w-full">Set Role Permissions</Button></div></div><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><input type="text" value={auditAction} onChange={(event) => setAuditAction(event.target.value)} placeholder="audit action filter" className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none" /><input type="text" value={auditActorUserId} onChange={(event) => setAuditActorUserId(event.target.value)} placeholder="audit actorUserId filter" className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none" /></div><Button variant="outline" size="sm" onClick={() => void refreshAll()} className="w-full">Apply Audit Filter</Button><div className="max-h-[220px] space-y-1 overflow-auto rounded-lg border border-white/10 bg-zinc-900 p-2 text-[11px]">{auditLogs.map((row) => <div key={row.id} className="rounded border border-white/10 bg-black/40 px-2 py-1.5"><div className="font-mono text-zinc-300">{row.action}</div><div className="text-zinc-500">actor={row.actorUsername || row.actorUserId || '-'} | target={row.targetType || '-'}:{row.targetId || '-'}</div><div className="text-zinc-500">{formatTime(row.createdAt)}</div></div>)}</div></CardContent></Card>
      </main>
    </div>
  );
}
