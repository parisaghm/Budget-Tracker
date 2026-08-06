import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { hasSupabaseEnv, supabase, supabaseEnvError } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthPasswordField } from "@/components/auth/AuthShared";
import { Button } from "@/components/ui/button";

const MIN_PASSWORD_LENGTH = 8;

export default function UpdatePassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      setReady(true);
      return;
    }

    let mounted = true;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const search = typeof window !== "undefined" ? window.location.search : "";
    const urlMayContainRecovery =
      hash.includes("type=recovery") ||
      hash.includes("access_token") ||
      search.includes("code=") ||
      search.includes("token_hash=");

    const markReady = (sessionPresent: boolean) => {
      if (!mounted) return;
      setHasRecoverySession(sessionPresent);
      setReady(true);
    };

    const ensureSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      if (session) {
        markReady(true);
        return;
      }
      // Give detectSessionInUrl a moment when the link still has tokens in the URL.
      if (!urlMayContainRecovery) {
        markReady(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        markReady(Boolean(session));
        return;
      }
      if (event === "SIGNED_OUT") {
        setHasRecoverySession(false);
      }
    });

    void ensureSession();

    const timeoutId = window.setTimeout(() => {
      if (!mounted) return;
      void supabase.auth.getSession().then(({ data }) => {
        if (!mounted) return;
        setReady((already) => {
          if (already) return true;
          setHasRecoverySession(Boolean(data.session));
          return true;
        });
      });
    }, 2500);

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setError(null);

    if (!hasSupabaseEnv) {
      setError(supabaseEnvError ?? "Supabase env vars are missing.");
      return;
    }

    if (!hasRecoverySession) {
      setError("This password reset link is invalid or has expired.");
      return;
    }

    if (!password || !confirmPassword) {
      setError("Please enter and confirm your new password.");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters so your account stays protected.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Those passwords do not match yet. Try again when you are ready.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    toast.success("Password updated successfully.");
    navigate("/settings", { replace: true });
  };

  return (
    <AuthShell
      title="Choose a new password"
      subtitle={`Use at least ${MIN_PASSWORD_LENGTH} characters.`}
      footer={
        !hasRecoverySession && ready ? (
          <Link to="/login">Back to sign in</Link>
        ) : undefined
      }
    >
      {!ready ? (
        <p className="text-sm text-muted-foreground">Checking your reset link…</p>
      ) : !hasRecoverySession ? (
        <div className="space-y-4 text-left">
          <p className="text-sm text-destructive">
            This password reset link is invalid or has expired.
          </p>
          <Button asChild className="h-11 w-full rounded-lg font-semibold shadow-sm">
            <Link to="/forgot-password">Send a new reset link</Link>
          </Button>
          <Button asChild variant="outline" className="h-11 w-full rounded-lg font-semibold">
            <Link to="/login">Return to sign in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4 text-left">
          <div className="space-y-2">
            <label className="text-sm font-semibold" htmlFor="newPassword">
              New password
            </label>
            <AuthPasswordField
              id="newPassword"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold" htmlFor="confirmPassword">
              Confirm new password
            </label>
            <AuthPasswordField
              id="confirmPassword"
              autoComplete="new-password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <Button
            type="submit"
            className="h-11 w-full rounded-lg font-semibold shadow-sm"
            disabled={loading}
          >
            {loading ? "Saving..." : "Save new password"}
          </Button>

          <Button asChild variant="outline" className="h-11 w-full rounded-lg font-semibold" disabled={loading}>
            <Link to="/login">Cancel / Back to sign in</Link>
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
