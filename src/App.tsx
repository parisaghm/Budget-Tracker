import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { lazy, Suspense } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { DemoProvider } from "@/context/DemoContext";
import { FinanceDataProvider } from "@/hooks/useSupabaseFinanceData";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RedirectIfAuth } from "@/components/auth/RedirectIfAuth";
import { RequireOnboarding } from "@/components/auth/RequireOnboarding";

const Index = lazy(() => import("./pages/Index"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Report = lazy(() => import("./pages/Report"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Login = lazy(() => import("./pages/Login"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));
const OnboardingPage = lazy(() => import("./pages/Onboarding"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const BillsPage = lazy(() => import("./pages/Bills"));
const CyclePage = lazy(() => import("./pages/Cycle"));
const BudgetPage = lazy(() => import("./pages/Budget"));
const ExpensesPage = lazy(() => import("./pages/Expenses"));
const GoalsPage = lazy(() => import("./pages/Goals"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="grid min-h-screen place-items-center bg-background">
    <div className="card-elevated w-[min(420px,92vw)] space-y-3 p-6">
      <div className="h-5 w-1/2 animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-full animate-pulse rounded-md bg-muted" />
      <div className="h-4 w-4/5 animate-pulse rounded-md bg-muted" />
    </div>
  </div>
);

const App = () => (
  <HelmetProvider>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <DemoProvider>
              <FinanceDataProvider>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute>
                        <RequireOnboarding>
                          <Dashboard />
                        </RequireOnboarding>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/report/:monthKey"
                    element={
                      <ProtectedRoute>
                        <RequireOnboarding>
                          <Report />
                        </RequireOnboarding>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute>
                        <RequireOnboarding>
                          <SettingsPage />
                        </RequireOnboarding>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/budget"
                    element={
                      <ProtectedRoute>
                        <RequireOnboarding>
                          <BudgetPage />
                        </RequireOnboarding>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/expenses"
                    element={
                      <ProtectedRoute>
                        <RequireOnboarding>
                          <ExpensesPage />
                        </RequireOnboarding>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/goals"
                    element={
                      <ProtectedRoute>
                        <RequireOnboarding>
                          <GoalsPage />
                        </RequireOnboarding>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/bills"
                    element={
                      <ProtectedRoute>
                        <RequireOnboarding>
                          <BillsPage />
                        </RequireOnboarding>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/cycle"
                    element={
                      <ProtectedRoute>
                        <RequireOnboarding>
                          <CyclePage />
                        </RequireOnboarding>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/weekly-review"
                    element={<Navigate to="/cycle" replace />}
                  />
                  <Route
                    path="/onboarding"
                    element={
                      <ProtectedRoute>
                        <OnboardingPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/login"
                    element={
                      <RedirectIfAuth>
                        <Login />
                      </RedirectIfAuth>
                    }
                  />
                  <Route
                    path="/auth/callback"
                    element={<AuthCallback />}
                  />
                  <Route
                    path="/signup"
                    element={
                      <RedirectIfAuth>
                        <Signup />
                      </RedirectIfAuth>
                    }
                  />
                  <Route
                    path="/forgot-password"
                    element={
                      <RedirectIfAuth>
                        <ForgotPassword />
                      </RedirectIfAuth>
                    }
                  />
                  <Route path="/update-password" element={<UpdatePassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              </FinanceDataProvider>
              </DemoProvider>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </HelmetProvider>
);

export default App;
