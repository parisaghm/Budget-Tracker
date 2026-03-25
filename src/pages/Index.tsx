import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
};

export default Index;
