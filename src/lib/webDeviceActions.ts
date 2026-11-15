import { IntentCommand } from "../types/mkai";

export interface WebActionOutcome {
  executedOnWeb: boolean;
  summary: string;
  openUrl?: string;
}

interface BatteryManagerLike {
  level: number;
  charging: boolean;
}

export async function executeWebAction(
  command: IntentCommand
): Promise<WebActionOutcome> {
  switch (command.action) {
    case "GET_DATETIME": {
      const formatted = new Intl.DateTimeFormat("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(new Date());
      return {
        executedOnWeb: true,
        summary: `Current date & time: ${formatted}`,
      };
    }

    case "GET_BATTERY": {
      const nav = navigator as Navigator & {
        getBattery?: () => Promise<BatteryManagerLike>;
      };
      if (typeof nav.getBattery === "function") {
        try {
          const b = await nav.getBattery();
          const pct = Math.round(b.level * 100);
          return {
            executedOnWeb: true,
            summary: `Device battery: ${pct}% (${b.charging ? "Charging" : "Discharging"})`,
          };
        } catch {
          // fallback below
        }
      }
      return {
        executedOnWeb: false,
        summary:
          "Browser Battery Status API is restricted here; on Android APK this reads BatteryManager directly.",
      };
    }

    case "GET_DEVICE_INFO": {
      const cores = navigator.hardwareConcurrency || "Unknown";
      const platform = navigator.platform || "Web Browser";
      return {
        executedOnWeb: true,
        summary: `Platform: ${platform} · CPU Threads: ${cores} · Language: ${navigator.language}`,
      };
    }

    case "OPEN_APP": {
      const target = (command.target || "").toLowerCase();
      const webRoutes: Record<string, string> = {
        youtube: "https://www.youtube.com",
        google: "https://www.google.com",
        gmail: "https://mail.google.com",
        maps: "https://maps.google.com",
        spotify: "https://open.spotify.com",
        whatsapp: "https://web.whatsapp.com",
      };
      const match = Object.entries(webRoutes).find(([k]) => target.includes(k));
      if (match) {
        return {
          executedOnWeb: true,
          summary: `Web companion link ready for ${command.target}. On Android APK, PackageManager launches the native app.`,
          openUrl: match[1],
        };
      }
      return {
        executedOnWeb: false,
        summary: `Android Intent queued: Launch "${command.target || "app"}" via PackageManager.`,
      };
    }

    case "DIAL_PHONE": {
      const sanitized = (command.target || "").replace(/[^\d+]/g, "");
      return {
        executedOnWeb: Boolean(sanitized),
        summary: `Confirmation required: Dial ${command.target || "contact"} via Android ACTION_DIAL.`,
        openUrl: sanitized ? `tel:${sanitized}` : undefined,
      };
    }

    case "SEND_SMS": {
      const sanitized = (command.target || "").replace(/[^\d+]/g, "");
      const body = encodeURIComponent(command.value || "");
      return {
        executedOnWeb: Boolean(sanitized),
        summary: `Confirmation required: Prepare SMS to ${command.target || "recipient"} via Android ACTION_SENDTO.`,
        openUrl: sanitized ? `sms:${sanitized}?body=${body}` : undefined,
      };
    }

    case "NONE":
      return { executedOnWeb: false, summary: "" };

    default:
      return {
        executedOnWeb: false,
        summary: `Android Native Action mapped: ${command.action}${command.target ? ` (${command.target})` : ""}${command.value ? ` → ${command.value}` : ""}`,
      };
  }
}

export function speakAssistantReply(
  text: string,
  language: "hi" | "en",
  rate: number
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const hasHindiChars = /[\u0900-\u097F]/.test(text);
  const targetLang = hasHindiChars ? "hi-IN" : language === "hi" ? "hi-IN" : "en-IN";
  utterance.lang = targetLang;
  utterance.rate = Math.min(2, Math.max(0.6, rate));

  const voices = window.speechSynthesis.getVoices();
  const preferredVoice =
    voices.find((v) => v.lang.toLowerCase().startsWith(targetLang.toLowerCase())) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(targetLang.slice(0, 2)));
  if (preferredVoice) {
    utterance.voice = preferredVoice;
  }
  window.speechSynthesis.speak(utterance);
}
