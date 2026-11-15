export type PageRoute =
  | "home"
  | "chat"
  | "dashboard"
  | "settings"
  | "about"
  | "download"
  | "login"
  | "register";

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  preferredLanguage: "hi" | "en";
  theme: "dark" | "light";
  voiceEnabled: boolean;
  ttsRate: number;
  autoSelectProvider: boolean;
  defaultProviderId: string;
  defaultModel: string;
  createdAt?: string;
}

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

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  command?: IntentCommand | null;
  providerId?: string | null;
  model?: string | null;
  latencyMs?: number | null;
  tokensUsed?: number;
  failoverUsed?: boolean;
  failoverFrom?: string;
  failoverReason?: string;
  deviceFeedback?: string | null;
  created_at?: string;
}

export interface ConversationItem {
  id: string;
  title: string;
  last_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKeyItem {
  id: string;
  provider_id: string;
  label: string;
  masked_key: string;
  is_active: number;
  priority: number;
  total_requests: number;
  error_count: number;
  rate_limit_hits: number;
  avg_latency_ms: number;
  last_status: string;
  last_error: string | null;
  last_tested_at: string | null;
  created_at: string;
}

export interface ProviderItem {
  id: string;
  name: string;
  category: string;
  baseUrl: string;
  defaultModel: string;
  models: string[];
  modelSource?: "live" | "cached" | "default";
  requiresKey: boolean;
  supportsUsageEndpoint: boolean;
  docsUrl: string;
  enabled: boolean;
  selectedModel: string;
  customBaseUrl: string;
  healthStatus: string;
  avgLatencyMs: number;
  modelAvailable: boolean;
  lastError: string | null;
  lastCheckedAt: string | null;
  envKeyActive: boolean;
  keys: ApiKeyItem[];
  usage: {
    totalCalls: number;
    errorCalls: number;
    rateLimits: number;
    totalTokens: number;
  };
}

export interface FetchModelsResponse {
  ok: boolean;
  providerId: string;
  statusCode: number;
  models: string[];
  defaultModel: string;
  selectedModel: string;
  source: "live" | "cached" | "default";
  error?: string;
}

export interface ApiLogItem {
  id: string;
  provider_id: string;
  model: string;
  status_code: number;
  latency_ms: number;
  tokens_used: number;
  rate_limited: number;
  error_message: string | null;
  created_at: string;
}
