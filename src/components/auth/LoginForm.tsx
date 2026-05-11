import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { hasSupabaseEnv, supabase, supabaseEnvError } from "@/lib/supabase/client";
import { AuthGoogleButton, AuthOrDivider, authFieldClass } from "@/components/auth/AuthShared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type LoginFormProps = {
  redirectTo: string;
  signupHref: string;
};

export function LoginForm({ redirectTo, signupHref }: LoginFormProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasSupabaseEnv) {
      setError(supabaseEnvError ?? "Supabase env vars are missing.");
      return;
    }

    if (!email || !password) {
      setError("Please add your email and password so we can sign you in.");
      return;
    }

    setLoading(true);
    let signInError;
    try {
      ({ error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      }));
    } catch {
      setLoading(false);
      setError(
        "We could not reach the server. Check your connection and try again when you are ready.",
      );
      return;
    }
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="space-y-5">
      <AuthGoogleButton
        disabled={loading}
        redirectTo={redirectTo}
        onStart={() => setError(null)}
        onError={setError}
      />
      <AuthOrDivider />

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor="login-email">
            Email
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className={authFieldClass}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor="login-password">
            Password
          </label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className={authFieldClass}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button
          type="submit"
          className="h-11 w-full rounded-xl text-sm font-semibold shadow-sm"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Log in"}
        </Button>

        <p className="text-center text-sm">
          <Link
            to="/forgot-password"
            className="text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </p>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link to={signupHref} className="font-medium text-primary no-underline hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
