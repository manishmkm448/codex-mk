import express, { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import JSZip from "jszip";
import {
  db,
  encryptSecret,
  initializeUserProviderDefaults,
  maskApiKey,
  PROVIDER_CATALOG,
} from "./db.ts";
import {
  fetchProviderModels,
  invalidateProviderModelsCache,
  runAssistantTurn,
  testProviderConnection,
} from "./providers.ts";

const JWT_SECRET =
  process.env.JWT_SECRET || "mkai-manish-meena-jwt-secret-2026-dev";

interface AuthUserPayload {
  id: string;
  email: string;
  role: "admin" | "user";
}

interface AuthedRequest extends Request {
  user?: AuthUserPayload;
}

// Sliding-window rate limiter per IP + route bucket
const rateBuckets = new Map<string, number[]>();

function createRateLimiter(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const key = `${ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    const history = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
    if (history.length >= maxRequests) {
      const retrySec = Math.ceil((windowMs - (now - history[0])) / 1000);
      res.setHeader("Retry-After", String(retrySec));
      res.status(429).json({
        error: "Rate limit exceeded. Please wait before sending more requests.",
        retryAfterSeconds: retrySec,
      });
      return;
    }
    history.push(now);
    rateBuckets.set(key, history);
    next();
  };
}

function signToken(user: AuthUserPayload): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUserPayload;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session token." });
  }
}

function sanitizeUser(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    preferredLanguage: row.preferred_language,
    theme: row.theme,
    voiceEnabled: Boolean(row.voice_enabled),
    ttsRate: Number(row.tts_rate ?? 1),
    autoSelectProvider: Boolean(row.auto_select_provider),
    defaultProviderId: row.default_provider_id,
    defaultModel: row.default_model,
    createdAt: row.created_at,
  };
}

function collectFilesRecursive(dir: string, baseDir: string): Array<{ relPath: string; fullPath: string }> {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: Array<{ relPath: string; fullPath: string }> = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFilesRecursive(full, baseDir));
    } else {
      const rel = path.relative(baseDir, full).replace(/\\/g, "/");
      results.push({ relPath: rel, fullPath: full });
    }
  }
  return results.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

export function createApiRouter() {
  const router = express.Router();
  const standardLimiter = createRateLimiter(120, 60_000);
  const aiLimiter = createRateLimiter(30, 60_000);

  router.use(standardLimiter);

  router.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      app: "M.K AI",
      developer: "Manish Meena",
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      providersCount: PROVIDER_CATALOG.length,
    });
  });

  // --- AUTHENTICATION ---
  router.post("/auth/register", (req, res) => {
    try {
      const { name, email, password, preferredLanguage } = req.body as {
        name?: string;
        email?: string;
        password?: string;
        preferredLanguage?: string;
      };

      if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
        res.status(400).json({
          error: "Name, valid email, and password (min 6 chars) are required.",
        });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const existing = db
        .prepare("SELECT id FROM users WHERE email = ?")
        .get(normalizedEmail);
      if (existing) {
        res.status(409).json({ error: "An account with this email already exists." });
        return;
      }

      const userId = crypto.randomUUID();
      const now = new Date().toISOString();
      const hash = bcrypt.hashSync(password, 10);
      const lang = preferredLanguage === "en" ? "en" : "hi";

      db.prepare(
        `INSERT INTO users
         (id, name, email, password_hash, role, preferred_language, theme, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'user', ?, 'dark', ?, ?)`
      ).run(userId, name.trim(), normalizedEmail, hash, lang, now, now);

      initializeUserProviderDefaults(userId);

      const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(userId)!;
      const token = signToken({ id: userId, email: normalizedEmail, role: "user" });

      res.status(201).json({ token, user: sanitizeUser(userRow) });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.post("/auth/login", (req, res) => {
    try {
      const { email, password } = req.body as { email?: string; password?: string };
      if (!email?.trim() || !password) {
        res.status(400).json({ error: "Email and password are required." });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const userRow = db
        .prepare("SELECT * FROM users WHERE email = ?")
        .get(normalizedEmail) as Record<string, unknown> | undefined;

      if (!userRow || !bcrypt.compareSync(password, String(userRow.password_hash))) {
        res.status(401).json({ error: "Invalid email or password." });
        return;
      }

      initializeUserProviderDefaults(String(userRow.id));
      const token = signToken({
        id: String(userRow.id),
        email: String(userRow.email),
        role: userRow.role === "admin" ? "admin" : "user",
      });

      res.json({ token, user: sanitizeUser(userRow) });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.post("/auth/google", async (req, res) => {
    try {
      const { idToken } = req.body as { idToken?: string };
      if (!idToken) {
        res.status(400).json({ error: "Google ID token is required." });
        return;
      }

      const verifyRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
      );
      if (!verifyRes.ok) {
        res.status(401).json({ error: "Failed to verify Google Sign-In token." });
        return;
      }
      const payload = (await verifyRes.json()) as {
        sub?: string;
        email?: string;
        name?: string;
        email_verified?: string;
      };

      if (!payload.email || payload.email_verified !== "true") {
        res.status(401).json({ error: "Google account email is not verified." });
        return;
      }

      const normalizedEmail = payload.email.toLowerCase();
      let userRow = db
        .prepare("SELECT * FROM users WHERE email = ?")
        .get(normalizedEmail) as Record<string, unknown> | undefined;

      if (!userRow) {
        const userId = crypto.randomUUID();
        const now = new Date().toISOString();
        const randomHash = bcrypt.hashSync(crypto.randomBytes(24).toString("hex"), 10);
        db.prepare(
          `INSERT INTO users
           (id, name, email, password_hash, role, preferred_language, theme, google_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'user', 'hi', 'dark', ?, ?, ?)`
        ).run(
          userId,
          payload.name || normalizedEmail.split("@")[0],
          normalizedEmail,
          randomHash,
          payload.sub || null,
          now,
          now
        );
        initializeUserProviderDefaults(userId);
        userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(userId)!;
      }

      const token = signToken({
        id: String(userRow.id),
        email: String(userRow.email),
        role: userRow.role === "admin" ? "admin" : "user",
      });
      res.json({ token, user: sanitizeUser(userRow) });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.post("/auth/forgot-password", (req, res) => {
    try {
      const { email } = req.body as { email?: string };
      if (!email?.trim()) {
        res.status(400).json({ error: "Email is required." });
        return;
      }
      const user = db
        .prepare("SELECT id FROM users WHERE email = ?")
        .get(email.trim().toLowerCase()) as { id: string } | undefined;

      if (!user) {
        res.json({
          message: "If an account exists for that email, a reset token has been generated.",
        });
        return;
      }

      const resetToken = crypto.randomBytes(16).toString("hex");
      const now = new Date();
      const expires = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

      db.prepare(
        `INSERT INTO password_resets (id, user_id, token, expires_at, used, created_at)
         VALUES (?, ?, ?, ?, 0, ?)`
      ).run(crypto.randomUUID(), user.id, resetToken, expires, now.toISOString());

      res.json({
        message: "Password reset token generated (valid for 30 minutes).",
        resetToken,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.post("/auth/reset-password", (req, res) => {
    try {
      const { token, newPassword } = req.body as {
        token?: string;
        newPassword?: string;
      };
      if (!token?.trim() || !newPassword || newPassword.length < 6) {
        res.status(400).json({
          error: "Valid reset token and new password (min 6 chars) are required.",
        });
        return;
      }

      const resetRow = db
        .prepare(
          `SELECT id, user_id, expires_at, used FROM password_resets WHERE token = ?`
        )
        .get(token.trim()) as
        | { id: string; user_id: string; expires_at: string; used: number }
        | undefined;

      if (
        !resetRow ||
        resetRow.used === 1 ||
        new Date(resetRow.expires_at).getTime() < Date.now()
      ) {
        res.status(400).json({ error: "Reset token is invalid or expired." });
        return;
      }

      const hash = bcrypt.hashSync(newPassword, 10);
      db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(
        hash,
        new Date().toISOString(),
        resetRow.user_id
      );
      db.prepare("UPDATE password_resets SET used = 1 WHERE id = ?").run(resetRow.id);

      res.json({ message: "Password updated successfully. You can now log in." });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.get("/auth/me", requireAuth, (req: AuthedRequest, res) => {
    const userRow = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(req.user!.id);
    if (!userRow) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    res.json({ user: sanitizeUser(userRow) });
  });

  router.patch("/auth/profile", requireAuth, (req: AuthedRequest, res) => {
    try {
      const {
        name,
        preferredLanguage,
        theme,
        voiceEnabled,
        ttsRate,
        autoSelectProvider,
        defaultProviderId,
        defaultModel,
      } = req.body as Record<string, unknown>;

      const current = db
        .prepare("SELECT * FROM users WHERE id = ?")
        .get(req.user!.id) as Record<string, unknown> | undefined;
      if (!current) {
        res.status(404).json({ error: "User not found." });
        return;
      }

      db.prepare(
        `UPDATE users SET
          name = ?,
          preferred_language = ?,
          theme = ?,
          voice_enabled = ?,
          tts_rate = ?,
          auto_select_provider = ?,
          default_provider_id = ?,
          default_model = ?,
          updated_at = ?
         WHERE id = ?`
      ).run(
        typeof name === "string" && name.trim() ? name.trim() : String(current.name),
        preferredLanguage === "en" || preferredLanguage === "hi"
          ? preferredLanguage
          : String(current.preferred_language),
        theme === "light" || theme === "dark" ? theme : String(current.theme),
        typeof voiceEnabled === "boolean"
          ? voiceEnabled
            ? 1
            : 0
          : Number(current.voice_enabled),
        typeof ttsRate === "number"
          ? Math.min(2, Math.max(0.5, ttsRate))
          : Number(current.tts_rate),
        typeof autoSelectProvider === "boolean"
          ? autoSelectProvider
            ? 1
            : 0
          : Number(current.auto_select_provider),
        typeof defaultProviderId === "string"
          ? defaultProviderId
          : String(current.default_provider_id),
        typeof defaultModel === "string"
          ? defaultModel
          : String(current.default_model),
        new Date().toISOString(),
        req.user!.id
      );

      const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user!.id)!;
      res.json({ user: sanitizeUser(updated) });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // --- ADMIN OVERVIEW (Manish Meena only) ---
  router.get("/admin/overview", requireAuth, (req: AuthedRequest, res) => {
    if (req.user!.role !== "admin") {
      res.status(403).json({ error: "Admin privileges required." });
      return;
    }
    const usersCount = (
      db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }
    ).c;
    const convCount = (
      db.prepare("SELECT COUNT(*) as c FROM conversations").get() as { c: number }
    ).c;
    const msgCount = (
      db.prepare("SELECT COUNT(*) as c FROM messages").get() as { c: number }
    ).c;
    const recentUsers = db
      .prepare(
        "SELECT id, name, email, role, preferred_language, created_at FROM users ORDER BY created_at DESC LIMIT 20"
      )
      .all();
    res.json({ usersCount, convCount, msgCount, recentUsers });
  });

  // --- CONVERSATIONS & CHAT (Strictly isolated per user) ---
  router.get("/conversations", requireAuth, (req: AuthedRequest, res) => {
    const rows = db
      .prepare(
        `SELECT c.*, (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
         FROM conversations c
         WHERE c.user_id = ?
         ORDER BY c.updated_at DESC`
      )
      .all(req.user!.id);
    res.json({ conversations: rows });
  });

  router.post("/conversations", requireAuth, (req: AuthedRequest, res) => {
    const { title } = req.body as { title?: string };
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO conversations (id, user_id, title, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, req.user!.id, title?.trim() || "New Conversation", now, now);

    db.prepare(
      `INSERT INTO messages (id, conversation_id, user_id, role, content, provider_id, model, created_at)
       VALUES (?, ?, ?, 'assistant', ?, 'gemini', 'gemini-4-hydrogen', ?)`
    ).run(
      crypto.randomUUID(),
      id,
      req.user!.id,
      "Hello! I am M.K AI, your personal AI assistant. I was developed by Manish Meena. How can I help you today?",
      now
    );

    const created = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id);
    res.status(201).json({ conversation: created });
  });

  router.get("/conversations/:id/messages", requireAuth, (req: AuthedRequest, res) => {
    const conv = db
      .prepare("SELECT id FROM conversations WHERE id = ? AND user_id = ?")
      .get(req.params.id, req.user!.id);
    if (!conv) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }

    const rows = db
      .prepare(
        "SELECT * FROM messages WHERE conversation_id = ? AND user_id = ? ORDER BY created_at ASC"
      )
      .all(req.params.id, req.user!.id)
      .map((m) => ({
        ...m,
        command: m.intent_action_json
          ? JSON.parse(String(m.intent_action_json))
          : null,
      }));

    res.json({ messages: rows });
  });

  router.delete("/conversations/:id", requireAuth, (req: AuthedRequest, res) => {
    const result = db
      .prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?")
      .run(req.params.id, req.user!.id);
    if (Number(result.changes) === 0) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }
    res.json({ deleted: true });
  });

  router.post("/chat", requireAuth, aiLimiter, async (req: AuthedRequest, res) => {
    try {
      const { conversationId, message, providerId, model } = req.body as {
        conversationId?: string;
        message?: string;
        providerId?: string;
        model?: string;
      };

      if (!message?.trim()) {
        res.status(400).json({ error: "Message is required." });
        return;
      }

      const userId = req.user!.id;
      const userRow = db
        .prepare("SELECT * FROM users WHERE id = ?")
        .get(userId) as Record<string, unknown>;

      let activeConvId = conversationId;
      const now = new Date().toISOString();

      if (activeConvId) {
        const owns = db
          .prepare("SELECT id FROM conversations WHERE id = ? AND user_id = ?")
          .get(activeConvId, userId);
        if (!owns) {
          res.status(404).json({ error: "Conversation not found." });
          return;
        }
      } else {
        activeConvId = crypto.randomUUID();
        const snippet = message.trim().slice(0, 48);
        db.prepare(
          `INSERT INTO conversations (id, user_id, title, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`
        ).run(activeConvId, userId, snippet, now, now);
      }

      const userMsgId = crypto.randomUUID();
      db.prepare(
        `INSERT INTO messages (id, conversation_id, user_id, role, content, created_at)
         VALUES (?, ?, ?, 'user', ?, ?)`
      ).run(userMsgId, activeConvId, userId, message.trim(), now);

      const historyRows = db
        .prepare(
          `SELECT role, content FROM messages
           WHERE conversation_id = ? AND user_id = ?
           ORDER BY created_at ASC LIMIT 20`
        )
        .all(activeConvId, userId) as Array<{ role: "user" | "assistant"; content: string }>;

      const effectiveProviderId =
        providerId || String(userRow.default_provider_id || "gemini");
      const effectivePreferredModel =
        model?.trim() ||
        (effectiveProviderId === String(userRow.default_provider_id || "gemini")
          ? String(userRow.default_model || "")
          : undefined);

      const turn = await runAssistantTurn({
        userId,
        messages: historyRows,
        preferredProviderId: effectiveProviderId,
        preferredModel: effectivePreferredModel || undefined,
        autoSelect: Boolean(userRow.auto_select_provider),
      });

      const assistantMsgId = crypto.randomUUID();
      const replyNow = new Date().toISOString();
      db.prepare(
        `INSERT INTO messages
         (id, conversation_id, user_id, role, content, provider_id, model, intent_action_json, latency_ms, created_at)
         VALUES (?, ?, ?, 'assistant', ?, ?, ?, ?, ?, ?)`
      ).run(
        assistantMsgId,
        activeConvId,
        userId,
        turn.reply,
        turn.providerId,
        turn.model,
        JSON.stringify(turn.command),
        turn.latencyMs,
        replyNow
      );

      db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(
        replyNow,
        activeConvId
      );

      res.json({
        conversationId: activeConvId,
        message: {
          id: assistantMsgId,
          role: "assistant",
          content: turn.reply,
          command: turn.command,
          providerId: turn.providerId,
          model: turn.model,
          latencyMs: turn.latencyMs,
          tokensUsed: turn.tokensUsed,
          failoverUsed: turn.failoverUsed,
          failoverFrom: turn.failoverFrom,
          failoverReason: turn.failoverReason,
          created_at: replyNow,
        },
      });
    } catch (err) {
      const statusCode = (err as { status?: number }).status;
      const httpStatus =
        typeof statusCode === "number" && statusCode >= 400 && statusCode <= 599
          ? statusCode
          : 502;
      res.status(httpStatus).json({ error: (err as Error).message, statusCode: httpStatus });
    }
  });

  // Unauthenticated live Gemini preview (no DB storage, isolated from all user accounts)
  router.post("/chat/preview", aiLimiter, async (req, res) => {
    try {
      const { message } = req.body as { message?: string };
      if (!message?.trim()) {
        res.status(400).json({ error: "Message is required." });
        return;
      }
      if (!process.env.GEMINI_API_KEY) {
        res.status(503).json({
          error: "Server Gemini API key is not configured yet. Please sign in or configure a provider key.",
        });
        return;
      }

      const { GoogleGenAI, ThinkingLevel } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } },
      });
      const start = Date.now();
      const response = await ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: message.trim(),
        config: {
          systemInstruction:
            'You are M.K AI, a personal AI assistant developed by Manish Meena. Understand Hindi, Hinglish, and English. Respond as pure JSON: {"reply":"...","command":{"action":"OPEN_APP|OPEN_CAMERA|DIAL_PHONE|SEND_SMS|GET_BATTERY|TOGGLE_FLASHLIGHT|ADJUST_VOLUME|OPEN_WIFI_SETTINGS|OPEN_BLUETOOTH_SETTINGS|OPEN_LOCATION_SETTINGS|ADJUST_BRIGHTNESS|GET_DEVICE_INFO|GET_DATETIME|OPEN_NOTIFICATION_SETTINGS|OPEN_SETTINGS|NONE","target":"optional","value":"optional","requiresConfirmation":false}}',
          responseMimeType: "application/json",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      const latencyMs = Date.now() - start;
      let parsed = {
        reply: response.text || "Hello! I am M.K AI developed by Manish Meena.",
        command: { action: "NONE", requiresConfirmation: false },
      };
      try {
        parsed = JSON.parse((response.text || "").trim());
      } catch {
        // keep text fallback
      }
      res.json({
        message: {
          id: crypto.randomUUID(),
          role: "assistant",
          content: parsed.reply,
          command: parsed.command,
          providerId: "gemini",
          model: "gemini-4-hydrogen",
          latencyMs,
          created_at: new Date().toISOString(),
        },
      });
    } catch (err) {
      res.status(502).json({ error: (err as Error).message });
    }
  });

  // --- API KEY & MULTI-PROVIDER MANAGER ---
  router.get("/providers", requireAuth, (req: AuthedRequest, res) => {
    const userId = req.user!.id;
    initializeUserProviderDefaults(userId);

    const userRow = db
      .prepare(
        "SELECT auto_select_provider, default_provider_id, default_model FROM users WHERE id = ?"
      )
      .get(userId) as {
      auto_select_provider: number;
      default_provider_id: string;
      default_model: string;
    };

    const configs = db
      .prepare("SELECT * FROM user_provider_configs WHERE user_id = ?")
      .all(userId) as Array<Record<string, unknown>>;
    const configMap = new Map(configs.map((c) => [String(c.provider_id), c]));

    const keys = db
      .prepare(
        `SELECT id, provider_id, label, masked_key, is_active, priority,
                total_requests, error_count, rate_limit_hits, avg_latency_ms,
                last_status, last_error, last_tested_at, created_at
         FROM api_keys WHERE user_id = ? ORDER BY priority ASC, created_at ASC`
      )
      .all(userId) as Array<Record<string, unknown>>;

    const usageRows = db
      .prepare(
        `SELECT provider_id,
                COUNT(*) as total_calls,
                SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_calls,
                SUM(rate_limited) as rate_limits,
                SUM(tokens_used) as total_tokens,
                ROUND(AVG(latency_ms)) as avg_latency
         FROM api_logs WHERE user_id = ? GROUP BY provider_id`
      )
      .all(userId) as Array<Record<string, unknown>>;
    const usageMap = new Map(usageRows.map((u) => [String(u.provider_id), u]));

    const providers = PROVIDER_CATALOG.map((meta) => {
      const cfg = configMap.get(meta.id);
      const providerKeys = keys.filter((k) => k.provider_id === meta.id);
      const usage = usageMap.get(meta.id);
      const hasEnvKey =
        (meta.id === "gemini" && Boolean(process.env.GEMINI_API_KEY)) ||
        (meta.id === "groq" && Boolean(process.env.GROQ_API_KEY));

      let resolvedModels = meta.models;
      let modelSource: "cached" | "default" = "default";
      if (cfg?.cached_models_json) {
        try {
          const parsed = JSON.parse(String(cfg.cached_models_json)) as unknown;
          if (Array.isArray(parsed)) {
            const cleaned = parsed.filter(
              (m): m is string => typeof m === "string" && m.trim().length > 0
            );
            if (cleaned.length > 0) {
              resolvedModels = cleaned;
              modelSource = "cached";
            }
          }
        } catch {
          // keep catalog default
        }
      }

      const selectedModel = String(cfg?.selected_model || meta.defaultModel);
      if (selectedModel && !resolvedModels.includes(selectedModel)) {
        resolvedModels = [selectedModel, ...resolvedModels];
      }

      return {
        ...meta,
        models: resolvedModels,
        modelSource,
        enabled: Boolean(cfg?.enabled),
        selectedModel,
        customBaseUrl: cfg?.custom_base_url || meta.baseUrl,
        healthStatus: cfg?.health_status || "unconfigured",
        avgLatencyMs: Number(cfg?.avg_latency_ms || usage?.avg_latency || 0),
        modelAvailable: Boolean(cfg?.model_available ?? 1),
        lastError: cfg?.last_error || null,
        lastCheckedAt: cfg?.last_checked_at || null,
        envKeyActive: hasEnvKey,
        keys: providerKeys,
        usage: {
          totalCalls: Number(usage?.total_calls || 0),
          errorCalls: Number(usage?.error_calls || 0),
          rateLimits: Number(usage?.rate_limits || 0),
          totalTokens: Number(usage?.total_tokens || 0),
        },
      };
    });

    res.json({
      autoSelectProvider: Boolean(userRow.auto_select_provider),
      defaultProviderId: userRow.default_provider_id,
      defaultModel: userRow.default_model,
      providers,
    });
  });

  router.get("/providers/:providerId/models", requireAuth, async (req: AuthedRequest, res) => {
    const providerId = String(req.params.providerId);
    const forceRefresh = req.query.refresh === "true" || req.query.refresh === "1";
    const result = await fetchProviderModels({
      userId: req.user!.id,
      providerId,
      forceRefresh,
    });
    res.json(result);
  });

  router.patch("/providers/:providerId", requireAuth, (req: AuthedRequest, res) => {
    const { providerId } = req.params;
    const { enabled, selectedModel, customBaseUrl, setAsDefault } = req.body as {
      enabled?: boolean;
      selectedModel?: string;
      customBaseUrl?: string;
      setAsDefault?: boolean;
    };

    const meta = PROVIDER_CATALOG.find((p) => p.id === providerId);
    if (!meta) {
      res.status(404).json({ error: "Provider not found." });
      return;
    }

    const userId = req.user!.id;
    initializeUserProviderDefaults(userId);

    const current = db
      .prepare(
        "SELECT * FROM user_provider_configs WHERE user_id = ? AND provider_id = ?"
      )
      .get(userId, providerId) as Record<string, unknown>;

    const nextEnabled =
      typeof enabled === "boolean" ? (enabled ? 1 : 0) : Number(current.enabled);
    const nextModel =
      typeof selectedModel === "string" && selectedModel.trim()
        ? selectedModel.trim()
        : String(current.selected_model);
    const nextBaseUrl =
      typeof customBaseUrl === "string" && customBaseUrl.trim()
        ? customBaseUrl.trim()
        : String(current.custom_base_url || meta.baseUrl);

    db.prepare(
      `UPDATE user_provider_configs
       SET enabled = ?, selected_model = ?, custom_base_url = ?
       WHERE user_id = ? AND provider_id = ?`
    ).run(nextEnabled, nextModel, nextBaseUrl, userId, providerId);

    if (setAsDefault) {
      db.prepare(
        `UPDATE users SET default_provider_id = ?, default_model = ?, updated_at = ? WHERE id = ?`
      ).run(providerId, nextModel, new Date().toISOString(), userId);
    }

    res.json({ updated: true });
  });

  router.post("/providers/:providerId/test", requireAuth, async (req: AuthedRequest, res) => {
    const { providerId } = req.params;
    const { model, apiKey } = req.body as { model?: string; apiKey?: string };
    const result = await testProviderConnection({
      userId: req.user!.id,
      providerId,
      model,
      overrideKey: apiKey,
    });
    res.json(result);
  });

  router.post("/keys", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { providerId, label, apiKey, priority } = req.body as {
        providerId?: string;
        label?: string;
        apiKey?: string;
        priority?: number;
      };

      if (!providerId || !apiKey?.trim()) {
        res.status(400).json({ error: "Provider ID and API key are required." });
        return;
      }

      const meta = PROVIDER_CATALOG.find((p) => p.id === providerId);
      if (!meta) {
        res.status(404).json({ error: "Unknown provider." });
        return;
      }

      const keyId = crypto.randomUUID();
      const now = new Date().toISOString();
      const encrypted = encryptSecret(apiKey.trim());
      const masked = maskApiKey(apiKey.trim());

      db.prepare(
        `INSERT INTO api_keys
         (id, user_id, provider_id, label, encrypted_key, masked_key, is_active, priority, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`
      ).run(
        keyId,
        req.user!.id,
        providerId,
        label?.trim() || `${meta.name} Key`,
        encrypted,
        masked,
        Number(priority ?? 1),
        now
      );

      db.prepare(
        `UPDATE user_provider_configs SET enabled = 1, health_status = 'configured' WHERE user_id = ? AND provider_id = ?`
      ).run(req.user!.id, providerId);

      invalidateProviderModelsCache(req.user!.id, providerId);

      let syncedModels: string[] | undefined;
      if (providerId === "groq") {
        const fetchRes = await fetchProviderModels({
          userId: req.user!.id,
          providerId: "groq",
          overrideKey: apiKey.trim(),
          forceRefresh: true,
        });
        if (fetchRes.ok) {
          syncedModels = fetchRes.models;
        }
      }

      res.status(201).json({
        key: {
          id: keyId,
          provider_id: providerId,
          label: label?.trim() || `${meta.name} Key`,
          masked_key: masked,
          is_active: 1,
          priority: Number(priority ?? 1),
          last_status: "untested",
          created_at: now,
        },
        syncedModels,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.patch("/keys/:keyId", requireAuth, (req: AuthedRequest, res) => {
    const { label, apiKey, isActive, priority } = req.body as {
      label?: string;
      apiKey?: string;
      isActive?: boolean;
      priority?: number;
    };

    const row = db
      .prepare("SELECT * FROM api_keys WHERE id = ? AND user_id = ?")
      .get(req.params.keyId, req.user!.id) as Record<string, unknown> | undefined;

    if (!row) {
      res.status(404).json({ error: "API key not found." });
      return;
    }

    const nextEncrypted =
      apiKey && apiKey.trim() ? encryptSecret(apiKey.trim()) : String(row.encrypted_key);
    const nextMasked =
      apiKey && apiKey.trim() ? maskApiKey(apiKey.trim()) : String(row.masked_key);

    db.prepare(
      `UPDATE api_keys
       SET label = ?, encrypted_key = ?, masked_key = ?, is_active = ?, priority = ?
       WHERE id = ? AND user_id = ?`
    ).run(
      label?.trim() || String(row.label),
      nextEncrypted,
      nextMasked,
      typeof isActive === "boolean" ? (isActive ? 1 : 0) : Number(row.is_active),
      typeof priority === "number" ? priority : Number(row.priority),
      req.params.keyId,
      req.user!.id
    );

    invalidateProviderModelsCache(req.user!.id, String(row.provider_id));

    res.json({ updated: true, masked_key: nextMasked });
  });

  router.delete("/keys/:keyId", requireAuth, (req: AuthedRequest, res) => {
    const existing = db
      .prepare("SELECT provider_id FROM api_keys WHERE id = ? AND user_id = ?")
      .get(req.params.keyId, req.user!.id) as { provider_id: string } | undefined;

    const result = db
      .prepare("DELETE FROM api_keys WHERE id = ? AND user_id = ?")
      .run(req.params.keyId, req.user!.id);
    if (Number(result.changes) === 0) {
      res.status(404).json({ error: "API key not found." });
      return;
    }
    if (existing) {
      invalidateProviderModelsCache(req.user!.id, existing.provider_id);
    }
    res.json({ deleted: true });
  });

  router.post("/keys/:keyId/test", requireAuth, async (req: AuthedRequest, res) => {
    const row = db
      .prepare("SELECT id, provider_id FROM api_keys WHERE id = ? AND user_id = ?")
      .get(req.params.keyId, req.user!.id) as
      | { id: string; provider_id: string }
      | undefined;

    if (!row) {
      res.status(404).json({ error: "API key not found." });
      return;
    }

    const result = await testProviderConnection({
      userId: req.user!.id,
      providerId: row.provider_id,
      keyId: row.id,
    });
    res.json(result);
  });

  router.get("/analytics/api-usage", requireAuth, (req: AuthedRequest, res) => {
    const logs = db
      .prepare(
        `SELECT id, provider_id, model, status_code, latency_ms, tokens_used, rate_limited, error_message, created_at
         FROM api_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 40`
      )
      .all(req.user!.id);

    const summary = db
      .prepare(
        `SELECT COUNT(*) as totalRequests,
                SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as totalErrors,
                SUM(rate_limited) as rateLimitHits,
                SUM(tokens_used) as totalTokens,
                ROUND(AVG(latency_ms)) as avgLatencyMs
         FROM api_logs WHERE user_id = ?`
      )
      .get(req.user!.id);

    res.json({ summary, logs });
  });

  // --- NATIVE ANDROID STUDIO PROJECT EXPLORER & REAL ZIP DOWNLOAD ---
  const androidRoot = path.resolve(process.cwd(), "android-app");

  router.get("/android/tree", (_req, res) => {
    const files = collectFilesRecursive(androidRoot, androidRoot).map((f) => ({
      path: f.relPath,
      size: fs.statSync(f.fullPath).size,
    }));
    res.json({ root: "android-app", files });
  });

  router.get("/android/file", (req, res) => {
    const rel = String(req.query.path || "");
    const resolved = path.resolve(androidRoot, rel);
    if (!resolved.startsWith(androidRoot + path.sep) || !fs.existsSync(resolved)) {
      res.status(404).json({ error: "Android project file not found." });
      return;
    }
    const content = fs.readFileSync(resolved, "utf8");
    res.json({ path: rel, content });
  });

  router.get("/android/download-project", async (_req, res) => {
    try {
      const files = collectFilesRecursive(androidRoot, androidRoot);
      if (files.length === 0) {
        res.status(404).json({ error: "Android project source directory not found." });
        return;
      }

      const zip = new JSZip();
      const folder = zip.folder("M.K-AI-Android");
      for (const file of files) {
        folder?.file(file.relPath, fs.readFileSync(file.fullPath));
      }

      const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="M.K-AI-Android-Studio-Project.zip"'
      );
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  return router;
}
