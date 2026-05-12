import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { hasSupabaseEnv, supabase, supabaseEnvError } from "@/lib/supabase/client";

const FALLBACK_TARGET = "/dashboard";

function sanitizeNextPath(candidate: string | null) {
  if (!candidate) return FALLBACK_TARGET;
  return candidate.startsWith("/") ? candidate : FALLBACK_TARGET;
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const nextPath = useMemo(
    () => sanitizeNextPath(new URLSearchParams(location.search).get("next")),
    [location.search],
  );

  useEffect(() => {
    const completeOAuth = async () => {
      if (!hasSupabaseEnv) {
        setError(supabaseEnvError ?? "Supabase env vars are missing.");
        setLoading(false);
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const oauthError = params.get("error_description") ?? params.get("error");
      const code = params.get("code");

      if (oauthError) {
        setError(decodeURIComponent(oauthError));
        setLoading(false);
        return;
      }

      try {
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            throw exchangeError;
          }
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session) {
          throw new Error("No active session found after Google sign-in.");
        }

        navigate(nextPath, { replace: true });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not complete Google sign-in. Please try again.";
        setError(message);
        setLoading(false);
      }
    };

    void completeOAuth();
  }, [navigate, nextPath]);

  return (
    <>
      <Helmet>
        <title>Sova Budget — Finishing sign-in</title>
      </Helmet>
      <AuthShell title="Finishing sign-in" subtitle="Completing your Google login securely.">
        <div className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Finalizing authentication...</p>
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {!loading && error ? (
            <Button asChild className="h-11 w-full rounded-xl text-sm font-semibold shadow-sm">
              <Link to="/login">Back to login</Link>
            </Button>
          ) : null}
        </div>
      </AuthShell>
    </>
  );
}
