import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDashboardData } from "../../hooks/useDashboardData";
import {
  Send,
  Wrench,
  Bot,
  User as UserIcon,
  Plus,
  MessageSquare,
  FolderKanban,
  Activity,
  Clock,
  DollarSign,
  Sparkles,
  Database,
  Menu,
  X,
  Zap,
  Globe,
  Mail,
  Calendar,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  toolUsed?: string | null;
  error?: boolean;
}

interface ChatResponse {
  reply: string;
  toolUsed?: string | null;
  sessionId: string;
}

interface ToolBadgeProps {
  toolName: string;
}

type Conversation = { id: string; title: string; updatedAt: number };

const WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL as string | undefined;

async function readWebhookResponse(response: Response): Promise<ChatResponse> {
  const rawText = await response.text();

  if (!rawText.trim()) {
    throw new Error(`Empty response from webhook (${response.status}).`);
  }

  try {
    const parsed = JSON.parse(rawText) as Partial<ChatResponse>;
    if (typeof parsed.reply !== "string") {
      throw new Error("Webhook response is missing a reply field.");
    }

    return {
      reply: parsed.reply,
      toolUsed: parsed.toolUsed ?? null,
      sessionId: parsed.sessionId ?? "",
    };
  } catch (parseError) {
    throw new Error(`Invalid JSON from webhook (${response.status}).`);
  }
}

function ToolBadge({ toolName }: ToolBadgeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange/25 to-orange/10 px-3 py-1 text-xs font-semibold text-orange orange-glow"
    >
      <Wrench className="h-3 w-3" />
      <span className="opacity-90">Tool Used:</span>
      <span className="font-bold tracking-wide">{toolName}</span>
    </motion.div>
  );
}

