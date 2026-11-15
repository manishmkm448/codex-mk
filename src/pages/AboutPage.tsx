import React from "react";
import { PageRoute } from "../types/mkai";

interface AboutPageProps {
  onNavigate: (page: PageRoute) => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate }) => {
  return (
    <div className="max-w-4xl mx-auto px-5 sm:px-8 py-10 space-y-10">
      <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        <div className="md:col-span-4">
          <div className="aspect-square rounded-2xl overflow-hidden border border-slate-200 dark:border-violet-500/25 bg-[#0D0818]">
            <img
              src="/src/assets/images/developer_manish_avatar_1794745696341.jpg"
              alt="Developer Manish Meena"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="md:col-span-8 space-y-4">
          <p className="text-xs font-medium text-violet-600 dark:text-sky-400">
            Creator & Lead Architect · M.K AI
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
            Manish Meena
          </h1>
          <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed">
            M.K AI is a personal AI assistant developed by Manish Meena to make smartphone interaction smarter, faster and easier.
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Designed for bilingual Hindi and English users, M.K AI unifies Google Gemini and 16 additional AI providers behind a secure backend gateway while delivering native Android Kotlin + Jetpack Compose device controls and a synchronized web workspace.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate("chat")}
              className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-sky-500 text-white text-xs font-semibold"
            >
              Talk to M.K AI
            </button>
            <button
              type="button"
              onClick={() => onNavigate("download")}
              className="px-4 py-2.5 rounded-lg border border-slate-300 dark:border-violet-500/30 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              Explore Android Source
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4 border-t border-slate-200 dark:border-violet-500/15">
        <div className="p-5 rounded-xl border border-slate-200 dark:border-violet-500/20 bg-white dark:bg-[#100A1D] space-y-2">
          <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
            Assistant Identity
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            &ldquo;Hello! I am M.K AI, your personal AI assistant. I was developed by Manish Meena. How can I help you today?&rdquo;
          </p>
        </div>

        <div className="p-5 rounded-xl border border-slate-200 dark:border-violet-500/20 bg-white dark:bg-[#100A1D] space-y-2">
          <h2 className="font-display font-semibold text-base text-slate-900 dark:text-white">
            Technology Stack
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Kotlin · Jetpack Compose · Material 3 · MVVM · Retrofit · Node.js Express · SQLite · Google Gemini SDK · 17 AI Providers
          </p>
        </div>
      </section>
    </div>
  );
};
