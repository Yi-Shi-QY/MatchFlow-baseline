import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  resolveWorkspaceBackTarget,
  shouldReplacePrimaryWorkspaceNavigation,
} from './workspaceBackNavigation';

export function useWorkspaceNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const goBack = React.useCallback(
    (fallbackRoute?: string) => {
      const target = resolveWorkspaceBackTarget({
        pathname: location.pathname,
        state: location.state,
      });

      if (target) {
        navigate(target);
        return true;
      }

      if (fallbackRoute) {
        navigate(fallbackRoute);
        return true;
      }

      return false;
    },
    [location.pathname, location.state, navigate],
  );

  const openRoute = React.useCallback(
    (
      route: string,
      options?: {
        replace?: boolean;
        state?: Record<string, unknown>;
      },
    ) => {
      navigate(route, {
        replace:
          typeof options?.replace === 'boolean'
            ? options.replace
            : shouldReplacePrimaryWorkspaceNavigation(location.pathname, route),
        state: options?.state,
      });
    },
    [location.pathname, navigate],
  );

  const openPrimaryRoute = React.useCallback(
    (route: string) => {
      openRoute(route);
    },
    [openRoute],
  );

  return {
    navigate,
    location,
    goBack,
    openRoute,
    openPrimaryRoute,
  };
}
