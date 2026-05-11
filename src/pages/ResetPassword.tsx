import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { hasSupabaseEnv, supabase, supabaseEnvError } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ResetPassword() {
  const navigate = useNavigate();
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

    if (!password || !confirmPassword) {
      setError("Please enter and confirm your new password.");
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
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess("Password updated. Taking you to your dashboard...");
    setTimeout(() => navigate("/dashboard", { replace: true }), 1000);
  };

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Use at least 8 characters."
    >
      <form onSubmit={onSubmit} className="space-y-4 text-left">
        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor="newPassword">
            New password
          </label>
          <Input
            id="newPassword"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="h-11 rounded-lg border-border bg-background px-3 text-sm shadow-sm focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-0"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor="confirmPassword">
            Confirm password
          </label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            className="h-11 rounded-lg border-border bg-background px-3 text-sm shadow-sm focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:ring-offset-0"
          />
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

        <Button type="submit" className="h-11 w-full rounded-lg font-semibold shadow-sm" disabled={loading}>
          {loading ? "Saving..." : "Save new password"}
        </Button>
      </form>
    </AuthShell>
  );
}
