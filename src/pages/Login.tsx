import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { hasSupabaseEnv, supabase, supabaseEnvError } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const target =
    (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasSupabaseEnv) {
      setError(supabaseEnvError ?? "Supabase env vars are missing.");
      return;
    }

    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    setLoading(true);
    let signInError;
    try {
      ({ error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      }));
    } catch (err) {
      setLoading(false);
      setError(
        "Unable to reach the server. Check your Supabase URL in .env and your internet connection.",
      );
      return;
    }
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    navigate(target, { replace: true });
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to your account to view your private budget data."
      footer={
        <>
          No account?{" "}
          <Link to="/signup" className="text-primary hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="email">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="password">
            Password
          </label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Logging in..." : "Log in"}
        </Button>

        <p className="text-sm">
          <Link to="/forgot-password" className="text-primary hover:underline">
            Forgot your password?
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
