import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import crypto from "node:crypto";
import { db, decryptSecret, PROVIDER_CATALOG, ProviderDefinition } from "./db.ts";

export interface IntentCommand {
  action:
    | "OPEN_APP"
    | "OPEN_CAMERA"
    | "DIAL_PHONE"
    | "SEND_SMS"
    | "GET_BATTERY"
    | "TOGGLE_FLASHLIGHT"
    | "ADJUST_VOLUME"
    | "OPEN_WIFI_SETTINGS"
    | "OPEN_BLUETOOTH_SETTINGS"
    | "OPEN_LOCATION_SETTINGS"
    | "ADJUST_BRIGHTNESS"
    | "GET_DEVICE_INFO"
    | "GET_DATETIME"
    | "OPEN_NOTIFICATION_SETTINGS"
    | "OPEN_SETTINGS"
    | "NONE";
  target?: string;
  value?: string;
  requiresConfirmation: boolean;
}

export interface ChatTurnResult {
  reply: string;
  command: IntentCommand;
  providerId: string;
  model: string;
  latencyMs: number;
  tokensUsed: number;
  failoverUsed: boolean;
  failoverFrom?: string;
  failoverReason?: string;
}

export interface FetchModelsResult {
  ok: boolean;
  providerId: string;
  statusCode: number;
  models: string[];
  defaultModel: string;
  selectedModel: string;
  source: "live" | "cached" | "default";
  error?: string;
}

interface ActiveKeyRecord {
  id: string;
  encrypted_key: string;
  priority: number;
}

interface ProviderConfigRow {
  provider_id: string;
  enabled: number;
  selected_model: string;
  custom_base_url: string | null;
  cached_models_json?: string | null;
  health_status: string;
  avg_latency_ms: number;
}

interface CachedModelEntry {
  models: string[];
  fetchedAt: number;
}

const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
const modelListCache = new Map<string, CachedModelEntry>();

export function invalidateProviderModelsCache(userId: string, providerId: string): void {
  modelListCache.delete(`${userId}:${providerId}`);
}

const SYSTEM_INSTRUCTION = `You are M.K AI, a personal AI assistant developed by Manish Meena (also known as Manish).
Your introduction is: "Hello! I am M.K AI, your personal AI assistant. I was developed by Manish Meena. How can I help you today?"
Primary language: Hindi (including natural Hindi/Hinglish conversational style when the user speaks Hindi or Hinglish).
Secondary language: English (respond in crisp, helpful English when the user speaks English).

CRITICAL: You are connected to both a Web Companion and a Native Android Smartphone Controller.
You MUST detect if the user's message is a smartphone control command or general conversation, and ALWAYS respond with a valid JSON object matching this exact schema (no markdown code fences, pure JSON):
{
  "reply": "Your natural, helpful response in Hindi, Hinglish, or English matching the user's language.",
  "command": {
    "action": "ONE_OF_THE_ACTIONS_BELOW",
    "target": "optional app name, phone number, contact, or setting target",
    "value": "optional value like on, off, up, down, 50, message text",
    "requiresConfirmation": false
  }
}

Allowed command.action values:
- "OPEN_APP" (e.g. "YouTube kholo", "Google kholo", "WhatsApp open karo", "Spotify chalao" -> target: "YouTube" / "Google" / etc.)
- "OPEN_CAMERA" (e.g. "camera kholo", "open camera", "photo click karni hai")
- "DIAL_PHONE" (e.g. "call Rahul", "9876543210 par call lagao" -> target: number/name, requiresConfirmation: true)
- "SEND_SMS" (e.g. "Mom ko message bhejo I reached safely" -> target: contact/number, value: message body, requiresConfirmation: true)
- "GET_BATTERY" (e.g. "battery kitni hai?", "check battery level")
- "TOGGLE_FLASHLIGHT" (e.g. "flashlight on karo", "torch band karo" -> value: "on" | "off" | "toggle")
- "ADJUST_VOLUME" (e.g. "volume kam karo", "volume badhao", "mute media" -> value: "up" | "down" | "mute" | "max" or percentage)
- "OPEN_WIFI_SETTINGS" (e.g. "wifi settings kholo", "open wifi")
- "OPEN_BLUETOOTH_SETTINGS" (e.g. "bluetooth settings kholo", "pair bluetooth")
- "OPEN_LOCATION_SETTINGS" (e.g. "location on karne ke liye settings kholo", "GPS settings")
- "ADJUST_BRIGHTNESS" (e.g. "brightness kam karo", "screen brightness 80%" -> value: "up" | "down" | "0-100")
- "GET_DEVICE_INFO" (e.g. "mere phone ki jaankari do", "device info", "Android version kya hai")
- "GET_DATETIME" (e.g. "mujhe time batao", "aaj ki date kya hai", "what time is it")
- "OPEN_NOTIFICATION_SETTINGS" (e.g. "notification settings kholo")
- "OPEN_SETTINGS" (e.g. "phone settings kholo", "open android settings")
- "NONE" (for normal Q&A, coding, general assistance, greetings, developer info)

Security rule: Never claim to secretly read private SMS/notifications or bypass Android security. For DIAL_PHONE or SEND_SMS, always set requiresConfirmation: true.`;

