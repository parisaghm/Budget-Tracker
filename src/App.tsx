import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { RedirectIfAuth } from "@/components/auth/RedirectIfAuth";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Report from "./pages/Report";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/report/:monthKey"
                  element={
                    <ProtectedRoute>
                      <Report />
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
                <Route
                  path="/reset-password"
                  element={
                    <RedirectIfAuth>
                      <ResetPassword />
                    </RedirectIfAuth>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </HelmetProvider>
);

export default App;
