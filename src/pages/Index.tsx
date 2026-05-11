import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import PublicAuth from "@/pages/PublicAuth";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <PublicAuth />;
};

export default Index;
