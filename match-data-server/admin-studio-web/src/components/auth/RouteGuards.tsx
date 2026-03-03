import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { isAuthenticated } from '@/src/lib/adminSession';

export function RequireAuth() {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function GuestOnly() {
  if (isAuthenticated()) {
    return <Navigate to="/app/dashboard" replace />;
  }
  return <Outlet />;
}
