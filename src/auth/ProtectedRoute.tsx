import React from 'react';
import { Navigate } from 'react-router-dom';
import { AccessRole, useAuth } from './AuthContext';

export default function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: AccessRole[] }) {
  const { loading, session, profile, profileError } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-sm">Validando sessão...</div>;
  if (!session) return <Navigate to="/login" replace/>;
  if (profileError) return <Navigate to="/acesso-negado" replace state={{ reason: profileError }}/>;
  if (!profile?.active || (roles && (!profile || !roles.includes(profile.role)))) return <Navigate to="/acesso-negado" replace/>;
  return <>{children}</>;
}
