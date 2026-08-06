import { Helmet } from "react-helmet-async";
import { AuthShell } from "@/components/auth/AuthShell";
import { LoginForm } from "@/components/auth/LoginForm";

export default function Login() {
  return (
    <>
      <Helmet>
        <title>Sova Budget — Log in</title>
      </Helmet>
      <AuthShell showCardBrandIcon title="Welcome back" subtitle="Sign in to your account.">
        <LoginForm redirectTo="/dashboard" signupHref="/signup" />
      </AuthShell>
    </>
  );
}
