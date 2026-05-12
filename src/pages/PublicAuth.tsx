import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";

export default function PublicAuth() {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") === "signup" ? "signup" : "login";

  if (mode === "signup") {
    return (
      <>
        <Helmet>
          <title>Sova Budget — Create account</title>
          <meta name="description" content="Create your Sova Budget account and start weekly budgeting." />
        </Helmet>
        <AuthShell
          showCardBrandIcon
          title="Create your account"
          subtitle="Start tracking your budget in under a minute."
        >
          <SignupForm loginHref="/?mode=login" />
        </AuthShell>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Sova Budget — Log in</title>
        <meta name="description" content="Sign in to Sova Budget for weekly spending clarity." />
      </Helmet>
      <AuthShell showCardBrandIcon title="Welcome back" subtitle="Sign in to your account.">
        <LoginForm redirectTo="/dashboard" signupHref="/?mode=signup" />
      </AuthShell>
    </>
  );
}
