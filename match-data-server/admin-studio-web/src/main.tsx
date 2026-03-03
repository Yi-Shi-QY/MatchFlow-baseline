import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { GuestOnly, RequireAuth } from '@/src/components/auth/RouteGuards';
import AppShell from '@/src/components/layout/AppShell';
import { isAuthenticated } from '@/src/lib/adminSession';
import '@/src/index.css';

const AppDashboard = lazy(() => import('@/src/pages/AppDashboard'));
const AdminStudio = lazy(() => import('@/src/pages/AdminStudio'));
const IdentityCenter = lazy(() => import('@/src/pages/IdentityCenter'));
const LoginPage = lazy(() => import('@/src/pages/LoginPage'));
const ReleaseCenterPage = lazy(() => import('@/src/pages/ReleaseCenterPage'));
const StudioSettingsPage = lazy(() => import('@/src/pages/StudioSettingsPage'));
const ValidationCenterPage = lazy(() => import('@/src/pages/ValidationCenterPage'));

const DatasourceDesignPage = lazy(() =>
  import('@/src/pages/workspaces/DatasourceWorkspacePages').then((module) => ({
    default: module.DatasourceDesignPage,
  })),
);
const DatasourceManagePage = lazy(() =>
  import('@/src/pages/workspaces/DatasourceWorkspacePages').then((module) => ({
    default: module.DatasourceManagePage,
  })),
);
const DatasourcePublishPage = lazy(() =>
  import('@/src/pages/workspaces/DatasourceWorkspacePages').then((module) => ({
    default: module.DatasourcePublishPage,
  })),
);

const PlanningTemplateDesignPage = lazy(() =>
  import('@/src/pages/workspaces/PlanningTemplateWorkspacePages').then((module) => ({
    default: module.PlanningTemplateDesignPage,
  })),
);
const PlanningTemplateManagePage = lazy(() =>
  import('@/src/pages/workspaces/PlanningTemplateWorkspacePages').then((module) => ({
    default: module.PlanningTemplateManagePage,
  })),
);
const PlanningTemplatePublishPage = lazy(() =>
  import('@/src/pages/workspaces/PlanningTemplateWorkspacePages').then((module) => ({
    default: module.PlanningTemplatePublishPage,
  })),
);

const AnimationTemplateDesignPage = lazy(() =>
  import('@/src/pages/workspaces/AnimationTemplateWorkspacePages').then((module) => ({
    default: module.AnimationTemplateDesignPage,
  })),
);
const AnimationTemplateManagePage = lazy(() =>
  import('@/src/pages/workspaces/AnimationTemplateWorkspacePages').then((module) => ({
    default: module.AnimationTemplateManagePage,
  })),
);
const AnimationTemplatePublishPage = lazy(() =>
  import('@/src/pages/workspaces/AnimationTemplateWorkspacePages').then((module) => ({
    default: module.AnimationTemplatePublishPage,
  })),
);

const AgentDesignPage = lazy(() =>
  import('@/src/pages/workspaces/AgentWorkspacePages').then((module) => ({
    default: module.AgentDesignPage,
  })),
);
const AgentManagePage = lazy(() =>
  import('@/src/pages/workspaces/AgentWorkspacePages').then((module) => ({
    default: module.AgentManagePage,
  })),
);
const AgentPublishPage = lazy(() =>
  import('@/src/pages/workspaces/AgentWorkspacePages').then((module) => ({
    default: module.AgentPublishPage,
  })),
);

const SkillDesignPage = lazy(() =>
  import('@/src/pages/workspaces/SkillWorkspacePages').then((module) => ({
    default: module.SkillDesignPage,
  })),
);
const SkillManagePage = lazy(() =>
  import('@/src/pages/workspaces/SkillWorkspacePages').then((module) => ({
    default: module.SkillManagePage,
  })),
);
const SkillPublishPage = lazy(() =>
  import('@/src/pages/workspaces/SkillWorkspacePages').then((module) => ({
    default: module.SkillPublishPage,
  })),
);

const DomainPackDesignPage = lazy(() =>
  import('@/src/pages/workspaces/DomainPackWorkspacePages').then((module) => ({
    default: module.DomainPackDesignPage,
  })),
);
const DomainPackManagePage = lazy(() =>
  import('@/src/pages/workspaces/DomainPackWorkspacePages').then((module) => ({
    default: module.DomainPackManagePage,
  })),
);
const DomainPackPublishPage = lazy(() =>
  import('@/src/pages/workspaces/DomainPackWorkspacePages').then((module) => ({
    default: module.DomainPackPublishPage,
  })),
);

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-300">
      <div className="text-sm">Loading workspace...</div>
    </div>
  );
}

function EntryRedirect() {
  return (
    <Navigate
      to={isAuthenticated() ? '/app/dashboard' : '/login'}
      replace
    />
  );
}

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<EntryRedirect />} />

          <Route element={<GuestOnly />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>

          <Route element={<RequireAuth />}>
            <Route path="/app" element={<AppShell />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AppDashboard />} />

              <Route path="datasources">
                <Route index element={<Navigate to="design" replace />} />
                <Route path="design" element={<DatasourceDesignPage />} />
                <Route path="manage" element={<DatasourceManagePage />} />
                <Route path="publish" element={<DatasourcePublishPage />} />
              </Route>
              <Route path="planning-templates">
                <Route index element={<Navigate to="design" replace />} />
                <Route path="design" element={<PlanningTemplateDesignPage />} />
                <Route path="manage" element={<PlanningTemplateManagePage />} />
                <Route path="publish" element={<PlanningTemplatePublishPage />} />
              </Route>
              <Route path="animation-templates">
                <Route index element={<Navigate to="design" replace />} />
                <Route path="design" element={<AnimationTemplateDesignPage />} />
                <Route path="manage" element={<AnimationTemplateManagePage />} />
                <Route path="publish" element={<AnimationTemplatePublishPage />} />
              </Route>
              <Route path="agents">
                <Route index element={<Navigate to="design" replace />} />
                <Route path="design" element={<AgentDesignPage />} />
                <Route path="manage" element={<AgentManagePage />} />
                <Route path="publish" element={<AgentPublishPage />} />
              </Route>
              <Route path="skills">
                <Route index element={<Navigate to="design" replace />} />
                <Route path="design" element={<SkillDesignPage />} />
                <Route path="manage" element={<SkillManagePage />} />
                <Route path="publish" element={<SkillPublishPage />} />
              </Route>
              <Route path="domain-packs">
                <Route index element={<Navigate to="design" replace />} />
                <Route path="design" element={<DomainPackDesignPage />} />
                <Route path="manage" element={<DomainPackManagePage />} />
                <Route path="publish" element={<DomainPackPublishPage />} />
              </Route>

              <Route path="identity" element={<IdentityCenter />} />
              <Route path="settings" element={<StudioSettingsPage />} />
              <Route path="validation-center" element={<ValidationCenterPage />} />
              <Route path="release-center" element={<ReleaseCenterPage />} />
            </Route>
          </Route>

          <Route path="/identity" element={<Navigate to="/app/identity" replace />} />
          <Route path="/studio" element={<Navigate to="/app/datasources/design" replace />} />
          <Route path="/legacy/studio" element={<AdminStudio />} />
          <Route path="*" element={<EntryRedirect />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
