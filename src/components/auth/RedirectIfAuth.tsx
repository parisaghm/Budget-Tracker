import { Navigate } from "react-router-dom";
import type { ReactElement } from "react";
import { useAuth } from "@/context/AuthContext";

export function RedirectIfAuth({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
