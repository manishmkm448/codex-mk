import React, { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Send,
  Plus,
  Trash2,
  Volume2,
  VolumeX,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  History,
} from "lucide-react";
import { AiOrb } from "../components/AiOrb";
import { VoiceWaveform } from "../components/VoiceWaveform";
import { apiRequest } from "../lib/api";
import { executeWebAction, speakAssistantReply } from "../lib/webDeviceActions";
import {
  ChatMessage,
  ConversationItem,
  FetchModelsResponse,
  PageRoute,
  ProviderItem,
  UserProfile,
} from "../types/mkai";

interface ChatPageProps {
  user: UserProfile | null;
  initialPrompt: string | null;
  onConsumeInitialPrompt: () => void;
  onNavigate: (page: PageRoute) => void;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const WELCOME_MSG: ChatMessage = {
  id: "mkai_welcome",
  role: "assistant",
  content:
    "Hello! I am M.K AI, your personal AI assistant. I was developed by Manish Meena. How can I help you today?",
};

const QUICK_ACTIONS = [
  "Hey M.K AI, YouTube kholo",
  "M.K AI, flashlight on karo",
  "M.K AI, battery kitni hai?",
  "M.K AI, camera kholo",
  "M.K AI, mujhe time batao",
  "M.K AI, Google kholo",
  "M.K AI, volume kam karo",
];

export const ChatPage: React.FC<ChatPageProps> = ({
  user,
  initialPrompt,
  onConsumeInitialPrompt,
  onNavigate,
}) => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceLang, setVoiceLang] = useState<"hi" | "en">(
    user?.preferredLanguage || "hi"
  );
  const [ttsEnabled, setTtsEnabled] = useState(user?.voiceEnabled ?? true);
  const [continuousVoice, setContinuousVoice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderItem[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    user?.defaultProviderId || "gemini"
  );
  const [selectedModel, setSelectedModel] = useState<string>(
    user?.defaultModel || "gemini-4-hydrogen"
  );
  const [pendingConfirm, setPendingConfirm] = useState<{
    action: string;
    target?: string;
    url?: string;
  } | null>(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [convData, provData] = await Promise.all([
          apiRequest<{ conversations: ConversationItem[] }>("/api/conversations"),
          apiRequest<{ providers: ProviderItem[]; defaultProviderId: string }>(
            "/api/providers"
          ),
        ]);
        if (cancelled) return;
        setConversations(convData.conversations);
        const enabledProviders = provData.providers.filter((p) => p.enabled);
        setProviders(enabledProviders);
        const activeId = provData.defaultProviderId || "gemini";
        setSelectedProviderId(activeId);
        const activeProv = enabledProviders.find((p) => p.id === activeId);
        if (activeProv) {
          setSelectedModel(activeProv.selectedModel || activeProv.defaultModel);
        }
        if (convData.conversations.length > 0 && !activeConvId) {
          const firstId = convData.conversations[0].id;
          setActiveConvId(firstId);
          const msgData = await apiRequest<{ messages: ChatMessage[] }>(
            `/api/conversations/${firstId}/messages`
          );
          if (!cancelled) {
            setMessages(msgData.messages.length > 0 ? msgData.messages : [WELCOME_MSG]);
          }
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (initialPrompt) {
      void handleSend(initialPrompt);
      onConsumeInitialPrompt();
    }
  }, [initialPrompt]);

  const loadConversation = async (id: string) => {
    setError(null);
    setActiveConvId(id);
    setShowHistoryDrawer(false);
    try {
      const data = await apiRequest<{ messages: ChatMessage[] }>(
        `/api/conversations/${id}/messages`
      );
      setMessages(data.messages.length > 0 ? data.messages : [WELCOME_MSG]);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleNewConversation = async () => {
    setError(null);
    if (!user) {
      setActiveConvId(null);
      setMessages([WELCOME_MSG]);
      return;
    }
    try {
      const res = await apiRequest<{ conversation: ConversationItem }>(
        "/api/conversations",
        {
          method: "POST",
          body: JSON.stringify({ title: "New Conversation" }),
        }
      );
      setConversations((prev) => [res.conversation, ...prev]);
      setActiveConvId(res.conversation.id);
      setMessages([WELCOME_MSG]);
      setShowHistoryDrawer(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteConversation = async (id: string) => {
    try {
      await apiRequest(`/api/conversations/${id}`, { method: "DELETE" });
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);
      if (activeConvId === id) {
        if (remaining.length > 0) {
          await loadConversation(remaining[0].id);
        } else {
          setActiveConvId(null);
          setMessages([WELCOME_MSG]);
        }
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isThinking) return;
    if (!overrideText) setInput("");
    setError(null);

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    try {
      let replyMsg: ChatMessage;
      if (user) {
        const res = await apiRequest<{
          conversationId: string;
          message: ChatMessage;
        }>("/api/chat", {
          method: "POST",
          body: JSON.stringify({
            conversationId: activeConvId,
            message: text,
            providerId: selectedProviderId,
            model: selectedModel,
          }),
        });
        replyMsg = res.message;
        if (!activeConvId) {
          setActiveConvId(res.conversationId);
          const convData = await apiRequest<{ conversations: ConversationItem[] }>(
            "/api/conversations"
          );
          setConversations(convData.conversations);
        }
      } else {
        const res = await apiRequest<{ message: ChatMessage }>("/api/chat/preview", {
          method: "POST",
          body: JSON.stringify({ message: text }),
        });
        replyMsg = res.message;
      }

      let deviceFeedback: string | null = null;
      if (replyMsg.command && replyMsg.command.action !== "NONE") {
        const outcome = await executeWebAction(replyMsg.command);
        deviceFeedback = outcome.summary || null;
        if (replyMsg.command.requiresConfirmation && outcome.openUrl) {
          setPendingConfirm({
            action: replyMsg.command.action,
            target: replyMsg.command.target,
            url: outcome.openUrl,
          });
        } else if (outcome.openUrl) {
          replyMsg = {
            ...replyMsg,
            deviceFeedback: outcome.summary,
          };
          // Store openUrl in command target display or offer clickable button
          (replyMsg as ChatMessage & { actionUrl?: string }).actionUrl = outcome.openUrl;
        }
      }

      const enrichedMsg: ChatMessage & { actionUrl?: string } = {
        ...replyMsg,
        deviceFeedback,
        actionUrl: (replyMsg as ChatMessage & { actionUrl?: string }).actionUrl,
      };

      setMessages((prev) => [...prev, enrichedMsg]);

      if (ttsEnabled) {
        setIsSpeaking(true);
        speakAssistantReply(
          enrichedMsg.content,
          voiceLang,
          user?.ttsRate ?? 1.0
        );
        window.setTimeout(() => setIsSpeaking(false), Math.min(6000, enrichedMsg.content.length * 60));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsThinking(false);
    }
  };

  const toggleMicrophone = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRec) {
      setError(
        "Web Speech Recognition is not supported in this browser. Use Chrome/Edge or the M.K AI Android APK."
      );
      return;
    }

    const recognition = new SpeechRec();
    recognition.lang = voiceLang === "hi" ? "hi-IN" : "en-IN";
    recognition.continuous = continuousVoice;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const transcript = last[0]?.transcript?.trim() || "";
      setInput(transcript);
      if (last.isFinal && transcript) {
        const cleaned = transcript
          .replace(/^(hey\s+)?(m\.?k\.?\s*ai|mk\s*ai)[,\s]*/i, "")
          .trim();
        void handleSend(cleaned || transcript);
        if (!continuousVoice) {
          recognition.stop();
          setIsListening(false);
        }
      }
    };

    recognition.onerror = (ev) => {
      setIsListening(false);
      if (ev.error !== "aborted") {
        setError(`Microphone error: ${ev.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    setError(null);
    setIsListening(true);
    recognition.start();
  };

  const orbState = isListening
    ? "listening"
    : isThinking
      ? "thinking"
      : isSpeaking
        ? "speaking"
        : "idle";

  return (
    <div className="h-[calc(100vh-4rem)] lg:h-screen flex bg-slate-50 dark:bg-[#06040C]">
      {/* Conversation History Panel (Desktop) */}
      <aside className="hidden xl:flex w-72 flex-col border-r border-slate-200 dark:border-violet-500/15 bg-white dark:bg-[#090612]">
        <div className="p-4 border-b border-slate-200 dark:border-violet-500/15 flex items-center justify-between">
          <h2 className="font-display font-semibold text-sm text-slate-900 dark:text-white">
            Conversations
          </h2>
          <button
            type="button"
            onClick={handleNewConversation}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-500 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {!user ? (
            <div className="p-4 text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <p>Sign in to save your isolated conversation history across Web and Android.</p>
              <button
                type="button"
                onClick={() => onNavigate("login")}
                className="text-violet-600 dark:text-sky-400 font-semibold hover:underline"
              >
                Sign In Now
              </button>
            </div>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-xs text-slate-500 dark:text-slate-400">
              No saved chats yet. Start speaking or typing to create one.
            </p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  activeConvId === c.id
                    ? "bg-violet-600/12 text-violet-700 dark:bg-violet-500/20 dark:text-sky-200"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                }`}
              >
                <button
                  type="button"
                  onClick={() => loadConversation(c.id)}
                  className="flex-1 text-left truncate font-medium"
                >
                  {c.title}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteConversation(c.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 transition-opacity"
                  aria-label="Delete conversation"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Controls Bar */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-violet-500/15 bg-white/80 dark:bg-[#0B0715]/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowHistoryDrawer((v) => !v)}
              className="xl:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-violet-500/25 text-slate-700 dark:text-slate-200"
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
            </button>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setVoiceLang("hi")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  voiceLang === "hi"
                    ? "bg-white dark:bg-violet-600 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Hindi
              </button>
              <button
                type="button"
                onClick={() => setVoiceLang("en")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  voiceLang === "en"
                    ? "bg-white dark:bg-violet-600 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                English
              </button>
            </div>

            {user && providers.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedProviderId}
                  onChange={async (e) => {
                    const nextId = e.target.value;
                    setSelectedProviderId(nextId);
                    const match = providers.find((p) => p.id === nextId);
                    if (match) {
                      setSelectedModel(match.selectedModel || match.defaultModel);
                    }
                    if (nextId === "groq") {
                      try {
                        const synced = await apiRequest<FetchModelsResponse>(
                          "/api/providers/groq/models"
                        );
                        if (synced.models?.length) {
                          setProviders((prev) =>
                            prev.map((p) =>
                              p.id === "groq"
                                ? { ...p, models: synced.models, selectedModel: synced.selectedModel }
                                : p
                            )
                          );
                          setSelectedModel(synced.selectedModel || synced.defaultModel);
                        }
                      } catch {
                        // keep existing model list
                      }
                    }
                  }}
                  aria-label="Select AI Provider"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-violet-500/20 text-slate-800 dark:text-slate-200"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id} className="bg-white dark:bg-[#0B0715]">
                      {p.name}
                    </option>
                  ))}
                </select>

                {(() => {
                  const activeProv = providers.find((p) => p.id === selectedProviderId);
                  if (!activeProv || activeProv.models.length === 0) return null;
                  return (
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      aria-label="Select AI Model"
                      className="px-3 py-1.5 rounded-lg text-xs font-mono bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-violet-500/20 text-slate-800 dark:text-slate-200 max-w-[210px]"
                    >
                      {activeProv.models.map((m) => (
                        <option key={m} value={m} className="bg-white dark:bg-[#0B0715]">
                          {m}
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="hidden sm:inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={continuousVoice}
                onChange={(e) => setContinuousVoice(e.target.checked)}
                className="accent-violet-600"
              />
              <span>Continuous Mic</span>
            </label>

            <button
              type="button"
              onClick={() => {
                if (ttsEnabled) window.speechSynthesis?.cancel();
                setTtsEnabled((v) => !v);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-violet-500/25 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
            >
              {ttsEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-sky-500" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{ttsEnabled ? "Voice On" : "Muted"}</span>
            </button>

            <button
              type="button"
              onClick={handleNewConversation}
              className="xl:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          </div>
        </div>

        {/* Mobile History Drawer */}
        {showHistoryDrawer && (
          <div className="xl:hidden border-b border-slate-200 dark:border-violet-500/20 bg-white dark:bg-[#0B0715] p-3 max-h-56 overflow-y-auto space-y-1">
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => loadConversation(c.id)}
                className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 truncate"
              >
                {c.title}
              </button>
            ))}
          </div>
        )}

        {/* Confirmation Modal for Call / SMS */}
        {pendingConfirm && (
          <div className="px-4 sm:px-6 py-3 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200 dark:border-amber-500/30 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>
                Confirm action: <strong>{pendingConfirm.action}</strong>{" "}
                {pendingConfirm.target ? `(${pendingConfirm.target})` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {pendingConfirm.url && (
                <a
                  href={pendingConfirm.url}
                  onClick={() => setPendingConfirm(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-500"
                >
                  Open Device Handler
                </a>
              )}
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-300 dark:border-amber-500/30 text-amber-900 dark:text-amber-200"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Orb Presence & Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-6">
          <div className="flex flex-col items-center justify-center gap-3 pb-2">
            <AiOrb state={orbState} size="md" onClick={toggleMicrophone} />
            {(isListening || isSpeaking) && (
              <VoiceWaveform
                active={isListening || isSpeaking}
                label={
                  isListening
                    ? `Listening (${voiceLang === "hi" ? "Hindi" : "English"})...`
                    : "M.K AI speaking..."
                }
              />
            )}
          </div>

          {error && (
            <div className="max-w-3xl mx-auto p-3.5 rounded-xl border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 text-sm text-rose-800 dark:text-rose-200 flex items-center justify-between gap-3">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-xs font-semibold underline"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              const msgActionUrl = (msg as ChatMessage & { actionUrl?: string }).actionUrl;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      isUser
                        ? "bg-gradient-to-br from-violet-600 to-indigo-700 text-white"
                        : "bg-white dark:bg-[#120C22] border border-slate-200 dark:border-violet-500/20 text-slate-900 dark:text-slate-100"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>

                    {!isUser && msg.deviceFeedback && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-200 dark:border-violet-500/20 flex flex-wrap items-center justify-between gap-2 text-xs text-sky-700 dark:text-sky-300">
                        <span className="inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{msg.deviceFeedback}</span>
                        </span>
                        {msgActionUrl && (
                          <a
                            href={msgActionUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 font-semibold underline"
                          >
                            <span>Launch</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}

                    {!isUser && (msg.providerId || msg.command?.action) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                        {msg.providerId && (
                          <span>
                            {msg.providerId} · {msg.model}
                          </span>
                        )}
                        {msg.latencyMs ? <span>· {msg.latencyMs}ms</span> : null}
                        {msg.failoverUsed && (
                          <span className="text-amber-600 dark:text-amber-400">
                            · Failover{msg.failoverFrom ? ` (${msg.failoverFrom} -> ${msg.providerId})` : ""}
                          </span>
                        )}
                        {msg.command && msg.command.action !== "NONE" && (
                          <span>· Intent: {msg.command.action}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isThinking && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl bg-white dark:bg-[#120C22] border border-slate-200 dark:border-violet-500/20 text-xs font-medium text-slate-500 dark:text-slate-400">
                  M.K AI is processing your request...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Quick Actions Strip */}
        <div className="px-4 sm:px-8 py-2 border-t border-slate-200/70 dark:border-violet-500/10 bg-white/60 dark:bg-[#080510]/80 overflow-x-auto">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            {QUICK_ACTIONS.map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => void handleSend(cmd)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-violet-500/20 text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0 transition-colors"
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>

        {/* Composer Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          className="px-4 sm:px-8 py-3.5 border-t border-slate-200 dark:border-violet-500/15 bg-white dark:bg-[#0B0715]"
        >
          <div className="max-w-3xl mx-auto flex items-center gap-2.5">
            <button
              type="button"
              onClick={toggleMicrophone}
              aria-label={isListening ? "Stop microphone" : "Start voice input"}
              className={`p-3 rounded-xl text-white transition-colors shrink-0 ${
                isListening
                  ? "bg-sky-500 hover:bg-sky-400"
                  : "bg-violet-600 hover:bg-violet-500"
              }`}
            >
              {isListening ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                voiceLang === "hi"
                  ? "Boliye ya likhiye — e.g. 'Hey M.K AI, YouTube kholo'"
                  : "Speak or type a command or question..."
              }
              className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-slate-100 dark:bg-[#130D24] border border-slate-200 dark:border-violet-500/25 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />

            <button
              type="submit"
              disabled={!input.trim() || isThinking}
              aria-label="Send message"
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-sky-500 text-white text-sm font-semibold disabled:opacity-45 hover:opacity-95 transition-opacity shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
