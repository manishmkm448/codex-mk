import React from "react";
import { ArrowRight, Mic, Smartphone, ShieldCheck, Layers } from "lucide-react";
import { AiOrb } from "../components/AiOrb";
import { PageRoute, UserProfile } from "../types/mkai";

interface HomePageProps {
  user: UserProfile | null;
  onNavigate: (page: PageRoute) => void;
  onLaunchWithCommand: (command: string) => void;
}

const SAMPLE_COMMANDS = [
  { label: "Hey M.K AI, YouTube kholo", intent: "OPEN_APP · YouTube" },
  { label: "M.K AI, flashlight on karo", intent: "TOGGLE_FLASHLIGHT · Torch" },
  { label: "M.K AI, battery kitni hai?", intent: "GET_BATTERY · BatteryManager" },
  { label: "M.K AI, camera kholo", intent: "OPEN_CAMERA · MediaStore" },
  { label: "M.K AI, mujhe time batao", intent: "GET_DATETIME · ZonedDateTime" },
  { label: "M.K AI, volume kam karo", intent: "ADJUST_VOLUME · AudioManager" },
];

export const HomePage: React.FC<HomePageProps> = ({
  user,
  onNavigate,
  onLaunchWithCommand,
}) => {
  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-12 space-y-12">
      {/* Hero Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
          <p className="text-xs font-medium tracking-wide text-violet-600 dark:text-sky-400">
            Personal Android & Web Assistant · Developed by Manish Meena
          </p>

          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight [text-wrap:balance]">
            Smarter smartphone control in Hindi and English.
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
            &ldquo;Hello! I am M.K AI, your personal AI assistant. I was developed by Manish Meena. How can I help you today?&rdquo;
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => onNavigate("chat")}
              className="inline-flex items-center gap-2.5 px-5 py-3 rounded-lg bg-gradient-to-r from-violet-600 to-sky-500 text-white font-semibold text-sm hover:opacity-95 transition-opacity whitespace-nowrap shrink-0"
            >
              <Mic className="w-4 h-4" />
              <span>Start Voice & AI Chat</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate("download")}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-slate-300 dark:border-violet-500/30 bg-white dark:bg-[#110B1F] text-slate-900 dark:text-slate-100 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
            >
              <Smartphone className="w-4 h-4 text-sky-500" />
              <span>Get Android Studio Project</span>
            </button>

            {!user && (
              <button
                type="button"
                onClick={() => onNavigate("login")}
                className="px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-violet-600 dark:hover:text-sky-300 transition-colors whitespace-nowrap shrink-0"
              >
                Sign In to Account
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 relative rounded-2xl overflow-hidden border border-slate-200 dark:border-violet-500/20 bg-[#080512] min-h-[300px] flex flex-col items-center justify-center p-6">
          <img
            src="/src/assets/images/mkai_neural_architecture_1794745696486.jpg"
            alt="M.K AI neural lattice hardware core"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#06040C] via-[#06040C]/45 to-transparent" />
          <div className="relative z-10 flex flex-col items-center text-center space-y-4">
            <AiOrb state="idle" size="lg" onClick={() => onNavigate("chat")} />
            <p className="text-sm font-medium text-slate-200">
              Tap the M.K AI Core to speak or command
            </p>
          </div>
        </div>
      </section>

      {/* Bilingual Quick Voice Commands */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Try Hindi & English Voice Commands
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Click any command to test natural language intent detection directly in AI Chat.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SAMPLE_COMMANDS.map((cmd) => (
            <button
              key={cmd.label}
              type="button"
              onClick={() => onLaunchWithCommand(cmd.label)}
              className="text-left p-4 rounded-xl border border-slate-200 dark:border-violet-500/20 bg-white dark:bg-[#100A1D] hover:border-violet-500/50 dark:hover:border-sky-400/50 transition-colors group"
            >
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-violet-600 dark:group-hover:text-sky-300 transition-colors">
                &ldquo;{cmd.label}&rdquo;
              </p>
              <p className="mt-1.5 text-xs font-mono text-slate-500 dark:text-slate-400">
                {cmd.intent}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* 3 Core Architecture Pillars */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-6 rounded-xl border border-slate-200 dark:border-violet-500/20 bg-white dark:bg-[#100A1D] space-y-2.5">
          <Smartphone className="w-5 h-5 text-sky-500" />
          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            15 Native Phone Controls
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Built with Kotlin, Jetpack Compose, and official Android APIs for apps, camera, dialer, SMS, battery, torch, audio, brightness, and settings.
          </p>
        </div>

        <div className="p-6 rounded-xl border border-slate-200 dark:border-violet-500/20 bg-white dark:bg-[#100A1D] space-y-2.5">
          <Layers className="w-5 h-5 text-violet-500" />
          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            17-Provider AI Gateway
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Powered by Google Gemini with full multi-key management, live connection testing, latency tracking, and automatic failover across 17 AI providers.
          </p>
        </div>

        <div className="p-6 rounded-xl border border-slate-200 dark:border-violet-500/20 bg-white dark:bg-[#100A1D] space-y-2.5">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Isolated & Permission-First
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            API keys remain encrypted server-side, user histories are strictly isolated, and sensitive actions require explicit confirmation.
          </p>
        </div>
      </section>
    </div>
  );
};
