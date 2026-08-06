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
      setError("Add the email you use for Sova Budget so we can send the link.");
      return;
    }

    setLoading(true);
    const redirectTo = `${window.location.origin}/update-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo },
    );
    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSuccess("If that email is on file, you will get a reset link shortly. Check your inbox when you have a moment.");
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We’ll email you a link to choose a new password."
      footer={
        <Link to="/login">Back to log in</Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4 text-left">
        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor="email">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="h-11 rounded-lg border-border bg-background px-3 text-sm shadow-sm focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-0"
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

        <Button type="submit" className="h-11 w-full rounded-lg font-semibold shadow-sm" disabled={loading}>
          {loading ? "Sending link..." : "Email me a reset link"}
        </Button>
      </form>
    </AuthShell>
  );
}
