import { useState } from "react";
import { Link } from "react-router-dom";
import { hasSupabaseEnv, supabase, supabaseEnvError } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
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

    if (!email) {
      setError("Email is required.");
      return;
    }

    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/reset-password` },
    );
    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSuccess("Password reset link sent. Check your email.");
  };

  return (
    <AuthShell
      title="Forgot password"
      subtitle="We will email you a link to reset your password."
      footer={
        <Link to="/login" className="text-primary hover:underline">
          Back to login
        </Link>
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

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Sending..." : "Send reset link"}
        </Button>
      </form>
    </AuthShell>
  );
}
