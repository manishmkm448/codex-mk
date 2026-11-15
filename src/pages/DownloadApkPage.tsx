import React, { useEffect, useState } from "react";
import { Download, FileCode2, FolderTree, Copy, Check } from "lucide-react";
import { apiRequest } from "../lib/api";

interface AndroidFileEntry {
  path: string;
  size: number;
}

const PHONE_CONTROLS = [
  { feature: "Open Installed Apps", api: "PackageManager.getLaunchIntentForPackage + <queries>", permission: "QUERY_ALL_PACKAGES" },
  { feature: "Open Camera", api: "MediaStore.ACTION_IMAGE_CAPTURE", permission: "CAMERA" },
  { feature: "Dialer & Calls", api: "Intent.ACTION_DIAL / ACTION_CALL (confirmed)", permission: "CALL_PHONE (optional)" },
  { feature: "Prepare SMS", api: "Intent.ACTION_SENDTO (smsto:)", permission: "None (user sends)" },
  { feature: "Battery Level", api: "BatteryManager.BATTERY_PROPERTY_CAPACITY", permission: "None" },
  { feature: "Flashlight Toggle", api: "CameraManager.setTorchMode", permission: "Camera Flash" },
  { feature: "Media Volume", api: "AudioManager.adjustStreamVolume / setStreamVolume", permission: "None" },
  { feature: "Wi-Fi Settings", api: "Settings.ACTION_WIFI_SETTINGS", permission: "None" },
  { feature: "Bluetooth Settings", api: "Settings.ACTION_BLUETOOTH_SETTINGS", permission: "None" },
  { feature: "Location Settings", api: "Settings.ACTION_LOCATION_SOURCE_SETTINGS", permission: "None" },
  { feature: "Screen Brightness", api: "Settings.System.SCREEN_BRIGHTNESS", permission: "WRITE_SETTINGS" },
  { feature: "Device Information", api: "android.os.Build + ActivityManager", permission: "None" },
  { feature: "Date & Time", api: "java.time.ZonedDateTime", permission: "None" },
  { feature: "Notification Settings", api: "Settings.ACTION_APP_NOTIFICATION_SETTINGS", permission: "None" },
  { feature: "Android Settings & Nav", api: "Settings.ACTION_SETTINGS + Opt-in AccessibilityService", permission: "User opt-in" },
];