function getProviderMeta(providerId: string): ProviderDefinition | undefined {
  return PROVIDER_CATALOG.find((p) => p.id === providerId);
}

export function formatProviderHttpError(
  providerName: string,
  statusCode: number,
  model?: string,
  rawMessage?: string
): string {
  const detail = rawMessage?.trim();
  const suffix = detail ? ` (${detail})` : "";

  switch (statusCode) {
    case 401:
      return `401 Invalid API Key: Authentication failed for ${providerName}. Verify your API key on the backend.${suffix}`;
    case 403:
      return `403 Access Denied: Your ${providerName} key lacks permission for "${model || "this resource"}".${suffix}`;
    case 404:
      return `404 Model Not Found: Model "${model || "requested"}" does not exist or is unavailable on ${providerName}.${suffix}`;
    case 429:
      return `429 Rate Limit: ${providerName} rate limit or quota exceeded. Retrying or failing over.${suffix}`;
    default:
      if (statusCode >= 500) {
        return `${statusCode} Server Error: ${providerName} upstream server error.${suffix}`;
      }
      return `${statusCode} Error (${providerName}): ${detail || "Request failed."}`;
  }
}

function extractStatusCodeFromError(err: unknown, fallback = 500): number {
  const e = err as { status?: number; statusCode?: number; message?: string };
  if (typeof e?.status === "number" && e.status >= 400) return e.status;
  if (typeof e?.statusCode === "number" && e.statusCode >= 400) return e.statusCode;
  const msg = e?.message || "";
  if (msg.includes("401") || /invalid.*api.?key|unauthorized|unauthenticated/i.test(msg)) return 401;
  if (msg.includes("403") || /permission|access denied|forbidden/i.test(msg)) return 403;
  if (msg.includes("404") || /not found|does not exist/i.test(msg)) return 404;
  if (msg.includes("429") || /rate limit|quota|resource_exhausted/i.test(msg)) return 429;
  if (msg.includes("503")) return 503;
  if (msg.includes("502")) return 502;
  return fallback;
}

function parseAssistantJson(rawText: string): { reply: string; command: IntentCommand } {
  const cleaned = rawText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  try {
    const parsed = JSON.parse(cleaned) as {
      reply?: string;
      command?: Partial<IntentCommand>;
    };
    return {
      reply:
        parsed.reply ||
        "Hello! I am M.K AI, your personal AI assistant developed by Manish Meena.",
      command: {
        action: (parsed.command?.action as IntentCommand["action"]) || "NONE",
        target: parsed.command?.target || undefined,
        value: parsed.command?.value || undefined,
        requiresConfirmation: Boolean(parsed.command?.requiresConfirmation),
      },
    };
  } catch {
    return {
      reply: rawText.trim() || "Main samajh gaya. Kripya dobara koshish karein.",
      command: { action: "NONE", requiresConfirmation: false },
    };
  }
}

