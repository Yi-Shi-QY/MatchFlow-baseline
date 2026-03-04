import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/src/components/ui/Button';
import { Card, CardContent } from '@/src/components/ui/Card';
import { Select } from '@/src/components/ui/Select';
import { useI18n } from '@/src/i18n';
import {
  type AdminAuditLog,
  type AdminPermission,
  type AdminRole,
  AdminStudioApiError,
  type AdminUser,
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
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
}

function formatTime(value: string | null | undefined) {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function feedbackClass(tone: FeedbackTone) {
  if (tone === 'success') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  }
  if (tone === 'error') {
    return 'border-red-500/30 bg-red-500/10 text-red-300';
  }
  return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
}

export default function IdentityCenter() {
  const { t } = useI18n();
  const navigate = useNavigate();

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

  const userStatusOptions = useMemo(
    () => [
      { value: 'all', label: t('all status', '全部状态') },
      { value: 'active', label: t('active', '启用') },
      { value: 'disabled', label: t('disabled', '停用') },
    ],
    [t],
  );

  async function refreshAll() {
    setIsLoading(true);
    try {
      const [usersResult, rolesResult, permissionsResult, auditResult] = await Promise.all([
        listAdminUsers({
          search: userSearch.trim() || undefined,
          status: userStatusFilter === 'all' ? undefined : (userStatusFilter as 'active' | 'disabled'),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreateUser() {
    if (!newUserUsername.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      setFeedback({
        tone: 'error',
        message: t('username/email/password are required.', '用户名/邮箱/密码为必填。'),
      });
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
      setFeedback({ tone: 'success', message: t('User created.', '用户已创建。') });
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
      setFeedback({
        tone: 'error',
        message: t('role code/name are required.', '角色 code/name 为必填。'),
      });
      return;
    }
    setIsSaving(true);
    try {
      await createAdminRole({
        code: newRoleCode.trim(),
        name: newRoleName.trim(),
        permissionCodes: parseCsv(newRolePermissions),
      });
      setFeedback({ tone: 'success', message: t('Role created.', '角色已创建。') });
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
      setFeedback({
        tone: 'error',
        message: t('permission code/name are required.', '权限 code/name 为必填。'),
      });
      return;
    }
    setIsSaving(true);
    try {
      await createAdminPermission({
        code: newPermissionCode.trim(),
        name: newPermissionName.trim(),
      });
      setFeedback({ tone: 'success', message: t('Permission created.', '权限已创建。') });
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
      setFeedback({
        tone: 'error',
        message: t('userId is required for role binding.', '绑定角色时必须填写 userId。'),
      });
      return;
    }
    setIsSaving(true);
    try {
      await setAdminUserRoles(bindUserId.trim(), parseCsv(bindRoleCodes));
      setFeedback({ tone: 'success', message: t('User roles updated.', '用户角色已更新。') });
      await refreshAll();
    } catch (error) {
      setFeedback({ tone: 'error', message: summarizeError(error) });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBindRolePermissions() {
    if (!bindRoleId.trim()) {
      setFeedback({
        tone: 'error',
        message: t('roleId is required for permission binding.', '绑定权限时必须填写 roleId。'),
      });
      return;
    }
    setIsSaving(true);
    try {
      await setAdminRolePermissions(bindRoleId.trim(), parseCsv(bindPermissionCodes));
      setFeedback({ tone: 'success', message: t('Role permissions updated.', '角色权限已更新。') });
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
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => navigate('/app/dashboard')}
              >
                <ShieldCheck className="h-4 w-4" />
                {t('Workspace', '工作区')}
              </Button>
              <h1 className="text-base font-bold tracking-tight text-white">
                {t('Identity Center', '身份中心')}
              </h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => void refreshAll()}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {t('Refresh', '刷新')}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-4 pt-4 lg:grid-cols-[1fr_1fr]">
        {feedback && (
          <div className={`col-span-1 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs lg:col-span-2 ${feedbackClass(feedback.tone)}`}>
            {feedback.tone === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            {feedback.tone === 'error' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
        )}

        <Card className="border-zinc-800 bg-zinc-950">
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-white">{t('Users', '用户')}</h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_160px]">
              <input
                type="text"
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder={t('search users', '搜索用户')}
                className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
              <Select
                value={userStatusFilter}
                onChange={setUserStatusFilter}
                options={userStatusOptions}
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void refreshAll()}
              className="w-full"
              disabled={isLoading}
            >
              {t('Apply User Filter', '应用用户筛选')}
            </Button>

            <div className="max-h-[160px] space-y-1 overflow-auto rounded-lg border border-white/10 bg-zinc-900 p-2 text-[11px]">
              {users.map((item) => (
                <div
                  key={item.id}
                  className="rounded border border-white/10 bg-black/40 px-2 py-1.5"
                >
                  <div className="font-mono text-zinc-300">{item.id}</div>
                  <div className="text-zinc-400">{item.username} | {item.email}</div>
                  <div className="text-zinc-500">
                    {t('roles', '角色')}={(item.roles || []).join(', ') || '-'} | {item.status}
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <div className="rounded border border-dashed border-white/15 bg-black/30 px-2 py-2 text-zinc-500">
                  {t('No users found.', '未查询到用户。')}
                </div>
              )}
            </div>

            <input
              type="text"
              value={newUserUsername}
              onChange={(event) => setNewUserUsername(event.target.value)}
              placeholder={t('new username', '新用户名')}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <input
              type="text"
              value={newUserEmail}
              onChange={(event) => setNewUserEmail(event.target.value)}
              placeholder={t('new email', '新邮箱')}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <input
              type="password"
              value={newUserPassword}
              onChange={(event) => setNewUserPassword(event.target.value)}
              placeholder={t('new password', '新密码')}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <input
              type="text"
              value={newUserRoles}
              onChange={(event) => setNewUserRoles(event.target.value)}
              placeholder={t('role codes csv', '角色编码（逗号分隔）')}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <Button
              onClick={() => void handleCreateUser()}
              disabled={isSaving}
              className="w-full gap-2"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('Create User', '创建用户')}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950">
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-white">{t('Roles / Permissions', '角色 / 权限')}</h2>

            <div className="max-h-[160px] space-y-1 overflow-auto rounded-lg border border-white/10 bg-zinc-900 p-2 text-[11px]">
              {roles.map((item) => (
                <div
                  key={item.id}
                  className="rounded border border-white/10 bg-black/40 px-2 py-1.5"
                >
                  <div className="font-mono text-zinc-300">{item.id}</div>
                  <div className="text-zinc-400">{item.code} | {item.name}</div>
                  <div className="text-zinc-500">
                    {t('permissions', '权限')}={(item.permissions || []).join(', ') || '-'}
                  </div>
                </div>
              ))}
              {roles.length === 0 && (
                <div className="rounded border border-dashed border-white/15 bg-black/30 px-2 py-2 text-zinc-500">
                  {t('No roles found.', '未查询到角色。')}
                </div>
              )}
            </div>

            <input
              type="text"
              value={newRoleCode}
              onChange={(event) => setNewRoleCode(event.target.value)}
              placeholder={t('new role code', '新角色编码')}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <input
              type="text"
              value={newRoleName}
              onChange={(event) => setNewRoleName(event.target.value)}
              placeholder={t('new role name', '新角色名称')}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <input
              type="text"
              value={newRolePermissions}
              onChange={(event) => setNewRolePermissions(event.target.value)}
              placeholder={t('permission codes csv', '权限编码（逗号分隔）')}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <Button
              onClick={() => void handleCreateRole()}
              disabled={isSaving}
              className="w-full gap-2"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('Create Role', '创建角色')}
            </Button>

            <div className="max-h-[130px] space-y-1 overflow-auto rounded-lg border border-white/10 bg-zinc-900 p-2 text-[11px]">
              {permissions.map((item) => (
                <div
                  key={item.id}
                  className="rounded border border-white/10 bg-black/40 px-2 py-1.5"
                >
                  <div className="font-mono text-zinc-300">{item.code}</div>
                  <div className="text-zinc-500">{item.name}</div>
                </div>
              ))}
              {permissions.length === 0 && (
                <div className="rounded border border-dashed border-white/15 bg-black/30 px-2 py-2 text-zinc-500">
                  {t('No permissions found.', '未查询到权限。')}
                </div>
              )}
            </div>

            <input
              type="text"
              value={newPermissionCode}
              onChange={(event) => setNewPermissionCode(event.target.value)}
              placeholder={t('new permission code', '新权限编码')}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <input
              type="text"
              value={newPermissionName}
              onChange={(event) => setNewPermissionName(event.target.value)}
              placeholder={t('new permission name', '新权限名称')}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
            />
            <Button
              onClick={() => void handleCreatePermission()}
              disabled={isSaving}
              className="w-full gap-2"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('Create Permission', '创建权限')}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950 lg:col-span-2">
          <CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-white">{t('Bindings & Audit', '绑定与审计')}</h2>

            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-white/10 bg-zinc-900 p-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  {t('Bind User Roles', '绑定用户角色')}
                </div>
                <input
                  type="text"
                  value={bindUserId}
                  onChange={(event) => setBindUserId(event.target.value)}
                  placeholder="userId"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={bindRoleCodes}
                  onChange={(event) => setBindRoleCodes(event.target.value)}
                  placeholder={t('role codes csv', '角色编码（逗号分隔）')}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
                <Button
                  variant="secondary"
                  onClick={() => void handleBindUserRoles()}
                  disabled={isSaving}
                  className="w-full"
                >
                  {t('Set User Roles', '设置用户角色')}
                </Button>
              </div>

              <div className="space-y-2 rounded-lg border border-white/10 bg-zinc-900 p-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  {t('Bind Role Permissions', '绑定角色权限')}
                </div>
                <input
                  type="text"
                  value={bindRoleId}
                  onChange={(event) => setBindRoleId(event.target.value)}
                  placeholder="roleId"
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={bindPermissionCodes}
                  onChange={(event) => setBindPermissionCodes(event.target.value)}
                  placeholder={t('permission codes csv', '权限编码（逗号分隔）')}
                  className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
                />
                <Button
                  variant="secondary"
                  onClick={() => void handleBindRolePermissions()}
                  disabled={isSaving}
                  className="w-full"
                >
                  {t('Set Role Permissions', '设置角色权限')}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                type="text"
                value={auditAction}
                onChange={(event) => setAuditAction(event.target.value)}
                placeholder={t('audit action filter', '审计动作筛选')}
                className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
              <input
                type="text"
                value={auditActorUserId}
                onChange={(event) => setAuditActorUserId(event.target.value)}
                placeholder={t('audit actorUserId filter', '审计 actorUserId 筛选')}
                className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshAll()}
              className="w-full"
              disabled={isLoading}
            >
              {t('Apply Audit Filter', '应用审计筛选')}
            </Button>

            <div className="max-h-[220px] space-y-1 overflow-auto rounded-lg border border-white/10 bg-zinc-900 p-2 text-[11px]">
              {auditLogs.map((row) => (
                <div
                  key={row.id}
                  className="rounded border border-white/10 bg-black/40 px-2 py-1.5"
                >
                  <div className="font-mono text-zinc-300">{row.action}</div>
                  <div className="text-zinc-500">
                    {t('actor', '操作者')}={row.actorUsername || row.actorUserId || '-'} | {t('target', '目标')}=
                    {row.targetType || '-'}:{row.targetId || '-'}
                  </div>
                  <div className="text-zinc-500">{formatTime(row.createdAt)}</div>
                </div>
              ))}
              {auditLogs.length === 0 && (
                <div className="rounded border border-dashed border-white/15 bg-black/30 px-2 py-2 text-zinc-500">
                  {t('No audit logs found.', '未查询到审计日志。')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
