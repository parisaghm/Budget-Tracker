import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export const DEMO_SESSION_KEY = "bt_demo_mode";

type DemoContextValue = {
  isDemoMode: boolean;
  enterDemo: () => void;
  exitDemo: () => void;
};

const DemoContext = createContext<DemoContextValue | undefined>(undefined);

function readDemoFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(DEMO_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isDemoMode, setIsDemoMode] = useState(readDemoFlag);

  useEffect(() => {
    if (!user) return;
    setIsDemoMode(false);
    try {
      sessionStorage.removeItem(DEMO_SESSION_KEY);
    } catch {
      // ignore
    }
  }, [user]);

  const enterDemo = useCallback(() => {
    try {
      sessionStorage.setItem(DEMO_SESSION_KEY, "1");
    } catch {
      // private mode — session still works via React state for this navigation
    }
    setIsDemoMode(true);
    navigate("/dashboard", { replace: true });
  }, [navigate]);

  const exitDemo = useCallback(() => {
    try {
      sessionStorage.removeItem(DEMO_SESSION_KEY);
    } catch {
      // ignore
    }
    setIsDemoMode(false);
    navigate("/", { replace: true });
  }, [navigate]);

  const value = useMemo(
    () => ({
      isDemoMode,
      enterDemo,
      exitDemo,
    }),
    [isDemoMode, enterDemo, exitDemo],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) {
    throw new Error("useDemo must be used within DemoProvider");
  }
  return ctx;
}
