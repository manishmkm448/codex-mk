import React from "react";

interface VoiceWaveformProps {
  active: boolean;
  label?: string;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({ active, label }) => {
  const bars = [0.4, 0.85, 0.55, 1, 0.7, 0.9, 0.45, 0.95, 0.6, 0.8, 0.5, 0.75];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center justify-center gap-1.5 h-8" aria-hidden="true">
        {bars.map((amp, i) => (
          <span
            key={i}
            className={`w-1 rounded-full bg-gradient-to-t from-violet-500 to-sky-400 transition-all duration-200 ${
              active ? "animate-pulse" : "opacity-35"
            }`}
            style={{
              height: active ? `${Math.round(amp * 28)}px` : "6px",
              animationDelay: `${i * 75}ms`,
            }}
          />
        ))}
      </div>
      {label ? (
        <span className="text-xs font-medium text-sky-600 dark:text-sky-300">
          {label}
        </span>
      ) : null}
    </div>
  );
};