function getActiveApiKeyForUser(
  userId: string,
  providerId: string
): { keyId: string | null; apiKey: string | null } {
  const rows = db
    .prepare(
      `SELECT id, encrypted_key, priority FROM api_keys
       WHERE user_id = ? AND provider_id = ? AND is_active = 1
       ORDER BY priority ASC, created_at ASC`
    )
    .all(userId, providerId) as unknown as ActiveKeyRecord[];

  for (const row of rows) {
    const decrypted = decryptSecret(row.encrypted_key);
    if (decrypted) {
      return { keyId: row.id, apiKey: decrypted };
    }
  }

  if (providerId === "gemini" && process.env.GEMINI_API_KEY) {
    return { keyId: null, apiKey: process.env.GEMINI_API_KEY };
  }

  if (providerId === "groq" && process.env.GROQ_API_KEY) {
    return { keyId: null, apiKey: process.env.GROQ_API_KEY };
  }

  return { keyId: null, apiKey: null };
}

function getCachedModelsFromRow(cfg: ProviderConfigRow | undefined, fallback: string[]): string[] {
  if (cfg?.cached_models_json) {
    try {
      const parsed = JSON.parse(cfg.cached_models_json) as unknown;
      if (Array.isArray(parsed)) {
        const clean = parsed.filter((m): m is string => typeof m === "string" && m.trim().length > 0);
        if (clean.length > 0) return clean;
      }
    } catch {
      // ignore invalid JSON
    }
  }
  return fallback;
}

