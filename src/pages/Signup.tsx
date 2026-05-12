import { Helmet } from "react-helmet-async";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";

export default function Signup() {
  return (
    <>
      <Helmet>
        <title>Sova Budget — Create account</title>
      </Helmet>
      <AuthShell
        showCardBrandIcon
        title="Create your account"
        subtitle="Start tracking your budget in under a minute."
      >
        <SignupForm loginHref="/login" />
      </AuthShell>
    </>
  );
}
