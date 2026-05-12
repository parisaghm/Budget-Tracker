import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default function Login() {
  const location = useLocation();
  const target =
    (location.state as { from?: string } | null)?.from ?? "/dashboard";

  return (
    <>
      <Helmet>
        <title>Sova Budget — Log in</title>
      </Helmet>
      <AuthShell showCardBrandIcon title="Welcome back" subtitle="Sign in to your account.">
        <LoginForm redirectTo={target} signupHref="/signup" />
      </AuthShell>
    </>
  );
}
