import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import path from "node:path";
import bcrypt from "bcryptjs";

export interface ProviderDefinition {
  id: string;
  name: string;
  category: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
  requiresKey: boolean;
  supportsUsageEndpoint: boolean;
  docsUrl: string;
}

export const PROVIDER_CATALOG: ProviderDefinition[] = [
  {
    id: "gemini",
    name: "Google Gemini API",
    category: "Core Multimodal",
    baseUrl: "https://generativelanguage.googleapis.com",
    defaultModel: "gemini-4-hydrogen",
    models: ["gemini-4-hydrogen", "gemini-4-argon", "gemini-4-carbon", "gemini-3.1-flash-lite"],
    requiresKey: false,
    supportsUsageEndpoint: false,
    docsUrl: "https://ai.google.dev/gemini-api/docs",
  },
  {
    id: "openai",
    name: "OpenAI API",
    category: "Frontier LLM",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "o3-mini"],
    requiresKey: true,
    supportsUsageEndpoint: true,
    docsUrl: "https://platform.openai.com/docs",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude API",
    category: "Frontier LLM",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-20250514",
    models: ["claude-sonnet-4-20250514", "claude-3-5-haiku-latest", "claude-3-7-sonnet-latest"],
    requiresKey: true,
    supportsUsageEndpoint: false,
    docsUrl: "https://docs.anthropic.com",
  },
  {
    id: "groq",
    name: "Groq API",
    category: "Ultra-Low Latency",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "openai/gpt-oss-120b",
    models: ["openai/gpt-oss-120b"],
    requiresKey: true,
    supportsUsageEndpoint: false,
    docsUrl: "https://console.groq.com/docs",
  },
  {
    id: "deepseek",
    name: "DeepSeek API",
    category: "Reasoning & Code",
    baseUrl: "https://api.deepseek.com",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    requiresKey: true,
    supportsUsageEndpoint: true,
    docsUrl: "https://api-docs.deepseek.com",
  },
  {
    id: "mistral",
    name: "Mistral AI API",
    category: "European Frontier",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
    models: ["mistral-small-latest", "mistral-large-latest", "codestral-latest"],
    requiresKey: true,
    supportsUsageEndpoint: false,
    docsUrl: "https://docs.mistral.ai",
  },
  {
    id: "openrouter",
    name: "OpenRouter API",
    category: "Unified Router",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "google/gemini-2.5-flash",
    models: [
      "google/gemini-2.5-flash",
      "openai/gpt-4o-mini",
      "anthropic/claude-3.5-sonnet",
      "meta-llama/llama-3.3-70b-instruct",
    ],
    requiresKey: true,
    supportsUsageEndpoint: true,
    docsUrl: "https://openrouter.ai/docs",
  },
  {
    id: "xai",
    name: "xAI Grok API",
    category: "Frontier LLM",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-3-mini",
    models: ["grok-3-mini", "grok-3", "grok-2-latest"],
    requiresKey: true,
    supportsUsageEndpoint: false,
    docsUrl: "https://docs.x.ai",
  },
  {
    id: "cohere",
    name: "Cohere API",
    category: "Enterprise & RAG",
    baseUrl: "https://api.cohere.com/v2",
    defaultModel: "command-a-03-2025",
    models: ["command-a-03-2025", "command-r-plus", "command-r"],
    requiresKey: true,
    supportsUsageEndpoint: false,
    docsUrl: "https://docs.cohere.com",
  },
  {
    id: "perplexity",
    name: "Perplexity API",
    category: "Search Grounded",
    baseUrl: "https://api.perplexity.ai",
    defaultModel: "sonar",
    models: ["sonar", "sonar-pro", "sonar-reasoning-pro"],
    requiresKey: true,
    supportsUsageEndpoint: false,
    docsUrl: "https://docs.perplexity.ai",
  },
  {
    id: "together",
    name: "Together AI API",
    category: "Open Models Cloud",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    models: [
      "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      "Qwen/Qwen2.5-72B-Instruct-Turbo",
      "deepseek-ai/DeepSeek-V3",
    ],
    requiresKey: true,
    supportsUsageEndpoint: false,
    docsUrl: "https://docs.together.ai",
  },
  {
    id: "fireworks",
    name: "Fireworks AI API",
    category: "High-Speed Inference",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    defaultModel: "accounts/fireworks/models/llama-v3p3-70b-instruct",
    models: [
      "accounts/fireworks/models/llama-v3p3-70b-instruct",
      "accounts/fireworks/models/deepseek-v3",
    ],
    requiresKey: true,
    supportsUsageEndpoint: false,
    docsUrl: "https://docs.fireworks.ai",
  },
  {
    id: "huggingface",
    name: "Hugging Face API",
    category: "Open Ecosystem",
    baseUrl: "https://router.huggingface.co/v1",
    defaultModel: "Qwen/Qwen2.5-72B-Instruct",
    models: [
      "Qwen/Qwen2.5-72B-Instruct",
      "meta-llama/Llama-3.3-70B-Instruct",
      "mistralai/Mistral-7B-Instruct-v0.3",
    ],
    requiresKey: true,
    supportsUsageEndpoint: false,
    docsUrl: "https://huggingface.co/docs/api-inference",
  },
  {
    id: "cerebras",
    name: "Cerebras API",
    category: "Ultra-Low Latency",
    baseUrl: "https://api.cerebras.ai/v1",
    defaultModel: "llama-3.3-70b",
    models: ["llama-3.3-70b", "llama3.1-8b"],
    requiresKey: true,
    supportsUsageEndpoint: false,
    docsUrl: "https://inference-docs.cerebras.ai",
  },
  {
    id: "sambanova",
    name: "SambaNova API",
    category: "Ultra-Low Latency",
    baseUrl: "https://api.sambanova.ai/v1",
    defaultModel: "Meta-Llama-3.3-70B-Instruct",
    models: ["Meta-Llama-3.3-70B-Instruct", "DeepSeek-R1-Distill-Llama-70B"],
    requiresKey: true,
    supportsUsageEndpoint: false,
    docsUrl: "https://docs.sambanova.ai",
  },
  {
    id: "nvidia",
    name: "NVIDIA NIM API",
    category: "Accelerated Compute",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    defaultModel: "meta/llama-3.3-70b-instruct",
    models: ["meta/llama-3.3-70b-instruct", "nvidia/llama-3.1-nemotron-70b-instruct"],
    requiresKey: true,
    supportsUsageEndpoint: false,
    docsUrl: "https://build.nvidia.com",
  },
  {
    id: "ollama",
    name: "Ollama Local API",
    category: "Self-Hosted Local",
    baseUrl: "http://localhost:11434",
    defaultModel: "llama3.2",
    models: ["llama3.2", "qwen2.5", "mistral", "gemma3"],
    requiresKey: false,
    supportsUsageEndpoint: false,
    docsUrl: "https://ollama.com/docs",
  },
];

