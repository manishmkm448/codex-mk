import React, { useState } from "react";
import { Shield, Check } from "lucide-react";
import { apiRequest } from "../lib/api";
import { PageRoute, UserProfile } from "../types/mkai";

interface SettingsPageProps {
  user: UserProfile | null;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onProfileUpdated: (user: UserProfile) => void;
  onNavigate: (page: PageRoute) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  user,
  theme,
  onToggleTheme,
  onProfileUpdated,
  onNavigate,
}) => {
  const [name, setName] = useState(user?.name || "");
  const [lang, setLang] = useState<"hi" | "en">(user?.preferredLanguage || "hi");
  const [voiceEnabled, setVoiceEnabled] = useState(user?.voiceEnabled ?? true);
  const [ttsRate, setTtsRate] = useState(user?.ttsRate ?? 1.0);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await apiRequest<{ user: UserProfile }>("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name,
          preferredLanguage: lang,
          theme,
          voiceEnabled,
          ttsRate,
        }),
      });
      onProfileUpdated(res.user);
      setSavedMsg("Profile and assistant settings saved.");
    } catch (err) {
      setSavedMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 space-y-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          Settings & Security
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Manage your profile, bilingual voice preferences, theme, and privacy policies.
        </p>
      </div>

      {/* Theme Toggle Card */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-violet-500/20 bg-white dark:bg-[#100A1D] flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
            Interface Appearance
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Switch between Black/Neon-Purple Dark Theme and Clean Light Theme.
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleTheme}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-500 whitespace-nowrap"
        >
          Current: {theme === "dark" ? "Dark" : "Light"}
        </button>
      </div>

      {user ? (
        <form
          onSubmit={handleSave}
          className="p-6 rounded-xl border border-slate-200 dark:border-violet-500/20 bg-white dark:bg-[#100A1D] space-y-5"
        >
          <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
            User Profile & Voice Preferences
          </h2>

          {savedMsg && (
            <p className="text-xs font-medium text-sky-600 dark:text-sky-400">
              {savedMsg}
            </p>
          )}

          <div>
            <label className="block text-xs font-medium mb-1.5">Display Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#080512] border border-slate-300 dark:border-violet-500/25 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">
              Primary Voice & Assistant Language
            </label>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value === "en" ? "en" : "hi")}
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#080512] border border-slate-300 dark:border-violet-500/25 text-sm"
            >
              <option value="hi">Hindi (Primary) + English</option>
              <option value="en">English (Primary) + Hindi</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Natural Voice Reply (TTS)</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automatically speak M.K AI replies aloud
              </p>
            </div>
            <input
              type="checkbox"
              checked={voiceEnabled}
              onChange={(e) => setVoiceEnabled(e.target.checked)}
              className="w-4 h-4 accent-violet-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5">
              Speech Rate ({ttsRate.toFixed(1)}x)
            </label>
            <input
              type="range"
              min="0.6"
              max="1.6"
              step="0.1"
              value={ttsRate}
              onChange={(e) => setTtsRate(Number(e.target.value))}
              className="w-full accent-violet-600"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-sky-500 text-white text-sm font-semibold"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? "Saving..." : "Save Settings"}</span>
          </button>
        </form>
      ) : (
        <div className="p-6 rounded-xl border border-slate-200 dark:border-violet-500/20 bg-white dark:bg-[#100A1D] space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Sign in to save personal profile settings, conversation history, and API keys.
          </p>
          <button
            type="button"
            onClick={() => onNavigate("login")}
            className="px-4 py-2 rounded-lg bg-violet-600 text-white text-xs font-semibold"
          >
            Sign In
          </button>
        </div>
      )}

      {/* Privacy & Security Guarantees */}
      <div className="p-6 rounded-xl border border-slate-200 dark:border-violet-500/20 bg-white dark:bg-[#100A1D] space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-500" />
          <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
            Security & Android Permission Policy
          </h2>
        </div>
        <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 list-disc pl-5">
          <li>Permissions are requested strictly when a feature is invoked, never silently.</li>
          <li>Microphone input only activates when you press the mic control or enable active listening.</li>
          <li>Calls and SMS actions always require explicit user confirmation before launching system handlers.</li>
          <li>API keys are encrypted with AES-256-GCM server-side and never included in browser bundles or Android APK source code.</li>
        </ul>
      </div>
    </div>
  );
};
