import React, { useEffect, useState } from "react";
import {
  Plus,
  Play,
  Trash2,
  Edit3,
  Check,
  AlertTriangle,
  RefreshCw,
  Shield,
  Search,
} from "lucide-react";
import { apiRequest } from "../lib/api";
import {
  ApiKeyItem,
  ApiLogItem,
  FetchModelsResponse,
  PageRoute,
  ProviderItem,
  UserProfile,
} from "../types/mkai";

interface DashboardPageProps {
  user: UserProfile | null;
  onNavigate: (page: PageRoute) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  user,
  onNavigate,
}) => {
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [autoSelect, setAutoSelect] = useState(true);
  const [defaultProviderId, setDefaultProviderId] = useState("gemini");
  const [logs, setLogs] = useState<ApiLogItem[]>([]);
  const [summary, setSummary] = useState<{
    totalRequests: number;
    totalErrors: number;
    rateLimitHits: number;
    totalTokens: number;
    avgLatencyMs: number;
  } | null>(null);
  const [adminOverview, setAdminOverview] = useState<{
    usersCount: number;
    convCount: number;
    msgCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "enabled" | "healthy">("all");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingModelsId, setSyncingModelsId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    statusCode: number;
    providerName: string;
    message: string;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Add / Edit Key Modal State
  const [keyModal, setKeyModal] = useState<{
    provider: ProviderItem;
    editingKey?: ApiKeyItem;
  } | null>(null);
  const [keyLabel, setKeyLabel] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [keyPriority, setKeyPriority] = useState(1);
  const [customBaseUrlInput, setCustomBaseUrlInput] = useState("");

  const loadDashboard = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [provRes, usageRes] = await Promise.all([
        apiRequest<{
          autoSelectProvider: boolean;
          defaultProviderId: string;
          providers: ProviderItem[];
        }>("/api/providers"),
        apiRequest<{
          summary: {
            totalRequests: number;
            totalErrors: number;
            rateLimitHits: number;
            totalTokens: number;
            avgLatencyMs: number;
          };
          logs: ApiLogItem[];
        }>("/api/analytics/api-usage"),
      ]);
      setProviders(provRes.providers);
      setAutoSelect(provRes.autoSelectProvider);
      setDefaultProviderId(provRes.defaultProviderId);
      setSummary(usageRes.summary);
      setLogs(usageRes.logs);

      if (user.role === "admin") {
        const adminRes = await apiRequest<{
          usersCount: number;
          convCount: number;
          msgCount: number;
        }>("/api/admin/overview");
        setAdminOverview(adminRes);
      }
    } catch (err) {
      setToast((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          API Key Manager & Telemetry Dashboard
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Sign in to configure all 17 AI providers, manage encrypted multi-provider API keys, test live connections, and monitor latency & rate limits.
        </p>
        <button
          type="button"
          onClick={() => onNavigate("login")}
          className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-sky-500 text-white text-sm font-semibold"
        >
          Sign In to Open Dashboard
        </button>
      </div>
    );
  }

  const handleToggleAutoSelect = async () => {
    const next = !autoSelect;
    setAutoSelect(next);
    await apiRequest("/api/auth/profile", {
      method: "PATCH",
      body: JSON.stringify({ autoSelectProvider: next }),
    });
    setToast(
      next
        ? "Automatic provider selection & failover enabled."
        : "Automatic provider selection disabled."
    );
  };

  const handleUpdateProvider = async (
    providerId: string,
    payload: {
      enabled?: boolean;
      selectedModel?: string;
      customBaseUrl?: string;
      setAsDefault?: boolean;
    }
  ) => {
    try {
      await apiRequest(`/api/providers/${providerId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await loadDashboard();
      if (payload.setAsDefault) {
        setToast(`Default AI provider updated to ${providerId}.`);
      }
    } catch (err) {
      setToast((err as Error).message);
    }
  };

  const handleSyncModels = async (provider: ProviderItem) => {
    setSyncingModelsId(provider.id);
    setTestResult(null);
    try {
      const res = await apiRequest<FetchModelsResponse>(
        `/api/providers/${provider.id}/models?refresh=true`
      );
      if (res.ok) {
        setProviders((prev) =>
          prev.map((p) =>
            p.id === provider.id
              ? {
                  ...p,
                  models: res.models,
                  selectedModel: res.selectedModel,
                  modelSource: res.source,
                }
              : p
          )
        );
        setToast(
          `Synced ${res.models.length} live model(s) for ${provider.name} (active: ${res.selectedModel}).`
        );
      } else {
        setToast(`${provider.name} model sync (${res.statusCode}): ${res.error || "Failed to fetch models."}`);
      }
    } catch (err) {
      setToast((err as Error).message);
    } finally {
      setSyncingModelsId(null);
    }
  };

  const handleTestProvider = async (provider: ProviderItem, keyId?: string) => {
    const testKey = keyId || provider.id;
    setTestingId(testKey);
    setTestResult(null);
    try {
      const endpoint = keyId
        ? `/api/keys/${keyId}/test`
        : `/api/providers/${provider.id}/test`;
      const res = await apiRequest<{
        ok: boolean;
        statusCode: number;
        latencyMs: number;
        model?: string;
        availableModels?: string[];
        message: string;
      }>(endpoint, {
        method: "POST",
        body: JSON.stringify({ model: provider.selectedModel }),
      });
      setTestResult({
        ok: res.ok,
        statusCode: res.statusCode,
        providerName: provider.name,
        message: res.message,
      });
      setToast(
        res.ok
          ? `${provider.name} [HTTP ${res.statusCode}]: ${res.message}`
          : `${provider.name} failed [HTTP ${res.statusCode}]: ${res.message}`
      );
      await loadDashboard();
    } catch (err) {
      setToast((err as Error).message);
    } finally {
      setTestingId(null);
    }
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyModal) return;
    try {
      if (keyModal.editingKey) {
        await apiRequest(`/api/keys/${keyModal.editingKey.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            label: keyLabel,
            apiKey: keyValue.trim() ? keyValue.trim() : undefined,
            priority: keyPriority,
          }),
        });
        setToast("API key updated securely.");
      } else {
        if (keyModal.provider.id === "ollama") {
          await apiRequest(`/api/providers/ollama`, {
            method: "PATCH",
            body: JSON.stringify({
              enabled: true,
              customBaseUrl: customBaseUrlInput.trim() || "http://localhost:11434",
            }),
          });
          setToast("Ollama endpoint updated.");
        } else {
          const added = await apiRequest<{ syncedModels?: string[] }>("/api/keys", {
            method: "POST",
            body: JSON.stringify({
              providerId: keyModal.provider.id,
              label: keyLabel,
              apiKey: keyValue,
              priority: keyPriority,
            }),
          });
          setToast(
            added.syncedModels?.length
              ? `Added encrypted key for ${keyModal.provider.name} and synced ${added.syncedModels.length} live models.`
              : `Added encrypted key for ${keyModal.provider.name}.`
          );
        }
      }
      setKeyModal(null);
      setKeyLabel("");
      setKeyValue("");
      await loadDashboard();
    } catch (err) {
      setToast((err as Error).message);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    try {
      await apiRequest(`/api/keys/${keyId}`, { method: "DELETE" });
      setToast("API key deleted.");
      await loadDashboard();
    } catch (err) {
      setToast((err as Error).message);
    }
  };

  const handleToggleKeyActive = async (key: ApiKeyItem) => {
    try {
      await apiRequest(`/api/keys/${key.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: key.is_active !== 1 }),
      });
      await loadDashboard();
    } catch (err) {
      setToast((err as Error).message);
    }
  };

  const filteredProviders = providers.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filterMode === "enabled") return p.enabled;
    if (filterMode === "healthy") return p.healthStatus === "healthy";
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            AI Provider & API Key Manager
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Manage 17 AI providers, multi-key rotation, live health checks, rate-limit tracking, and automatic failover.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleToggleAutoSelect}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
              autoSelect
                ? "bg-violet-600/15 border-violet-500/40 text-violet-700 dark:text-sky-300"
                : "border-slate-300 dark:border-violet-500/25 text-slate-700 dark:text-slate-300"
            }`}
          >
            Auto-Select & Failover: {autoSelect ? "ON" : "OFF"}
          </button>

          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-violet-500/25 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {testResult && (
        <div
          className={`p-3.5 rounded-xl border text-xs sm:text-sm flex items-center justify-between gap-3 ${
            testResult.ok
              ? "border-emerald-300 dark:border-emerald-500/35 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
              : "border-rose-300 dark:border-rose-500/35 bg-rose-50 dark:bg-rose-500/10 text-rose-900 dark:text-rose-200"
          }`}
        >
          <span className="font-mono tabular-nums">
            [HTTP {testResult.statusCode}] {testResult.providerName} — {testResult.message}
          </span>
          <button
            type="button"
            onClick={() => setTestResult(null)}
            className="font-semibold underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {toast && !testResult && (
        <div className="p-3.5 rounded-xl border border-sky-300 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 text-xs sm:text-sm text-sky-900 dark:text-sky-200 flex items-center justify-between gap-3">
          <span>{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="font-semibold underline shrink-0"
          >
            Close
          </button>
        </div>
      )}

      {/* Telemetry KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-violet-500/20 bg-white dark:bg-[#100A1D]">
          <p className="text-xs text-slate-500 dark:text-slate-400">API Requests</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {summary?.totalRequests ?? 0}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-violet-500/20 bg-white dark:bg-[#100A1D]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Avg Latency</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-sky-600 dark:text-sky-400">
            {summary?.avgLatencyMs ?? 0}ms
          </p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-violet-500/20 bg-white dark:bg-[#100A1D]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Tokens Tracked</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
            {(summary?.totalTokens ?? 0).toLocaleString()}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-violet-500/20 bg-white dark:bg-[#100A1D]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Error Count</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
            {summary?.totalErrors ?? 0}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 dark:border-violet-500/20 bg-white dark:bg-[#100A1D]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Rate Limits (429)</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
            {summary?.rateLimitHits ?? 0}
          </p>
        </div>
      </div>

      {/* Admin Overview (Manish Meena only) */}
      {adminOverview && (
        <div className="p-5 rounded-xl border border-violet-500/30 bg-violet-500/5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-violet-500" />
            <div>
              <h2 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
                Developer Admin Overview (Manish Meena)
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Aggregate platform totals (individual user chats remain strictly isolated)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-xs font-mono tabular-nums">
            <span>Users: {adminOverview.usersCount}</span>
            <span>Conversations: {adminOverview.convCount}</span>
            <span>Messages: {adminOverview.msgCount}</span>
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search 17 AI providers (Gemini, OpenAI, Groq, DeepSeek...)"
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-white dark:bg-[#100A1D] border border-slate-200 dark:border-violet-500/25 text-sm text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-white/5 self-start">
          {(["all", "enabled", "healthy"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterMode(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-colors ${
                filterMode === tab
                  ? "bg-white dark:bg-violet-600 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {tab} ({tab === "all" ? providers.length : tab === "enabled" ? providers.filter((p) => p.enabled).length : providers.filter((p) => p.healthStatus === "healthy").length})
            </button>
          ))}
        </div>
      </div>

      {/* 17-Provider Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {filteredProviders.map((provider) => {
          const isDefault = defaultProviderId === provider.id;
          const isGemini = provider.id === "gemini";

          return (
            <div
              key={provider.id}
              className="p-5 rounded-xl border border-slate-200 dark:border-violet-500/20 bg-white dark:bg-[#100A1D] space-y-4"
            >
              {/* Top Row */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-semibold text-base text-slate-900 dark:text-white">
                      {provider.name}
                    </h3>
                    {isDefault && (
                      <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
                        · Default
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                    <span>{provider.category}</span>
                    <span>·</span>
                    <span
                      className={
                        provider.healthStatus === "healthy"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : provider.healthStatus === "rate_limited"
                            ? "text-amber-600 dark:text-amber-400"
                            : provider.healthStatus === "error"
                              ? "text-rose-600 dark:text-rose-400"
                              : ""
                      }
                    >
                      Status: {provider.healthStatus}
                    </span>
                    <span>·</span>
                    <span>{provider.avgLatencyMs}ms</span>
                    <span>·</span>
                    <span>
                      Model: {provider.modelAvailable ? "Available" : "Unavailable"}
                    </span>
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={provider.enabled}
                    onChange={(e) =>
                      void handleUpdateProvider(provider.id, {
                        enabled: e.target.checked,
                      })
                    }
                    className="accent-violet-600 w-4 h-4"
                  />
                  <span>{provider.enabled ? "Enabled" : "Disabled"}</span>
                </label>
              </div>

              {/* Model Selector & Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={provider.selectedModel}
                  onChange={(e) =>
                    void handleUpdateProvider(provider.id, {
                      selectedModel: e.target.value,
                    })
                  }
                  aria-label={`Select model for ${provider.name}`}
                  className="flex-1 min-w-[180px] px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#080512] border border-slate-200 dark:border-violet-500/20 text-xs font-mono text-slate-900 dark:text-slate-100"
                >
                  {provider.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>

                {(provider.id === "groq" || provider.id === "openai" || provider.id === "openrouter" || provider.id === "together" || provider.id === "ollama") && (
                  <button
                    type="button"
                    disabled={syncingModelsId === provider.id}
                    onClick={() => void handleSyncModels(provider)}
                    title={`Fetch live models from ${provider.name}`}
                    className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-violet-500/25 hover:bg-slate-100 dark:hover:bg-white/5 whitespace-nowrap"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${syncingModelsId === provider.id ? "animate-spin" : ""}`}
                    />
                    <span>{syncingModelsId === provider.id ? "Syncing..." : "Sync Models"}</span>
                  </button>
                )}

                {!isDefault && (
                  <button
                    type="button"
                    onClick={() =>
                      void handleUpdateProvider(provider.id, {
                        enabled: true,
                        setAsDefault: true,
                      })
                    }
                    className="px-3 py-2 rounded-lg text-xs font-semibold border border-slate-200 dark:border-violet-500/25 hover:bg-slate-100 dark:hover:bg-white/5 whitespace-nowrap"
                  >
                    Set Default
                  </button>
                )}

                <button
                  type="button"
                  disabled={testingId === provider.id}
                  onClick={() => void handleTestProvider(provider)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-300 hover:bg-sky-500/25 whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{testingId === provider.id ? "Testing..." : "Test API Connection"}</span>
                </button>

                {!isGemini && (
                  <button
                    type="button"
                    onClick={() => {
                      setKeyModal({ provider });
                      setKeyLabel(`${provider.name} Key #${provider.keys.length + 1}`);
                      setKeyValue("");
                      setKeyPriority(provider.keys.length + 1);
                      setCustomBaseUrlInput(provider.customBaseUrl);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-500 whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{provider.id === "ollama" ? "Endpoint" : "Add Key"}</span>
                  </button>
                )}
              </div>

              {/* Gemini Server-Managed Note or Provider Keys List */}
              {isGemini ? (
                <div className="pt-2 border-t border-slate-200 dark:border-violet-500/15 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>
                    Server-managed Gemini integration ({provider.envKeyActive ? "Environment Active" : "Pending Server Secret"})
                  </span>
                  <span className="font-mono tabular-nums">
                    Calls: {provider.usage.totalCalls} · Errors: {provider.usage.errorCalls}
                  </span>
                </div>
              ) : (
                <div className="pt-2 border-t border-slate-200 dark:border-violet-500/15 space-y-2">
                  {provider.keys.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {provider.id === "ollama"
                        ? `Local endpoint: ${provider.customBaseUrl}`
                        : "No API keys added yet. Add one or more keys for rotation & failover."}
                    </p>
                  ) : (
                    provider.keys.map((k) => (
                      <div
                        key={k.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-xs py-1.5 border-b last:border-b-0 border-slate-100 dark:border-white/5"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {k.label}{" "}
                            <span className="font-mono text-slate-500">
                              ({k.masked_key})
                            </span>
                          </p>
                          <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                            Priority {k.priority} · {k.last_status} · {k.avg_latency_ms}ms · Req {k.total_requests} · Err {k.error_count}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleToggleKeyActive(k)}
                            className={`px-2 py-1 rounded text-[11px] font-medium ${
                              k.is_active === 1
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-slate-400"
                            }`}
                          >
                            {k.is_active === 1 ? "Active" : "Paused"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleTestProvider(provider, k.id)}
                            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-sky-500"
                            title="Test Key"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setKeyModal({ provider, editingKey: k });
                              setKeyLabel(k.label);
                              setKeyValue("");
                              setKeyPriority(k.priority);
                            }}
                            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500"
                            title="Edit Key"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteKey(k.id)}
                            className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-500"
                            title="Delete Key"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {provider.lastError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{provider.lastError}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* API Telemetry Logs Table */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
          Recent API Health & Latency Logs
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-violet-500/20 bg-white dark:bg-[#100A1D]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-violet-500/15 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Provider</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Latency</th>
                <th className="px-4 py-3 font-medium text-right">Tokens</th>
                <th className="px-4 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5 font-mono tabular-nums">
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-slate-500 font-sans"
                  >
                    No API requests logged yet. Test a provider or send a chat message.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium">{log.provider_id}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                      {log.model}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={
                          log.status_code < 300
                            ? "text-emerald-600 dark:text-emerald-400"
                            : log.rate_limited
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-rose-600 dark:text-rose-400"
                        }
                      >
                        HTTP {log.status_code}
                        {log.rate_limited ? " (Rate Limit)" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">{log.latency_ms}ms</td>
                    <td className="px-4 py-2.5 text-right">{log.tokens_used}</td>
                    <td className="px-4 py-2.5 font-sans text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {log.error_message || "OK"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Add / Edit Key Modal */}
      {keyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs">
          <form
            onSubmit={handleSaveKey}
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-violet-500/30 bg-white dark:bg-[#100A1D] p-6 space-y-4"
          >
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {keyModal.editingKey
                ? `Edit ${keyModal.provider.name} Key`
                : keyModal.provider.id === "ollama"
                  ? "Configure Ollama Local Endpoint"
                  : `Add ${keyModal.provider.name} Key`}
            </h3>

            {keyModal.provider.id === "ollama" ? (
              <div>
                <label className="block text-xs font-medium mb-1.5">
                  Ollama Base URL
                </label>
                <input
                  type="url"
                  required
                  value={customBaseUrlInput}
                  onChange={(e) => setCustomBaseUrlInput(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#080512] border border-slate-300 dark:border-violet-500/25 text-sm font-mono"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium mb-1.5">
                    Key Label
                  </label>
                  <input
                    type="text"
                    required
                    value={keyLabel}
                    onChange={(e) => setKeyLabel(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#080512] border border-slate-300 dark:border-violet-500/25 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">
                    {keyModal.editingKey
                      ? "New API Key (leave blank to keep existing)"
                      : "API Key (AES-256 encrypted on server)"}
                  </label>
                  <input
                    type="password"
                    required={!keyModal.editingKey}
                    value={keyValue}
                    onChange={(e) => setKeyValue(e.target.value)}
                    placeholder="Paste provider API key..."
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#080512] border border-slate-300 dark:border-violet-500/25 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5">
                    Failover Priority (1 = highest)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={keyPriority}
                    onChange={(e) => setKeyPriority(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#080512] border border-slate-300 dark:border-violet-500/25 text-sm font-mono"
                  />
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setKeyModal(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-violet-500/25"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-500"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
