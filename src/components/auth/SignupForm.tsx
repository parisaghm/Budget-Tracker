import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { hasSupabaseEnv, supabase, supabaseEnvError } from "@/lib/supabase/client";
import {
  AuthGoogleButton,
  AuthOrDivider,
  AuthPasswordField,
  authFieldClass,
} from "@/components/auth/AuthShared";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type SignupFormProps = {
  loginHref: string;
};

export function SignupForm({ loginHref }: SignupFormProps) {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!hasSupabaseEnv) {
      setError(supabaseEnvError ?? "Supabase env vars are missing.");
      return;
    }

    if (!email || !password || !confirmPassword) {
      setError("Please add email, password, and confirm password so we can create your space.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters so your account stays protected.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Those passwords do not match yet. Try again when you are ready.");
      return;
    }

    setLoading(true);
    let data, signupError;
    try {
      ({ data, error: signupError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: fullName ? { full_name: fullName.trim() } : undefined,
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      }));
    } catch {
      setLoading(false);
      setError(
        "We could not reach the server. Check your connection and try again when you are ready.",
      );
      return;
    }
    setLoading(false);

    if (signupError) {
      setError(signupError.message);
      return;
    }

    if (data.session) {
      navigate("/dashboard", { replace: true });
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (!signInError) {
      navigate("/dashboard", { replace: true });
      return;
    }

    const message = signInError.message.toLowerCase();
    if (message.includes("email not confirmed") || message.includes("not confirmed")) {
      setError(
        "This project still requires email confirmation before login. If you are setting things up, turn off “Confirm email” under Supabase → Authentication → Email—then new accounts can sign in right away.",
      );
      return;
    }

    setSuccess("Your space is ready. Log in when you are ready to continue.");
  };

  return (
    <div className="space-y-5">
      <AuthGoogleButton disabled={loading} onError={setError} />
      <AuthOrDivider />

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <label className="text-sm font-semibold" htmlFor="signup-fullName">
              Full name
            </label>
            <span className="text-xs font-normal text-muted-foreground">Optional</span>
          </div>
          <Input
            id="signup-fullName"
            autoComplete="name"
            placeholder="Jane Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={loading}
            className={authFieldClass}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor="signup-email">
            Email
          </label>
          <Input
            id="signup-email"
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
          <label className="text-sm font-semibold" htmlFor="signup-password">
            Password
          </label>
          <AuthPasswordField
            id="signup-password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor="signup-confirmPassword">
            Confirm password
          </label>
          <AuthPasswordField
            id="signup-confirmPassword"
            autoComplete="new-password"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p> : null}

        <Button
          type="submit"
          className="h-11 w-full rounded-xl text-sm font-semibold shadow-sm"
          disabled={loading}
        >
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to={loginHref} className="font-medium text-primary no-underline hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
