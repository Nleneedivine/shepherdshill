import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Church, Mail, Lock, LogIn, UserPlus, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button, Input } from "@/components/ds";
import { useToastContext } from "@/components/ds/Toast";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

type Mode = "login" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const { showToast } = useToastContext();
  const [mode, setMode] = useState<Mode>("login");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [signUpFullName, setSignUpFullName] = useState("");
  const [signUpEmail, setSignUpEmail] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [signUpConfirm, setSignUpConfirm] = useState("");

  const [forgotEmail, setForgotEmail] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user && !data.user.is_anonymous) navigate({ to: "/dashboard" });
    })();
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isEmail = identifier.includes("@");
      const { error } = isEmail
        ? await supabase.auth.signInWithPassword({ email: identifier, password })
        : await supabase.auth.signInWithPassword({ phone: identifier, password });
      if (error) throw error;
      showToast("Signed in successfully", "success");
      navigate({ to: "/dashboard" });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Sign-in failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signUpPassword !== signUpConfirm) {
      showToast("Passwords don't match", "error");
      return;
    }
    if (signUpPassword.length < 6) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signUpEmail,
        password: signUpPassword,
        options: {
          data: { full_name: signUpFullName },
        },
      });
      if (error) throw error;

      if (data.session) {
        showToast("Account created successfully", "success");
        navigate({ to: "/dashboard" });
      } else {
        showToast("Account created — check your email to confirm before signing in.", "success");
        setMode("login");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Sign-up failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      showToast("Password reset email sent — check your inbox.", "success");
      setMode("login");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not send reset email", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      showToast(result.error.message ?? "Google sign-in failed", "error");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  };

  const titles: Record<Mode, { heading: string; sub: string }> = {
    login: { heading: "Welcome back", sub: "Sign in to your account" },
    signup: { heading: "Create your account", sub: "Join the Shepherd's Hill digital platform" },
    forgot: { heading: "Reset your password", sub: "We'll email you a reset link" },
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden" style={{ backgroundColor: "#080c16" }}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-20 left-1/4 h-96 w-96 rounded-full bg-violet-600 opacity-20 blur-3xl" />
        <div className="absolute bottom-10 right-1/4 h-80 w-80 rounded-full bg-blue-600 opacity-20 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="mb-6 flex justify-center">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-600 to-blue-500 flex items-center justify-center">
            <Church className="text-white" size={32} />
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white text-center">{titles[mode].heading}</h1>
          <p className="text-sm text-slate-400 text-center mt-1">{titles[mode].sub}</p>

          {mode === "login" && (
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <Input
                label="Email or phone"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com or +234..."
                required
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <div className="text-right -mt-2">
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-xs text-violet-400 hover:text-violet-300"
                >
                  Forgot password?
                </button>
              </div>
              <Button type="submit" loading={loading} className="w-full">
                <LogIn size={16} /> Sign in
              </Button>
            </form>
          )}

          {mode === "signup" && (
            <form onSubmit={handleSignUp} className="mt-6 space-y-4">
              <Input
                label="Full name"
                type="text"
                value={signUpFullName}
                onChange={(e) => setSignUpFullName(e.target.value)}
                placeholder="Your full name"
                required
              />
              <Input
                label="Email"
                type="email"
                value={signUpEmail}
                onChange={(e) => setSignUpEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
              <Input
                label="Password"
                type="password"
                value={signUpPassword}
                onChange={(e) => setSignUpPassword(e.target.value)}
                placeholder="At least 6 characters"
                required
              />
              <Input
                label="Confirm password"
                type="password"
                value={signUpConfirm}
                onChange={(e) => setSignUpConfirm(e.target.value)}
                placeholder="••••••••"
                required
              />
              <Button type="submit" loading={loading} className="w-full">
                <UserPlus size={16} /> Create account
              </Button>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={handleForgotPassword} className="mt-6 space-y-4">
              <Input
                label="Email"
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
              <Button type="submit" loading={loading} className="w-full">
                <KeyRound size={16} /> Send reset link
              </Button>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="w-full text-center text-sm text-slate-400 hover:text-white"
              >
                Back to sign in
              </button>
            </form>
          )}

          {mode !== "forgot" && (
            <>
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs text-slate-500">or</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <Button variant="secondary" className="w-full" onClick={handleGoogle}>
                <Mail size={16} /> Continue with Google
              </Button>
            </>
          )}

          <p className="mt-6 text-center text-sm text-slate-400">
            {mode === "login" && (
              <>
                New here?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="text-violet-400 hover:text-violet-300 font-medium"
                >
                  Create an account
                </button>
                {" "}or{" "}
                <Link to="/register" className="text-violet-400 hover:text-violet-300 font-medium">
                  register as a member
                </Link>
              </>
            )}
            {mode === "signup" && (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-violet-400 hover:text-violet-300 font-medium"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-slate-500 flex items-center justify-center gap-1">
          <Lock size={12} /> Secured by end-to-end encryption
        </p>
      </motion.div>
    </div>
  );
}