function TypingIndicator({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <div className="flex gap-1.5 items-center">
        <span
          className="typing-dot h-1.5 w-1.5 rounded-full bg-neon"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="typing-dot h-1.5 w-1.5 rounded-full bg-neon"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="typing-dot h-1.5 w-1.5 rounded-full bg-neon"
          style={{ animationDelay: "300ms" }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{label}…</span>
    </div>
  );
}

function StatusPill({
  color,
  label,
  icon: Icon,
}: {
  color: "green" | "blue" | "orange";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const dot =
    color === "green"
      ? "bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.6)]"
      : color === "blue"
        ? "bg-neon shadow-[0_0_10px_2px_color-mix(in_oklab,var(--neon)_70%,transparent)]"
        : "bg-orange shadow-[0_0_10px_2px_color-mix(in_oklab,var(--orange)_70%,transparent)]";
  return (
    <div className="flex items-center gap-2 rounded-full glass px-3 py-1.5 text-xs">
      <span className={`h-1.5 w-1.5 rounded-full pulse-dot ${dot}`} />
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-foreground/90">{label}</span>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: "neon" | "orange" | "emerald";
}) {
  const ring =
    accent === "neon"
      ? "text-neon bg-neon/10"
      : accent === "orange"
        ? "text-orange bg-orange/10"
        : "text-emerald-400 bg-emerald-400/10";
  return (
    <div className="glass rounded-xl p-3 flex items-center gap-3">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${ring}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold truncate">{value}</div>
      </div>
    </div>
  );
}

export function Chat() {
  const [sessionId] = useState(() => {
    if (typeof window === "undefined") return "";

    const storedSessionId = window.sessionStorage.getItem("workpilot_session_id");
    if (storedSessionId) return storedSessionId;

    const nextSessionId = crypto.randomUUID();
    window.sessionStorage.setItem("workpilot_session_id", nextSessionId);
    return nextSessionId;
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Thinking");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const {
    projects: sidebarProjects,
    rawProjects,
    metrics,
    loading: dashboardLoading,
    error: dashboardError,
    refresh,
  } = useDashboardData();

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const requestInFlightRef = useRef(false);
  const lastSubmitRef = useRef({ text: "", at: 0 });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const startNewSession = () => {
    if (messages.length > 0) {
      const title =
        messages.find((m) => m.role === "user")?.text.slice(0, 40) ?? "Untitled session";
      setConversations((c) =>
        [{ id: sessionId || crypto.randomUUID(), title, updatedAt: Date.now() }, ...c].slice(0, 8),
      );
    }
    setMessages([]);
    setInput("");
    setSidebarOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const sendMessage = async () => {
    const text = input.trim();
    const now = Date.now();

    if (!text || loading || requestInFlightRef.current || !sessionId) return;

    if (lastSubmitRef.current.text === text && now - lastSubmitRef.current.at < 400) {
      return;
    }

    requestInFlightRef.current = true;
    lastSubmitRef.current = { text, at: now };

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    setLoadingLabel("Thinking");
    let toolStateTimer: ReturnType<typeof setTimeout> | undefined;

    try {
      if (!WEBHOOK_URL) throw new Error("VITE_N8N_WEBHOOK_URL is not configured.");

      // After a brief moment, hint that we may be calling a tool.
      toolStateTimer = setTimeout(() => setLoadingLabel("Calling tool"), 1200);

      const payload = { message: text, sessionId };

      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (toolStateTimer) clearTimeout(toolStateTimer);

      const data = await readWebhookResponse(res);

      if (!res.ok) {
        throw new Error(`Request failed (${res.status}). ${data.reply}`.trim());
      }

      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: data.reply,
          toolUsed: data.toolUsed ?? null,
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((m) => [
        ...m,
        { id: crypto.randomUUID(), role: "assistant", text: `⚠️ ${message}`, error: true },
      ]);
    } finally {
      if (toolStateTimer) clearTimeout(toolStateTimer);
      setLoading(false);
      requestInFlightRef.current = false;
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const suggestions = useMemo(
    () => [
      "Summarize this week's tracked hours",
      "Draft an invoice for Acme Co.",
      "Find unbilled tasks across projects",
      "Schedule a follow-up with my client",
    ],
    [],
  );
  return (
    <div className="dark relative flex h-dvh w-full overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      <aside
        className={[
          "fixed md:static z-40 inset-y-0 left-0 w-[280px] shrink-0",
          "glass-strong border-r border-glass-border",
          "transform transition-transform duration-300 ease-out",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          "flex flex-col",
        ].join(" ")}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="relative h-8 w-8 rounded-lg bg-gradient-to-br from-neon to-orange flex items-center justify-center neon-ring">
              <Sparkles className="h-4 w-4 text-background" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">WorkPilot AI</span>
              <span className="text-[10px] text-muted-foreground">Freelancer OS</span>
            </div>
          </div>
          <button
            className="md:hidden h-8 w-8 rounded-md hover:bg-accent flex items-center justify-center"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-3 py-3">
          <button
            onClick={startNewSession}
            className="w-full group relative overflow-hidden rounded-xl bg-gradient-to-r from-neon/90 to-neon px-3 py-2.5 text-sm font-medium text-neon-foreground neon-ring transition hover:opacity-95"
          >
            <span className="flex items-center justify-center gap-2">
              <Plus className="h-4 w-4" />
              New Session
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
          {/* Recent conversations */}
          <div>
            <div className="px-2 mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Recent Conversations
            </div>
            <ul className="space-y-1">
              {conversations.length === 0 && (
                <li className="px-2 py-2 text-xs text-muted-foreground/70 italic">
                  No conversations yet
                </li>
              )}
              {conversations.map((c) => (
                <li key={c.id}>
                  <button className="w-full text-left px-2 py-2 rounded-md hover:bg-accent/60 transition flex items-center gap-2 text-sm">
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{c.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Active projects */}
          <div>
            <div className="px-2 mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Active Projects
            </div>
            <ul className="space-y-1">
              {dashboardLoading && (
                <li className="px-2 py-2">
                  <div className="h-3 bg-muted-foreground/10 rounded w-3/4 animate-pulse" />
                </li>
              )}
              {!dashboardLoading && sidebarProjects.length === 0 && (
                <li className="px-2 py-2 text-xs text-muted-foreground/70 italic">
                  No projects yet
                </li>
              )}
              {sidebarProjects.map((p) => (
                <li key={p.id}>
                  <button className="w-full text-left px-2 py-2 rounded-md hover:bg-accent/60 transition flex items-center gap-2 text-sm">
                    <FolderKanban className="h-3.5 w-3.5 text-neon shrink-0" />
                    <span className="truncate flex-1">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground">{p.trackedHours}h</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Tools status */}
          <div>
            <div className="px-2 mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              AI Tools Status
            </div>
            <ul className="space-y-1">
              {[
                { name: "Gmail", icon: Mail, online: true },
                { name: "Calendar", icon: Calendar, online: true },
                { name: "Web Search", icon: Globe, online: true },
                { name: "Database", icon: Database, online: !!rawProjects?.length },
              ].map((t) => (
                <li key={t.name} className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm">
                  <t.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1">{t.name}</span>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      t.online
                        ? "bg-emerald-400 shadow-[0_0_8px_1px_rgba(52,211,153,0.7)] pulse-dot"
                        : "bg-muted-foreground/40"
                    }`}
                  />
                </li>
              ))}
            </ul>
          </div>

          {/* Usage */}
          <div>
            <div className="px-2 mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Usage This Month
            </div>
            <div className="glass rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Messages</span>
                <span className="font-medium">{messages.length} / 2,000</span>
              </div>
              <div className="h-1.5 rounded-full bg-accent overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-neon to-orange"
                  style={{ width: `${Math.min(100, Math.round((messages.length / 2000) * 100))}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-muted-foreground">Tool calls</span>
                <span className="font-medium">{messages.filter((m) => m.toolUsed).length}</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top status bar */}
        <header className="sticky top-0 z-20 glass-strong border-b border-glass-border">
          <div className="flex items-center gap-3 px-4 py-2.5">
            <button
              className="md:hidden h-9 w-9 rounded-md hover:bg-accent flex items-center justify-center"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 min-w-0">
              <div className="text-sm font-medium truncate">Workspace</div>
              <span className="text-muted-foreground/60">/</span>
              <div className="text-sm text-muted-foreground truncate">
                {sessionId ? `Session ${sessionId.slice(0, 6)}` : "New session"}
              </div>
            </div>

            <div className="ml-auto hidden sm:flex items-center gap-2">
              <StatusPill color="green" label="AI Online" icon={Zap} />
              <StatusPill color="blue" label="Connected to Supabase" icon={Database} />
            </div>
          </div>

          {dashboardError && (
            <div className="px-4 pb-3">
              <div className="glass rounded-xl px-3 py-2 text-xs text-orange flex items-center justify-between gap-3">
                <span className="truncate">Supabase sync paused: {dashboardError.message}</span>
                <button
                  type="button"
                  onClick={refresh}
                  className="shrink-0 rounded-full bg-orange/15 px-3 py-1 font-medium text-orange hover:bg-orange/20 transition"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Stat strip */}
          <div className="grid grid-cols-3 gap-2 px-4 pb-3">
            <StatCard
              icon={Clock}
              label="Hours tracked"
              value={dashboardLoading || !metrics ? "—" : `${metrics.totalHours.toFixed(2)}h`}
              accent="neon"
            />
            <StatCard
              icon={DollarSign}
              label="Est. earnings"
              value={
                dashboardLoading || !metrics
                  ? "—"
                  : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                      metrics.estimatedEarnings,
                    )
              }
              accent="orange"
            />
            <StatCard
              icon={Activity}
              label="Active projects"
              value={dashboardLoading || !metrics ? "—" : String(metrics.activeProjects)}
              accent="emerald"
            />
          </div>
        </header>

        {/* Chat surface */}
        <main className="flex-1 overflow-y-auto scroll-smooth">
          <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center text-center py-16"
              >
                <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-neon to-orange flex items-center justify-center neon-ring mb-4">
                  <Sparkles className="h-6 w-6 text-background" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  <span className="text-gradient-neon">WorkPilot</span> is ready.
                </h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Your AI operations co-pilot for freelance work — invoices, projects, tracked
                  hours, and clients in one chat.
                </p>
                <div className="grid sm:grid-cols-2 gap-2 mt-6 w-full max-w-xl">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="glass text-left rounded-xl px-3 py-2.5 text-sm hover:border-neon/40 hover:bg-accent/40 transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {m.role === "assistant" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neon to-orange neon-ring">
                      <Bot className="h-4 w-4 text-background" />
                    </div>
                  )}
                  <div
                    className={`flex max-w-[82%] flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                  >
                    {m.role === "assistant" && m.toolUsed && <ToolBadge toolName={m.toolUsed} />}
                    <div
                      className={[
                        "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm",
                        m.role === "user"
                          ? "bg-gradient-to-br from-user-bubble to-neon/80 text-user-bubble-foreground rounded-br-md neon-ring"
                          : m.error
                            ? "bg-destructive/15 text-destructive rounded-bl-md border border-destructive/30"
                            : "glass text-assistant-bubble-foreground rounded-bl-md",
                      ].join(" ")}
                    >
                      {m.text}
                    </div>
                  </div>
                  {m.role === "user" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent border border-glass-border">
                      <UserIcon className="h-4 w-4" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 justify-start"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neon to-orange neon-ring">
                  <Bot className="h-4 w-4 text-background" />
                </div>
                <div className="rounded-2xl rounded-bl-md glass">
                  <TypingIndicator label={loadingLabel} />
                </div>
              </motion.div>
            )}

            <div ref={bottomRef} />
          </div>
        </main>

        {/* Sticky input */}
        <div className="sticky bottom-0 glass-strong border-t border-glass-border">
          <form onSubmit={onSubmit} className="mx-auto flex max-w-3xl items-end gap-2 px-4 py-3">
            <div className="flex-1 rounded-2xl border border-border bg-input/60 focus-within:border-neon/60 focus-within:ring-2 focus-within:ring-neon/25 transition">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Ask WorkPilot to track time, draft invoices, search projects…"
                className="block w-full resize-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground max-h-40"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || requestInFlightRef.current || !input.trim() || !sessionId}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-neon to-neon/80 text-neon-foreground neon-ring transition hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <p className="pb-2 text-center text-[10px] text-muted-foreground">
            Press <kbd className="px-1 py-0.5 rounded bg-accent text-foreground/80">Enter</kbd> to
            send ·{" "}
            <kbd className="px-1 py-0.5 rounded bg-accent text-foreground/80">Shift+Enter</kbd> for
            newline
          </p>
        </div>
      </div>
    </div>
  );
}
