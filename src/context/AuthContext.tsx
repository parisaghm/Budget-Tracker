import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { hasSupabaseEnv, supabase } from "@/lib/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// Supabase's `onAuthStateChange` fires events like `TOKEN_REFRESHED` whenever
// the access token is rotated, which the SDK does proactively when the tab
// regains focus. Each callback hands us a brand new `Session`/`User` object
// reference even when the actual identity hasn't changed. If we naively call
// `setUser(nextUser)` every time, every consumer re-renders and any effect
// that lists `user` in its dependency array re-runs — which in this app means
// the dashboard reloads all of its data and shows a loading state. That looks
// to the user like the page refreshing every time they switch back to the tab.
//
// To prevent that, only update React state when something the rest of the app
// actually cares about (the user id or the access token) has changed.
function userIdentityEqual(a: User | null, b: User | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.id === b.id;
}

function sessionIdentityEqual(a: Session | null, b: Session | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.access_token === b.access_token &&
    a.refresh_token === b.refresh_token &&
    a.user?.id === b.user?.id
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasSupabaseEnv) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const applyAuthState = (nextSession: Session | null) => {
      const nextUser = nextSession?.user ?? null;
      setSession((prev) => (sessionIdentityEqual(prev, nextSession) ? prev : nextSession));
      setUser((prev) => (userIdentityEqual(prev, nextUser) ? prev : nextUser));
      setLoading(false);
    };

    const sync = async () => {
      try {
        const {
          data: { session: initialSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;
        applyAuthState(initialSession);
      } catch (error) {
        if (!mounted) return;
        console.error("Failed to restore auth session:", error);
        setSession(null);
        setUser(null);
        setLoading(false);
      }
    };

    void sync();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      applyAuthState(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
    }),
    [user, session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