const dbPath = path.join(process.cwd(), "mkai.db");
export const db = new DatabaseSync(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    preferred_language TEXT NOT NULL DEFAULT 'hi',
    theme TEXT NOT NULL DEFAULT 'dark',
    voice_enabled INTEGER NOT NULL DEFAULT 1,
    tts_rate REAL NOT NULL DEFAULT 1.0,
    auto_select_provider INTEGER NOT NULL DEFAULT 1,
    default_provider_id TEXT NOT NULL DEFAULT 'gemini',
    default_model TEXT NOT NULL DEFAULT 'gemini-4-hydrogen',
    google_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    provider_id TEXT,
    model TEXT,
    intent_action_json TEXT,
    latency_ms INTEGER,
    created_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_provider_configs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    selected_model TEXT NOT NULL,
    custom_base_url TEXT,
    cached_models_json TEXT,
    health_status TEXT NOT NULL DEFAULT 'unconfigured',
    avg_latency_ms INTEGER DEFAULT 0,
    model_available INTEGER NOT NULL DEFAULT 1,
    last_error TEXT,
    last_checked_at TEXT,
    UNIQUE(user_id, provider_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    label TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    masked_key TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    priority INTEGER NOT NULL DEFAULT 1,
    total_requests INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    rate_limit_hits INTEGER NOT NULL DEFAULT 0,
    avg_latency_ms INTEGER NOT NULL DEFAULT 0,
    last_status TEXT NOT NULL DEFAULT 'untested',
    last_error TEXT,
    last_tested_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS api_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    key_id TEXT,
    model TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    rate_limited INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const rawSecret =
  process.env.ENCRYPTION_KEY ||
  process.env.JWT_SECRET ||
  "mkai-manish-meena-aes-256-gcm-key-seed";
const AES_KEY = crypto.scryptSync(rawSecret, "mkai-salt-2026", 32);

export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", AES_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(cipherText: string): string {
  const parts = cipherText.split(":");
  if (parts.length !== 3) return "";
  const [ivHex, tagHex, dataHex] = parts;
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    AES_KEY,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "••••" + trimmed.slice(-2);
  return `${trimmed.slice(0, 4)}••••${trimmed.slice(-4)}`;
}

export function initializeUserProviderDefaults(userId: string): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO user_provider_configs
    (id, user_id, provider_id, enabled, selected_model, custom_base_url, health_status, model_available)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const p of PROVIDER_CATALOG) {
    const isGemini = p.id === "gemini";
    const hasEnvGemini = Boolean(process.env.GEMINI_API_KEY);
    insert.run(
      crypto.randomUUID(),
      userId,
      p.id,
      isGemini ? 1 : 0,
      p.defaultModel,
      p.baseUrl,
      isGemini ? (hasEnvGemini ? "healthy" : "env_pending") : "unconfigured",
      1
    );
  }
}

export function seedAdminUser(): void {
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get("manish@mkai.dev") as { id: string } | undefined;

  if (!existing) {
    const adminId = crypto.randomUUID();
    const now = new Date().toISOString();
    const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || "Manish@MKAI2026";
    const hash = bcrypt.hashSync(adminPassword, 10);

    db.prepare(`
      INSERT INTO users
      (id, name, email, password_hash, role, preferred_language, theme, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(adminId, "Manish Meena", "manish@mkai.dev", hash, "admin", "hi", "dark", now, now);

    initializeUserProviderDefaults(adminId);
  } else {
    initializeUserProviderDefaults(existing.id);
  }
}

export function migrateDeprecatedModels(): void {
  try {
    db.exec(`ALTER TABLE user_provider_configs ADD COLUMN cached_models_json TEXT`);
  } catch {
    // Column already exists
  }

  const groqReplacement = "openai/gpt-oss-120b";

  db.prepare(
    `UPDATE user_provider_configs
     SET selected_model = ?,
         model_available = 1,
         last_error = CASE WHEN last_error LIKE '%does not exist%' THEN NULL ELSE last_error END
     WHERE provider_id = 'groq'
       AND cached_models_json IS NULL
       AND selected_model != ?`
  ).run(groqReplacement, groqReplacement);

  db.prepare(
    `UPDATE users
     SET default_model = ?
     WHERE default_provider_id = 'groq'
       AND default_model != ?
       AND id IN (
         SELECT user_id FROM user_provider_configs
         WHERE provider_id = 'groq' AND cached_models_json IS NULL
       )`
  ).run(groqReplacement, groqReplacement);
}

migrateDeprecatedModels();
seedAdminUser();
