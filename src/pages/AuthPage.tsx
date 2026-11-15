import React, { useState } from "react";
import { AiOrb } from "../components/AiOrb";
import { apiRequest, setStoredToken } from "../lib/api";
import { PageRoute, UserProfile } from "../types/mkai";

interface AuthPageProps {
  mode: "login" | "register";
  onSuccess: (user: UserProfile) => void;
  onNavigate: (page: PageRoute) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  mode,
  onSuccess,
  onNavigate,
}) => {
  const [view, setView] = useState<"login" | "register" | "forgot">(mode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [preferredLanguage, setPreferredLanguage] = useState<"hi" | "en">("hi");
  const [resetToken, setResetToken] = useState("");
  const [generatedTokenNotice, setGeneratedTokenNotice] = useState<string | null>(
    null
  );
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  React.useEffect(() => {
    setView(mode);
    setError(null);
    setInfo(null);
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      if (view === "login") {
        const res = await apiRequest<{ token: string; user: UserProfile }>(
          "/api/auth/login",
          {
            method: "POST",
            body: JSON.stringify({ email, password }),
          }
        );
        setStoredToken(res.token);
        onSuccess(res.user);
        onNavigate("chat");
      } else if (view === "register") {
        const res = await apiRequest<{ token: string; user: UserProfile }>(
          "/api/auth/register",
          {
            method: "POST",
            body: JSON.stringify({ name, email, password, preferredLanguage }),
          }
        );
        setStoredToken(res.token);
        onSuccess(res.user);
        onNavigate("chat");
      } else if (view === "forgot") {
        if (!generatedTokenNotice) {
          const res = await apiRequest<{ message: string; resetToken?: string }>(
            "/api/auth/forgot-password",
            {
              method: "POST",
              body: JSON.stringify({ email }),
            }
          );
          setInfo(res.message);
          if (res.resetToken) {
            setGeneratedTokenNotice(res.resetToken);
            setResetToken(res.resetToken);
          }
        } else {
          const res = await apiRequest<{ message: string }>(
            "/api/auth/reset-password",
            {
              method: "POST",
              body: JSON.stringify({ token: resetToken, newPassword }),
            }
          );
          setInfo(res.message);
          setGeneratedTokenNotice(null);
          setView("login");
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-violet-500/20 bg-white dark:bg-[#100A1D] p-7 sm:p-8 space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <AiOrb state={loading ? "thinking" : "idle"} size="sm" />
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {view === "login"
              ? "Sign in to M.K AI"
              : view === "register"
                ? "Create your M.K AI account"
                : "Reset Password"}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Isolated conversation history & synced Android companion account
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-700 dark:text-rose-200">
            {error}
          </div>
        )}

        {info && (
          <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 text-xs text-sky-800 dark:text-sky-200 space-y-1">
            <p>{info}</p>
            {generatedTokenNotice && (
              <p className="font-mono break-all">Token: {generatedTokenNotice}</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {view === "register" && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Aarav Sharma"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#080512] border border-slate-300 dark:border-violet-500/25 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#080512] border border-slate-300 dark:border-violet-500/25 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>

          {view !== "forgot" && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#080512] border border-slate-300 dark:border-violet-500/25 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
          )}

          {view === "register" && (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Primary Assistant Language
              </label>
              <select
                value={preferredLanguage}
                onChange={(e) =>
                  setPreferredLanguage(e.target.value === "en" ? "en" : "hi")
                }
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#080512] border border-slate-300 dark:border-violet-500/25 text-sm text-slate-900 dark:text-white"
              >
                <option value="hi">Hindi (Primary) + English</option>
                <option value="en">English (Primary) + Hindi</option>
              </select>
            </div>
          )}

          {view === "forgot" && generatedTokenNotice && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Reset Token
                </label>
                <input
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#080512] border border-slate-300 dark:border-violet-500/25 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#080512] border border-slate-300 dark:border-violet-500/25 text-sm"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-gradient-to-r from-violet-600 to-sky-500 text-white text-sm font-semibold hover:opacity-95 disabled:opacity-50 transition-opacity"
          >
            {loading
              ? "Please wait..."
              : view === "login"
                ? "Sign In"
                : view === "register"
                  ? "Create Account"
                  : generatedTokenNotice
                    ? "Confirm Password Reset"
                    : "Generate Reset Token"}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-200 dark:border-violet-500/15 flex flex-wrap items-center justify-between gap-2 text-xs">
          {view === "login" ? (
            <>
              <button
                type="button"
                onClick={() => setView("register")}
                className="text-violet-600 dark:text-sky-400 font-medium hover:underline"
              >
                Create new account
              </button>
              <button
                type="button"
                onClick={() => setView("forgot")}
                className="text-slate-500 dark:text-slate-400 hover:underline"
              >
                Forgot password?
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setView("login")}
              className="text-violet-600 dark:text-sky-400 font-medium hover:underline"
            >
              Back to Sign In
            </button>
          )}
        </div>

        <div className="p-3 rounded-lg bg-slate-50 dark:bg-white/5 text-[11px] text-slate-600 dark:text-slate-400 space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            Developer Admin Account (Manish Meena)
          </p>
          <p className="font-mono">
            Email: manish@mkai.dev · Default Pass: Manish@MKAI2026
          </p>
        </div>
      </div>
    </div>
  );
};