function recordProviderTelemetry(params: {
  userId: string;
  providerId: string;
  keyId: string | null;
  model: string;
  statusCode: number;
  latencyMs: number;
  tokensUsed?: number;
  errorMessage?: string | null;
}) {
  const now = new Date().toISOString();
  const rateLimited = params.statusCode === 429 ? 1 : 0;
  const isOk = params.statusCode >= 200 && params.statusCode < 300;

  db.prepare(
    `INSERT INTO api_logs
     (id, user_id, provider_id, key_id, model, status_code, latency_ms, tokens_used, rate_limited, error_message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    params.userId,
    params.providerId,
    params.keyId,
    params.model,
    params.statusCode,
    params.latencyMs,
    params.tokensUsed ?? 0,
    rateLimited,
    params.errorMessage ?? null,
    now
  );

  const healthStatus = isOk
    ? "healthy"
    : rateLimited
      ? "rate_limited"
      : "error";

  db.prepare(
    `UPDATE user_provider_configs
     SET health_status = ?,
         avg_latency_ms = CASE WHEN avg_latency_ms = 0 THEN ? ELSE CAST((avg_latency_ms + ?) / 2 AS INTEGER) END,
         model_available = ?,
         last_error = ?,
         last_checked_at = ?
     WHERE user_id = ? AND provider_id = ?`
  ).run(
    healthStatus,
    params.latencyMs,
    params.latencyMs,
    params.statusCode === 404 ? 0 : 1,
    params.errorMessage ?? null,
    now,
    params.userId,
    params.providerId
  );

  if (params.keyId) {
    db.prepare(
      `UPDATE api_keys
       SET total_requests = total_requests + 1,
           error_count = error_count + ?,
           rate_limit_hits = rate_limit_hits + ?,
           avg_latency_ms = CASE WHEN avg_latency_ms = 0 THEN ? ELSE CAST((avg_latency_ms + ?) / 2 AS INTEGER) END,
           last_status = ?,
           last_error = ?,
           last_tested_at = ?
       WHERE id = ?`
    ).run(
      isOk ? 0 : 1,
      rateLimited,
      params.latencyMs,
      params.latencyMs,
      healthStatus,
      params.errorMessage ?? null,
      now,
      params.keyId
    );
  }
}

export async function fetchProviderModels(params: {
  userId: string;
  providerId: string;
  overrideKey?: string;
  keyId?: string;
  forceRefresh?: boolean;
}): Promise<FetchModelsResult> {
  const meta = getProviderMeta(params.providerId);
  if (!meta) {
    return {
      ok: false,
      providerId: params.providerId,
      statusCode: 404,
      models: [],
      defaultModel: "",
      selectedModel: "",
      source: "default",
      error: "Unknown provider.",
    };
  }

  const cfg = db
    .prepare(
      `SELECT provider_id, enabled, selected_model, custom_base_url, cached_models_json, health_status, avg_latency_ms
       FROM user_provider_configs WHERE user_id = ? AND provider_id = ?`
    )
    .get(params.userId, params.providerId) as ProviderConfigRow | undefined;

  const baseUrl = (cfg?.custom_base_url || meta.baseUrl).replace(/\/$/, "");
  const fallbackModels = getCachedModelsFromRow(cfg, meta.models);
  const currentSelected = cfg?.selected_model || meta.defaultModel;

  // Providers without an OpenAI-style /models endpoint fall back cleanly to catalog/cached models
  if (params.providerId === "gemini" || params.providerId === "anthropic" || params.providerId === "cohere") {
    return {
      ok: true,
      providerId: params.providerId,
      statusCode: 200,
      models: fallbackModels,
      defaultModel: meta.defaultModel,
      selectedModel: currentSelected,
      source: cfg?.cached_models_json ? "cached" : "default",
    };
  }

  let apiKey: string | null = params.overrideKey || null;
  if (!apiKey && params.keyId) {
    const keyRow = db
      .prepare("SELECT encrypted_key FROM api_keys WHERE id = ? AND user_id = ?")
      .get(params.keyId, params.userId) as { encrypted_key: string } | undefined;
    if (keyRow) {
      apiKey = decryptSecret(keyRow.encrypted_key);
    }
  }
  if (!apiKey) {
    apiKey = getActiveApiKeyForUser(params.userId, params.providerId).apiKey;
  }

  if (meta.requiresKey && !apiKey) {
    return {
      ok: false,
      providerId: params.providerId,
      statusCode: 401,
      models: fallbackModels,
      defaultModel: meta.defaultModel,
      selectedModel: currentSelected,
      source: cfg?.cached_models_json ? "cached" : "default",
      error: `401 Invalid API Key: Add a ${meta.name} key on the backend to fetch live models.`,
    };
  }

  const cacheKey = `${params.userId}:${params.providerId}`;
  if (!params.forceRefresh && !params.overrideKey && !params.keyId) {
    const cached = modelListCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < MODEL_CACHE_TTL_MS && cached.models.length > 0) {
      return {
        ok: true,
        providerId: params.providerId,
        statusCode: 200,
        models: cached.models,
        defaultModel: cached.models.includes(meta.defaultModel)
          ? meta.defaultModel
          : cached.models[0],
        selectedModel: currentSelected,
        source: "cached",
      };
    }
  }

  try {
    const modelsEndpoint =
      params.providerId === "ollama"
        ? `${baseUrl}/api/tags`
        : params.providerId === "groq"
          ? "https://api.groq.com/openai/v1/models"
          : `${baseUrl}/models`;

    const headers: Record<string, string> = {};
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const res = await fetch(modelsEndpoint, {
      method: "GET",
      headers,
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: Array<{ id?: string; active?: boolean; object?: string }>;
      models?: Array<{ name?: string }>;
      error?: { message?: string };
      message?: string;
    };

    if (!res.ok) {
      const rawMsg = json.error?.message || json.message || `HTTP ${res.status}`;
      const formatted = formatProviderHttpError(meta.name, res.status, currentSelected, rawMsg);
      return {
        ok: false,
        providerId: params.providerId,
        statusCode: res.status,
        models: fallbackModels,
        defaultModel: meta.defaultModel,
        selectedModel: currentSelected,
        source: "default",
        error: formatted,
      };
    }

    let liveModels: string[] = [];
    if (params.providerId === "ollama" && Array.isArray(json.models)) {
      liveModels = json.models
        .map((m) => m.name?.trim() || "")
        .filter(Boolean);
    } else if (Array.isArray(json.data)) {
      liveModels = json.data
        .filter((m) => m.active !== false && typeof m.id === "string" && m.id.trim().length > 0)
        .map((m) => m.id!.trim());

      if (params.providerId === "groq") {
        // Keep chat/reasoning LLMs and filter out non-chat ASR/TTS endpoints
        liveModels = liveModels.filter(
          (id) => !/^(whisper|distil-whisper|playai-tts|canopylabs\/orpheus)/i.test(id)
        );
      }
    }

    const uniqueModels = Array.from(new Set(liveModels)).sort((a, b) => {
      if (a === meta.defaultModel) return -1;
      if (b === meta.defaultModel) return 1;
      return a.localeCompare(b);
    });

    if (uniqueModels.length === 0) {
      uniqueModels.push(meta.defaultModel);
    }

    modelListCache.set(cacheKey, {
      models: uniqueModels,
      fetchedAt: Date.now(),
    });

    const resolvedDefault = uniqueModels.includes(meta.defaultModel)
      ? meta.defaultModel
      : uniqueModels[0];

    let resolvedSelected = currentSelected;
    if (!uniqueModels.includes(currentSelected)) {
      resolvedSelected = resolvedDefault;
    }

    db.prepare(
      `UPDATE user_provider_configs
       SET cached_models_json = ?,
           selected_model = ?,
           model_available = 1,
           last_checked_at = ?
       WHERE user_id = ? AND provider_id = ?`
    ).run(
      JSON.stringify(uniqueModels),
      resolvedSelected,
      new Date().toISOString(),
      params.userId,
      params.providerId
    );

    return {
      ok: true,
      providerId: params.providerId,
      statusCode: 200,
      models: uniqueModels,
      defaultModel: resolvedDefault,
      selectedModel: resolvedSelected,
      source: "live",
    };
  } catch (err) {
    const statusCode = extractStatusCodeFromError(err, 500);
    const formatted = formatProviderHttpError(
      meta.name,
      statusCode,
      currentSelected,
      (err as Error).message
    );
    return {
      ok: false,
      providerId: params.providerId,
      statusCode,
      models: fallbackModels,
      defaultModel: meta.defaultModel,
      selectedModel: currentSelected,
      source: "default",
      error: formatted,
    };
  }
}

async function validateModelBeforeRequest(params: {
  userId: string;
  providerId: string;
  model: string;
  apiKey: string | null;
  keyId?: string | null;
  allowAutoFallbackToDefault: boolean;
}): Promise<{ validatedModel: string; availableModels?: string[] }> {
  if (params.providerId !== "groq") {
    return { validatedModel: params.model };
  }

  if (!params.apiKey) {
    throw Object.assign(
      new Error(formatProviderHttpError("Groq API", 401, params.model, "Missing API key.")),
      { status: 401 }
    );
  }

  const live = await fetchProviderModels({
    userId: params.userId,
    providerId: "groq",
    overrideKey: params.apiKey,
    keyId: params.keyId ?? undefined,
  });

  if (!live.ok) {
    throw Object.assign(new Error(live.error || "Failed to validate Groq models."), {
      status: live.statusCode,
    });
  }

  if (live.models.includes(params.model)) {
    return { validatedModel: params.model, availableModels: live.models };
  }

  const replacement = "openai/gpt-oss-120b";
  if (params.allowAutoFallbackToDefault && live.models.includes(replacement)) {
    db.prepare(
      `UPDATE user_provider_configs
       SET selected_model = ?, model_available = 1
       WHERE user_id = ? AND provider_id = 'groq'`
    ).run(replacement, params.userId);

    return { validatedModel: replacement, availableModels: live.models };
  }

  const previewList = live.models.slice(0, 6).join(", ");
  throw Object.assign(
    new Error(
      formatProviderHttpError(
        "Groq API",
        404,
        params.model,
        `Active models on your key: ${previewList}`
      )
    ),
    { status: 404, availableModels: live.models }
  );
}

async function callSingleProvider(params: {
  providerId: string;
  model: string;
  apiKey: string | null;
  baseUrl: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  systemPrompt: string;
}): Promise<{ text: string; tokensUsed: number }> {
  const { providerId, model, apiKey, baseUrl, messages, systemPrompt } = params;
  const meta = getProviderMeta(providerId);
  const providerName = meta?.name || providerId;

  if (providerId === "gemini") {
    if (!apiKey) {
      throw Object.assign(
        new Error(
          formatProviderHttpError(
            providerName,
            401,
            model,
            "GEMINI_API_KEY is not configured in server environment."
          )
        ),
        { status: 401 }
      );
    }
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    const historyTranscript = messages
      .slice(-10)
      .map((m) => `${m.role === "user" ? "User" : "M.K AI"}: ${m.content}`)
      .join("\n");

    let response;
    let attempt = 0;
    while (true) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: historyTranscript,
          config: {
            abortSignal: AbortSignal.timeout(25000),
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            ...(model.startsWith("gemini-4-")
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
          },
        });
        break;
      } catch (err) {
        const msg = (err as Error).message || "";
        const isTransient = msg.includes("503") || msg.includes("UNAVAILABLE");
        if (isTransient && attempt < 2) {
          attempt++;
          await new Promise((r) => setTimeout(r, 600 * attempt));
          continue;
        }
        const status = extractStatusCodeFromError(err, 500);
        throw Object.assign(
          new Error(formatProviderHttpError(providerName, status, model, msg)),
          { status }
        );
      }
    }

    return {
      text: response.text ?? "",
      tokensUsed: response.usageMetadata?.totalTokenCount ?? 0,
    };
  }

  if (providerId === "anthropic") {
    if (!apiKey) {
      throw Object.assign(
        new Error(formatProviderHttpError(providerName, 401, model, "Missing Anthropic API key")),
        { status: 401 }
      );
    }
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      content?: Array<{ text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      error?: { message?: string };
    };
    if (!res.ok) {
      throw Object.assign(
        new Error(formatProviderHttpError(providerName, res.status, model, json.error?.message)),
        { status: res.status }
      );
    }
    return {
      text: json.content?.[0]?.text || "",
      tokensUsed: (json.usage?.input_tokens ?? 0) + (json.usage?.output_tokens ?? 0),
    };
  }

  if (providerId === "cohere") {
    if (!apiKey) {
      throw Object.assign(
        new Error(formatProviderHttpError(providerName, 401, model, "Missing Cohere API key")),
        { status: 401 }
      );
    }
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      message?: { content?: Array<{ text?: string }> };
      usage?: { billed_units?: { input_tokens?: number; output_tokens?: number } };
      message_error?: string;
    };
    if (!res.ok) {
      throw Object.assign(
        new Error(formatProviderHttpError(providerName, res.status, model, json.message_error)),
        { status: res.status }
      );
    }
    return {
      text: json.message?.content?.[0]?.text || "",
      tokensUsed:
        (json.usage?.billed_units?.input_tokens ?? 0) +
        (json.usage?.billed_units?.output_tokens ?? 0),
    };
  }

  if (providerId === "ollama") {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      message?: { content?: string };
      error?: string;
    };
    if (!res.ok) {
      throw Object.assign(
        new Error(formatProviderHttpError(providerName, res.status, model, json.error)),
        { status: res.status }
      );
    }
    return { text: json.message?.content || "", tokensUsed: 0 };
  }

  // OpenAI-compatible providers: openai, groq, deepseek, mistral, openrouter, xai, perplexity,
  // together, fireworks, huggingface, cerebras, sambanova, nvidia
  if (!apiKey) {
    throw Object.assign(
      new Error(formatProviderHttpError(providerName, 401, model, `Missing API key for ${providerName}`)),
      { status: 401 }
    );
  }

  const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (providerId === "openrouter") {
    headers["HTTP-Referer"] = process.env.APP_URL || "https://mkai.dev";
    headers["X-Title"] = "M.K AI Assistant";
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      ],
      temperature: 0.4,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { total_tokens?: number };
    error?: { message?: string };
  };

  if (!res.ok) {
    throw Object.assign(
      new Error(formatProviderHttpError(providerName, res.status, model, json.error?.message)),
      { status: res.status }
    );
  }

  return {
    text: json.choices?.[0]?.message?.content || "",
    tokensUsed: json.usage?.total_tokens ?? 0,
  };
}

export async function runAssistantTurn(params: {
  userId: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  preferredProviderId?: string;
  preferredModel?: string;
  autoSelect: boolean;
}): Promise<ChatTurnResult> {
  const configs = db
    .prepare(
      `SELECT provider_id, enabled, selected_model, custom_base_url, cached_models_json, health_status, avg_latency_ms
       FROM user_provider_configs WHERE user_id = ?`
    )
    .all(params.userId) as unknown as ProviderConfigRow[];

  const configMap = new Map(configs.map((c) => [c.provider_id, c]));

  const candidateOrder: string[] = [];
  if (params.preferredProviderId) {
    candidateOrder.push(params.preferredProviderId);
  }

  // Always build fallback candidates from other enabled providers when autoSelect is on
  // or whenever Groq is selected (ensures resilient fallback if Groq fails).
  const allowFallback = params.autoSelect || params.preferredProviderId === "groq";
  if (allowFallback) {
    const enabledOthers = configs
      .filter((c) => c.enabled === 1 && c.provider_id !== params.preferredProviderId)
      .sort((a, b) => {
        const aHealthy = a.health_status === "healthy" ? 0 : 1;
        const bHealthy = b.health_status === "healthy" ? 0 : 1;
        if (aHealthy !== bHealthy) return aHealthy - bHealthy;
        return (a.avg_latency_ms || 9999) - (b.avg_latency_ms || 9999);
      })
      .map((c) => c.provider_id);

    for (const p of enabledOthers) {
      if (!candidateOrder.includes(p)) candidateOrder.push(p);
    }

    const geminiCfg = configMap.get("gemini");
    if (!candidateOrder.includes("gemini") && (!geminiCfg || geminiCfg.enabled === 1)) {
      candidateOrder.push("gemini");
    }
  }

  let lastError: (Error & { status?: number }) | null = null;
  let failoverUsed = false;
  let primaryFailedProvider: string | undefined;
  let primaryFailureReason: string | undefined;

  for (let i = 0; i < candidateOrder.length; i++) {
    const providerId = candidateOrder[i];
    const meta = getProviderMeta(providerId);
    if (!meta) continue;

    const cfg = configMap.get(providerId);
    if (i > 0) failoverUsed = true;

    let model =
      (i === 0 && params.preferredModel) || cfg?.selected_model || meta.defaultModel;
    const baseUrl = cfg?.custom_base_url || meta.baseUrl;
    const { keyId, apiKey } = getActiveApiKeyForUser(params.userId, providerId);

    if (meta.requiresKey && !apiKey) {
      if (i === 0 && candidateOrder.length > 1) {
        const missingErr = formatProviderHttpError(
          meta.name,
          401,
          model,
          "No active API key configured for this provider."
        );
        lastError = Object.assign(new Error(missingErr), { status: 401 });
        primaryFailedProvider = providerId;
        primaryFailureReason = missingErr;
      }
      continue;
    }

    const start = Date.now();
    try {
      // Automatic model validation before sending request (e.g. Groq GET /models)
      const validation = await validateModelBeforeRequest({
        userId: params.userId,
        providerId,
        model,
        apiKey,
        keyId,
        allowAutoFallbackToDefault: !(i === 0 && Boolean(params.preferredModel)),
      });
      model = validation.validatedModel;

      const result = await callSingleProvider({
        providerId,
        model,
        apiKey,
        baseUrl,
        messages: params.messages,
        systemPrompt: SYSTEM_INSTRUCTION,
      });
      const latencyMs = Date.now() - start;
      recordProviderTelemetry({
        userId: params.userId,
        providerId,
        keyId,
        model,
        statusCode: 200,
        latencyMs,
        tokensUsed: result.tokensUsed,
      });

      const parsed = parseAssistantJson(result.text);
      return {
        reply: parsed.reply,
        command: parsed.command,
        providerId,
        model,
        latencyMs,
        tokensUsed: result.tokensUsed,
        failoverUsed,
        failoverFrom: failoverUsed ? primaryFailedProvider : undefined,
        failoverReason: failoverUsed ? primaryFailureReason : undefined,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const errorObj = err as Error & { status?: number };
      const statusCode = extractStatusCodeFromError(errorObj, 500);
      recordProviderTelemetry({
        userId: params.userId,
        providerId,
        keyId,
        model,
        statusCode,
        latencyMs,
        errorMessage: errorObj.message,
      });
      lastError = Object.assign(errorObj, { status: statusCode });
      if (i === 0) {
        primaryFailedProvider = providerId;
        primaryFailureReason = errorObj.message;
      }
      if (!allowFallback) break;
    }
  }

  throw (
    lastError ||
    Object.assign(new Error("No healthy AI provider is currently available."), { status: 502 })
  );
}

export async function testProviderConnection(params: {
  userId: string;
  providerId: string;
  keyId?: string;
  overrideKey?: string;
  model?: string;
}): Promise<{
  ok: boolean;
  statusCode: number;
  latencyMs: number;
  modelAvailable: boolean;
  model: string;
  availableModels?: string[];
  message: string;
}> {
  const meta = getProviderMeta(params.providerId);
  if (!meta) {
    return {
      ok: false,
      statusCode: 404,
      latencyMs: 0,
      modelAvailable: false,
      model: params.model || "",
      message: "404 Not Found: Unknown provider.",
    };
  }

  const cfg = db
    .prepare(
      `SELECT selected_model, custom_base_url FROM user_provider_configs WHERE user_id = ? AND provider_id = ?`
    )
    .get(params.userId, params.providerId) as
    | { selected_model: string; custom_base_url: string | null }
    | undefined;

  let model = params.model || cfg?.selected_model || meta.defaultModel;
  const baseUrl = cfg?.custom_base_url || meta.baseUrl;

  let apiKey: string | null = params.overrideKey || null;
  let resolvedKeyId: string | null = params.keyId || null;

  if (!apiKey && params.keyId) {
    const row = db
      .prepare(`SELECT id, encrypted_key FROM api_keys WHERE id = ? AND user_id = ?`)
      .get(params.keyId, params.userId) as
      | { id: string; encrypted_key: string }
      | undefined;
    if (row) {
      apiKey = decryptSecret(row.encrypted_key);
      resolvedKeyId = row.id;
    }
  }

  if (!apiKey) {
    const fallback = getActiveApiKeyForUser(params.userId, params.providerId);
    apiKey = fallback.apiKey;
    resolvedKeyId = resolvedKeyId ?? fallback.keyId;
  }

  const start = Date.now();
  try {
    const validation = await validateModelBeforeRequest({
      userId: params.userId,
      providerId: params.providerId,
      model,
      apiKey,
      keyId: resolvedKeyId,
      allowAutoFallbackToDefault: false,
    });
    model = validation.validatedModel;

    await callSingleProvider({
      providerId: params.providerId,
      model,
      apiKey,
      baseUrl,
      messages: [
        {
          role: "user",
          content:
            'Reply with JSON: {"reply":"ok","command":{"action":"NONE","requiresConfirmation":false}}',
        },
      ],
      systemPrompt:
        'Return compact JSON: {"reply":"ok","command":{"action":"NONE","requiresConfirmation":false}}',
    });
    const latencyMs = Date.now() - start;
    recordProviderTelemetry({
      userId: params.userId,
      providerId: params.providerId,
      keyId: resolvedKeyId,
      model,
      statusCode: 200,
      latencyMs,
    });
    return {
      ok: true,
      statusCode: 200,
      latencyMs,
      modelAvailable: true,
      model,
      availableModels: validation.availableModels,
      message: `Connected to ${meta.name} (${model}) in ${latencyMs}ms`,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const e = err as Error & { status?: number; availableModels?: string[] };
    const statusCode = extractStatusCodeFromError(e, 500);
    recordProviderTelemetry({
      userId: params.userId,
      providerId: params.providerId,
      keyId: resolvedKeyId,
      model,
      statusCode,
      latencyMs,
      errorMessage: e.message,
    });
    return {
      ok: false,
      statusCode,
      latencyMs,
      modelAvailable: statusCode !== 404,
      model,
      availableModels: e.availableModels,
      message: e.message,
    };
  }
}
