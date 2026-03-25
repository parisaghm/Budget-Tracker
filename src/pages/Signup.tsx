import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { hasSupabaseEnv, supabase, supabaseEnvError } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Signup() {
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
      setError("Email, password, and confirm password are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
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
    } catch (err) {
      setLoading(false);
      setError(
        "Unable to reach the server. Check your Supabase URL in .env and your internet connection.",
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

    setSuccess("Check your email to confirm your account, then log in.");
  };

  return (
    <AuthShell
      title="Create account"
      subtitle="Start tracking your budget with private, user-scoped data."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="fullName">
            Full name (optional)
          </label>
          <Input
            id="fullName"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={loading}
          />
        </div>

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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="confirmPassword">
            Confirm password
          </label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>
    </AuthShell>
  );
}
