import React from "react";

interface AiOrbProps {
  state?: "idle" | "listening" | "thinking" | "speaking";
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

export const AiOrb: React.FC<AiOrbProps> = ({
  state = "idle",
  size = "md",
  onClick,
}) => {
  const dims =
    size === "sm"
      ? "w-16 h-16"
      : size === "lg"
        ? "w-44 h-44"
        : "w-28 h-28";

  const isActive = state === "listening" || state === "speaking";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`M.K AI Core Orb (${state})`}
      className={`relative inline-flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 transition-transform duration-200 ${
        onClick ? "cursor-pointer hover:scale-105" : "cursor-default"
      } ${dims}`}
    >
      {/* Ambient radial glow */}
      <span
        className={`absolute inset-0 rounded-full blur-2xl transition-opacity duration-300 ${
          isActive
            ? "bg-gradient-to-tr from-violet-600/60 via-sky-400/50 to-indigo-500/60 opacity-100"
            : state === "thinking"
              ? "bg-gradient-to-tr from-violet-600/50 to-sky-500/40 opacity-90"
              : "bg-gradient-to-tr from-violet-700/35 to-sky-500/25 opacity-70"
        }`}
      />

      {/* Outer orbital ring */}
      <span
        className={`absolute inset-1 rounded-full border border-sky-400/40 dark:border-sky-400/50 ${
          isActive ? "animate-orb-active" : "animate-orb-idle"
        }`}
      />

      {/* Inner violet ring */}
      <span className="absolute inset-3 rounded-full border border-violet-500/50 dark:border-violet-400/60" />

      {/* Core sphere */}
      <span
        className={`relative w-[68%] h-[68%] rounded-full shadow-inner transition-all duration-300 ${
          isActive
            ? "bg-gradient-to-br from-sky-400 via-violet-500 to-indigo-950 scale-105"
            : state === "thinking"
              ? "bg-gradient-to-br from-violet-400 via-indigo-600 to-slate-950"
              : "bg-gradient-to-br from-violet-500/90 via-indigo-800 to-[#080512]"
        }`}
      >
        <span className="absolute inset-[18%] rounded-full bg-gradient-to-tr from-transparent via-sky-300/25 to-white/40" />
      </span>
    </button>
  );
};