export const DownloadApkPage: React.FC = () => {
  const [files, setFiles] = useState<AndroidFileEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [fileContent, setFileContent] = useState<string>("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiRequest<{ files: AndroidFileEntry[] }>("/api/android/tree");
        setFiles(res.files);
        const preferred =
          res.files.find((f) => f.path.endsWith("PhoneControlManager.kt")) ||
          res.files[0];
        if (preferred) {
          void loadFile(preferred.path);
        }
      } catch {
        // handled cleanly
      }
    })();
  }, []);

  const loadFile = async (relPath: string) => {
    setSelectedPath(relPath);
    setLoadingFile(true);
    try {
      const res = await apiRequest<{ content: string }>(
        `/api/android/file?path=${encodeURIComponent(relPath)}`
      );
      setFileContent(res.content);
    } finally {
      setLoadingFile(false);
    }
  };

  const handleCopy = async () => {
    if (!fileContent) return;
    await navigator.clipboard.writeText(fileContent);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 space-y-10">
      {/* Header & Real Download */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            M.K AI Native Android Studio Project & APK Build
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Complete Kotlin + Jetpack Compose + Material 3 + MVVM source project ready to compile into a signed Android APK.
          </p>
        </div>

        <a
          href="/api/android/download-project"
          download="M.K-AI-Android-Studio-Project.zip"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-sky-500 text-white text-sm font-semibold hover:opacity-95 transition-opacity whitespace-nowrap shrink-0 self-start"
        >
          <Download className="w-4 h-4" />
          <span>Download Android Project (.zip)</span>
        </a>
      </div>

      {/* Exact 5-Step APK Build Instructions */}
      <section className="p-6 rounded-xl border border-slate-200 dark:border-violet-500/20 bg-white dark:bg-[#100A1D] space-y-4">
        <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
          Exact APK Build & Signing Steps
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#080512] border border-slate-200 dark:border-violet-500/15 space-y-1">
            <p className="font-semibold text-violet-600 dark:text-sky-400">01. Open Project</p>
            <p className="text-slate-600 dark:text-slate-400">
              Unzip and open <code className="font-mono">M.K-AI-Android</code> in Android Studio Ladybug+.
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#080512] border border-slate-200 dark:border-violet-500/15 space-y-1">
            <p className="font-semibold text-violet-600 dark:text-sky-400">02. Sync Gradle</p>
            <p className="text-slate-600 dark:text-slate-400">
              Select JDK 17 and click Sync Project with Gradle Files.
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#080512] border border-slate-200 dark:border-violet-500/15 space-y-1">
            <p className="font-semibold text-violet-600 dark:text-sky-400">03. Set Backend</p>
            <p className="text-slate-600 dark:text-slate-400">
              Update <code className="font-mono">DEFAULT_BACKEND_URL</code> in <code className="font-mono">app/build.gradle.kts</code> or inside the app.
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#080512] border border-slate-200 dark:border-violet-500/15 space-y-1">
            <p className="font-semibold text-violet-600 dark:text-sky-400">04. Build Debug APK</p>
            <p className="text-slate-600 dark:text-slate-400">
              Run <code className="font-mono">./gradlew assembleDebug</code> to output <code className="font-mono">app-debug.apk</code>.
            </p>
          </div>
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-[#080512] border border-slate-200 dark:border-violet-500/15 space-y-1">
            <p className="font-semibold text-violet-600 dark:text-sky-400">05. Signed Release</p>
            <p className="text-slate-600 dark:text-slate-400">
              Use Build → Generate Signed Bundle / APK with your <code className="font-mono">.jks</code> keystore.
            </p>
          </div>
        </div>
      </section>

      {/* Live Project Source Explorer */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-sky-500" />
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Android Studio Source Explorer ({files.length} files)
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 rounded-xl border border-slate-200 dark:border-violet-500/20 overflow-hidden bg-white dark:bg-[#0B0714]">
          <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-violet-500/15 max-h-[440px] overflow-y-auto p-2 space-y-0.5">
            {files.map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => void loadFile(f.path)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono flex items-center justify-between gap-2 transition-colors ${
                  selectedPath === f.path
                    ? "bg-violet-600/15 text-violet-700 dark:text-sky-300"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                }`}
              >
                <span className="truncate">{f.path}</span>
                <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                  {Math.ceil(f.size / 1024)}KB
                </span>
              </button>
            ))}
          </div>

          <div className="lg:col-span-8 flex flex-col max-h-[440px]">
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-violet-500/15 flex items-center justify-between gap-2 bg-slate-50 dark:bg-[#080510]">
              <span className="inline-flex items-center gap-2 text-xs font-mono text-slate-700 dark:text-slate-300 truncate">
                <FileCode2 className="w-4 h-4 text-violet-500 shrink-0" />
                <span className="truncate">{selectedPath || "Select a file"}</span>
              </span>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium border border-slate-200 dark:border-violet-500/25 hover:bg-white dark:hover:bg-white/5"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs font-mono text-slate-800 dark:text-slate-200 leading-relaxed">
              {loadingFile ? "Loading source file..." : fileContent}
            </pre>
          </div>
        </div>
      </section>

      {/* 15 Phone Controls Matrix */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
          15 Native Android Phone Control APIs Implemented
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-violet-500/20 bg-white dark:bg-[#100A1D]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-violet-500/15 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Feature</th>
                <th className="px-4 py-3 font-medium">Official Android API</th>
                <th className="px-4 py-3 font-medium">Permission / Consent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {PHONE_CONTROLS.map((row) => (
                <tr key={row.feature}>
                  <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                    {row.feature}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-sky-700 dark:text-sky-300">
                    {row.api}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-400">
                    {row.permission}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
