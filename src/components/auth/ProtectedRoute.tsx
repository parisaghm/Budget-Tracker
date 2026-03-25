import { Navigate, useLocation } from "react-router-dom";
import type { ReactElement } from "react";
import { useAuth } from "@/context/AuthContext";

export function ProtectedRoute({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <p className="text-sm text-muted-foreground">Checking session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return children;
}
