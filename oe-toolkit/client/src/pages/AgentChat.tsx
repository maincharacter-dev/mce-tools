import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Send,
  ArrowLeft,
  Loader2,
  MessageSquare,
  Plus,
  Trash2,
  Wrench,
  Brain,
  Zap,
  Activity,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

const SPROCKET_LOGO =
  "https://files.manuscdn.com/user_upload_by_module/session_file/310519663183448316/hTLbCucVoEFLmCJe.png";

// ─── SSE Event Types ──────────────────────────────────────────────────────────
interface StatusEvent { phase: string; text: string; }
interface ToolCallEvent { name: string; args: Record<string, unknown>; }

type AgentEvent =
  | { type: "status"; data: StatusEvent }
  | { type: "triage"; data: unknown }
  | { type: "tool_call"; data: ToolCallEvent }
  | { type: "tool_result"; data: unknown }
  | { type: "content_chunk"; data: { chunk: string } }
  | { type: "done"; data: { message: string; conversationId: string } }
  | { type: "error"; data: { message: string } };

// ─── Message Types ────────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  events?: AgentEvent[];
}

// ─── Phase Icon ───────────────────────────────────────────────────────────────
function PhaseIcon({ phase }: { phase: string }) {
  const p = phase.toLowerCase();
  if (p.includes("search") || p.includes("retriev") || p.includes("graph")) return <Search className="h-3 w-3" />;
  if (p.includes("plan")) return <Brain className="h-3 w-3" />;
  if (p.includes("tool") || p.includes("execut")) return <Wrench className="h-3 w-3" />;
  return <Activity className="h-3 w-3" />;
}

// ─── Tool Call Accordion ──────────────────────────────────────────────────────
function ToolCallAccordion({ events }: { events: AgentEvent[] }) {
  const [open, setOpen] = useState(false);
  const toolCalls = events.filter((e) => e.type === "tool_call");
  if (toolCalls.length === 0) return null;

  const toolNames = Array.from(new Set(toolCalls.map((e) => (e.data as ToolCallEvent).name)));

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Wrench className="h-3 w-3 text-orange-400" />
        <span>
          Used {toolNames.length} tool{toolNames.length !== 1 ? "s" : ""}: {toolNames.join(", ")}
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-1 pl-4 border-l border-slate-700">
          {toolCalls.map((e, i) => {
            const d = e.data as ToolCallEvent;
            return (
              <div key={i} className="text-xs">
                <span className="text-orange-400 font-mono">→ {d.name}</span>
                {d.args && Object.keys(d.args).length > 0 && (
                  <span className="text-slate-500 ml-1">
                    ({JSON.stringify(d.args).slice(0, 80)}{JSON.stringify(d.args).length > 80 ? "..." : ""})
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AgentChat() {
  useAuth({ redirectOnUnauthenticated: true });
  // ─── State ──────────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("none");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState<StatusEvent | null>(null);
  const [streamingEvents, setStreamingEvents] = useState<AgentEvent[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  // Background task state
  const [backgroundTaskId, setBackgroundTaskId] = useState<string | null>(null);
  const [isPollingBgTask, setIsPollingBgTask] = useState(false);
  const bgPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ─── Background task polling ─────────────────────────────────────────────────
  const bgTasksQuery = trpc.agent.getBackgroundTasks.useQuery(
    { conversationId: conversationId! },
    {
      enabled: isPollingBgTask && !!conversationId,
      refetchInterval: isPollingBgTask ? 5_000 : false,
    }
  );

  // Background task completion is handled in a useEffect below (after conversationsQuery is declared)
  const bgTasksData = bgTasksQuery.data;

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (bgPollIntervalRef.current) clearInterval(bgPollIntervalRef.current);
    };
  }, []);

  // ─── Queries ─────────────────────────────────────────────────────────────────
  const conversationsQuery = trpc.agent.getConversations.useQuery(undefined, {
    refetchInterval: isStreaming ? false : 30_000,
  });

  const messagesQuery = trpc.agent.getMessages.useQuery(
    { conversationId: conversationId! },
    { enabled: !!conversationId }
  );

  // @ts-ignore - workspaceProjects router exists at runtime
  const workspaceProjectsQuery = trpc.workspaceProjects.list.useQuery();
  // oe_toolkit projects use `projectName` (not `name`) — map to a consistent shape
  const workspaceProjects: Array<{ id: number; name: string }> = (workspaceProjectsQuery.data ?? []).map((p: any) => ({
    id: p.id,
    name: p.projectName ?? p.name ?? `Project ${p.id}`,
  }));

  // @ts-ignore - workspaceProjects router exists at runtime
  const projectContextQuery = trpc.workspaceProjects.getProjectContext.useQuery(
    { projectId: parseInt(selectedProjectId) },
    { enabled: selectedProjectId !== "none" && !isNaN(parseInt(selectedProjectId)) }
  );

  const deleteConversationMutation = trpc.agent.deleteConversation.useMutation({
    onSuccess: () => {
      conversationsQuery.refetch();
      toast.success("Conversation deleted");
      if (conversationId) {
        setConversationId(null);
        setMessages([]);
      }
    },
    onError: (err) => toast.error(`Failed to delete: ${err.message}`),
  });

  // ─── Background task completion handler ────────────────────────────────
  useEffect(() => {
    if (!isPollingBgTask || !bgTasksData) return;
    const tasks = bgTasksData as any[];
    const completed = tasks.find(
      (t: any) => (t.status === "completed" || t.status === "failed") &&
        (!backgroundTaskId || t.id === backgroundTaskId)
    );
    if (completed) {
      setIsPollingBgTask(false);
      setBackgroundTaskId(null);
      const content = completed.status === "completed"
        ? (completed.resultContent || "Task completed with no output.")
        : `Background task failed: ${completed.errorMessage || "Unknown error"}`;
      const assistantMsg: ChatMessage = {
        id: `bg-result-${Date.now()}`,
        role: "assistant",
        content,
        createdAt: completed.completedAt || new Date().toISOString(),
      };
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== "bg-working-placeholder");
        return [...filtered, assistantMsg];
      });
      conversationsQuery.refetch();
    }
  }, [bgTasksData, isPollingBgTask, backgroundTaskId, conversationsQuery]);

  // ─── Load messages when conversation changes ──────────────────────────────
  useEffect(() => {
    if (messagesQuery.data) {
      const filtered = (messagesQuery.data as any[]).filter(
        (m: any) => m.role === "user" || m.role === "assistant"
      );
      setMessages(
        filtered.map((m: any) => ({
          id: m.id ?? `${m.role}-${m.createdAt}`,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
        }))
      );
    }
  }, [messagesQuery.data]);

  // ─── Auto-scroll ──────────────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, streamingStatus]);

  // ─── Build system context from TA/TDD project ────────────────────────────
  const buildSystemContext = useCallback((): string | undefined => {
    if (selectedProjectId === "none" || !projectContextQuery.data) return undefined;
    const ctx = projectContextQuery.data as any;
    if (!ctx) return undefined;

    // getProjectContext returns { projectId, context } where context is a pre-built string
    const projectName = workspaceProjects.find(p => String(p.id) === selectedProjectId)?.name ?? `Project ${selectedProjectId}`;
    const lines: string[] = [
      `## Project Context: ${projectName}`,
      "",
      "You are assisting with analysis of this specific project. Use the following project data as context.",
      "",
    ];

    if (ctx.context) {
      lines.push(ctx.context);
    }

    return lines.join("\n");
  }, [selectedProjectId, projectContextQuery.data, workspaceProjects]);

  // ─── Send message via SSE stream ─────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);
    setStreamingStatus(null);
    setStreamingEvents([]);
    setStreamingContent("");

    const systemContext = buildSystemContext();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/agent/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          conversationId: conversationId ?? undefined,
          systemContext,
        }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let currentEventType = "";
      let currentEventData = "";
      const sessionEvents: AgentEvent[] = [];
      let finalContent = "";
      let finalConversationId: string | null = null;
      let detectedBgTaskId: string | null = null;

      const processEvent = (eventType: string, dataStr: string) => {
        try {
          const data = JSON.parse(dataStr);
          const event = { type: eventType, data } as AgentEvent;
          sessionEvents.push(event);

          if (eventType === "status") {
            setStreamingStatus(data as StatusEvent);
            setStreamingEvents((prev) => [...prev, event]);
          } else if (eventType === "tool_call") {
            setStreamingEvents((prev) => [...prev, event]);
            // Detect background task tool calls
            const toolData = data as ToolCallEvent;
            if (toolData.name === "start_background_task") {
              // Background task queued — we'll poll for the result
              setStreamingStatus({ phase: "background", text: "Working in background..." });
            }
          } else if (eventType === "tool_result") {
            setStreamingEvents((prev) => [...prev, event]);
            // Check if this is the result of start_background_task (contains taskId)
            const resultData = data as any;
            if (resultData?.result?.taskId || resultData?.taskId) {
              detectedBgTaskId = resultData?.result?.taskId || resultData?.taskId;
            }
          } else if (eventType === "content_chunk") {
            // Legacy event name (kept for compatibility)
            finalContent += (data as { chunk: string }).chunk;
            setStreamingContent(finalContent);
          } else if (eventType === "token") {
            // Sprocket's actual streaming token event
            finalContent += (data as { content: string }).content;
            setStreamingContent(finalContent);
          } else if (eventType === "conversation") {
            // Sprocket sends conversation ID in a separate event
            finalConversationId = (data as { id: string }).id;
          } else if (eventType === "done") {
            // Sprocket's done event — content already accumulated via token events
            const done = data as { message?: string; conversationId?: string };
            if (done.message) finalContent = done.message;
            if (done.conversationId) finalConversationId = done.conversationId;
            setStreamingContent(finalContent);
          } else if (eventType === "error") {
            throw new Error((data as { message: string }).message);
          }
        } catch (e: any) {
          if (eventType === "error") throw e;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            currentEventData = line.slice(6).trim();
          } else if (line === "" && currentEventType && currentEventData) {
            processEvent(currentEventType, currentEventData);
            currentEventType = "";
            currentEventData = "";
          }
        }
      }

      // Update conversation ID first (needed for background task polling)
      const effectiveConvId = finalConversationId || conversationId;
      if (finalConversationId && !conversationId) {
        setConversationId(finalConversationId);
      }

      // Commit final assistant message
      if (finalContent) {
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: finalContent,
          createdAt: new Date().toISOString(),
          events: sessionEvents,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        conversationsQuery.refetch();
      } else if (detectedBgTaskId || sessionEvents.some((e) => e.type === "tool_call" && (e.data as ToolCallEvent).name === "start_background_task")) {
        // Background task was queued — show placeholder and start polling
        const bgDescription = (() => {
          const bgCall = sessionEvents.find(
            (e) => e.type === "tool_call" && (e.data as ToolCallEvent).name === "start_background_task"
          );
          return bgCall ? String((bgCall.data as ToolCallEvent).args?.description || "complex task").slice(0, 80) : "complex task";
        })();
        const placeholderMsg: ChatMessage = {
          id: "bg-working-placeholder",
          role: "assistant",
          content: `⏳ Working in background on: *${bgDescription}*\n\nThis may take a few minutes. The result will appear here automatically when ready.`,
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, placeholderMsg]);
        if (detectedBgTaskId) setBackgroundTaskId(detectedBgTaskId);
        if (effectiveConvId) {
          setIsPollingBgTask(true);
        }
        conversationsQuery.refetch();
      } else {
        conversationsQuery.refetch();
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.error(`Agent error: ${err.message}`);
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      }
    } finally {
      setIsStreaming(false);
      setStreamingStatus(null);
      setStreamingContent("");
      setStreamingEvents([]);
      abortRef.current = null;
    }
  }, [input, isStreaming, conversationId, buildSystemContext, conversationsQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = () => {
    if (abortRef.current) abortRef.current.abort();
    setConversationId(null);
    setMessages([]);
    setStreamingContent("");
    setStreamingStatus(null);
    setStreamingEvents([]);
    setIsStreaming(false);
  };

  const handleSelectConversation = (id: string) => {
    if (id === conversationId) return;
    if (abortRef.current) abortRef.current.abort();
    setConversationId(id);
    setMessages([]);
    setStreamingContent("");
    setStreamingStatus(null);
    setStreamingEvents([]);
    setIsStreaming(false);
  };

  const conversations = (conversationsQuery.data as any[]) ?? [];

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      if (diff < 60_000) return "just now";
      if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
      if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
      return d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
    } catch {
      return "";
    }
  };

  const getConvLabel = (conv: any) => {
    const date = conv.updatedAt || conv.createdAt;
    if (conv.title && conv.title !== "Untitled" && !conv.title.startsWith("Conversation ")) {
      return conv.title;
    }
    return `Chat ${new Date(date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`;
  };

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white overflow-hidden">
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: back + Sprocket branding */}
          <div className="flex items-center gap-3">
            <Link href="/">
              <button className="text-slate-400 hover:text-white transition-colors p-1 rounded">
                <ArrowLeft className="h-5 w-5" />
              </button>
            </Link>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-700 flex-shrink-0">
                <img
                  src={SPROCKET_LOGO}
                  alt="Sprocket"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="text-sm font-bold text-white leading-tight">Sprocket</div>
                <div className="text-xs text-slate-400 leading-tight">
                  AI Agent · oe-ai-agent-2
                </div>
              </div>
            </div>
            <Badge
              variant="outline"
              className="border-green-500/50 text-green-400 text-xs hidden sm:flex"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5 inline-block animate-pulse" />
              Live
            </Badge>
          </div>

          {/* Right: project context selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:block">Project context:</span>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-48 h-8 text-xs bg-slate-800 border-slate-600 text-slate-200">
                <SelectValue placeholder="No project context" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="none" className="text-slate-300 text-xs">
                  No project context
                </SelectItem>
                {workspaceProjects.map((p) => (
                  <SelectItem
                    key={p.id}
                    value={String(p.id)}
                    className="text-slate-300 text-xs"
                  >
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProjectId !== "none" && projectContextQuery.isLoading && (
              <Loader2 className="h-3 w-3 animate-spin text-orange-400" />
            )}
            {selectedProjectId !== "none" && projectContextQuery.data && (
              <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs">
                Context loaded
              </Badge>
            )}
          </div>
        </div>
      </header>

      {/* ─── Main layout ─────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─── Sidebar ──────────────────────────────────────────────────────── */}
        <aside className="w-64 flex-shrink-0 border-r border-slate-700/50 bg-slate-900/50 flex-col hidden md:flex">
          <div className="p-3 flex-shrink-0">
            <Button
              onClick={handleNewConversation}
              size="sm"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Conversation
            </Button>
          </div>
          <Separator className="bg-slate-700/50" />
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversationsQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                <MessageSquare className="h-6 w-6 mx-auto mb-2 opacity-40" />
                No conversations yet
              </div>
            ) : (
              conversations.map((conv: any) => (
                <div
                  key={conv.id}
                  className={cn(
                    "group flex items-center justify-between rounded-lg px-2.5 py-2 cursor-pointer transition-colors",
                    conv.id === conversationId
                      ? "bg-orange-500/20 border border-orange-500/30"
                      : "hover:bg-slate-800/60"
                  )}
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-200 truncate">
                      {getConvLabel(conv)}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {formatTime(conv.updatedAt || conv.createdAt)}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Delete this conversation?")) {
                        deleteConversationMutation.mutate({ conversationId: conv.id });
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* ─── Chat area ────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 && !isStreaming ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
                <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-700 mb-4">
                  <img
                    src={SPROCKET_LOGO}
                    alt="Sprocket"
                    className="w-full h-full object-cover"
                  />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Sprocket</h2>
                <p className="text-slate-400 text-sm max-w-sm mb-4">
                  AI agent with knowledge graph, episodic memory, and tool execution.
                  {selectedProjectId !== "none" && projectContextQuery.data
                    ? " Project context is loaded and ready."
                    : " Select a project above for context-aware responses."}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Badge
                    variant="outline"
                    className="border-slate-600 text-slate-400 text-xs"
                  >
                    <Brain className="h-3 w-3 mr-1" /> Knowledge Graph
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-slate-600 text-slate-400 text-xs"
                  >
                    <Zap className="h-3 w-3 mr-1" /> Tool Execution
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-slate-600 text-slate-400 text-xs"
                  >
                    <Activity className="h-3 w-3 mr-1" /> Episodic Memory
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-3xl mx-auto">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-7 h-7 rounded-lg overflow-hidden bg-slate-700 flex-shrink-0 mr-2 mt-1">
                        <img
                          src={SPROCKET_LOGO}
                          alt="Sprocket"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                        msg.role === "user"
                          ? "bg-orange-500 text-white rounded-tr-sm"
                          : "bg-slate-800 text-slate-100 rounded-tl-sm"
                      )}
                    >
                      {msg.role === "assistant" && msg.events && (
                        <ToolCallAccordion events={msg.events} />
                      )}
                      {msg.role === "assistant" ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <Streamdown>{msg.content}</Streamdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                      <div
                        className={cn(
                          "text-xs mt-1.5 opacity-50",
                          msg.role === "user" ? "text-right" : "text-left"
                        )}
                      >
                        {formatTime(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}

                {/* ─── Background task polling indicator ───────────────── */}
                {isPollingBgTask && !isStreaming && (
                  <div className="flex justify-start">
                    <div className="w-7 h-7 rounded-lg overflow-hidden bg-slate-700 flex-shrink-0 mr-2 mt-1">
                      <img src={SPROCKET_LOGO} alt="Sprocket" className="w-full h-full object-cover" />
                    </div>
                    <div className="max-w-[80%] bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-100">
                      <div className="flex items-center gap-2 text-xs text-amber-400">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Background task running — checking every 5s for results...</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── Streaming response ─────────────────────────────────── */}
                {isStreaming && (
                  <div className="flex justify-start">
                    <div className="w-7 h-7 rounded-lg overflow-hidden bg-slate-700 flex-shrink-0 mr-2 mt-1">
                      <img
                        src={SPROCKET_LOGO}
                        alt="Sprocket"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="max-w-[80%] bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-100">
                      {/* Live tool calls */}
                      {streamingEvents.filter((e) => e.type === "tool_call").length > 0 && (
                        <div className="mb-2 space-y-1">
                          {streamingEvents
                            .filter((e) => e.type === "tool_call")
                            .map((e, i) => (
                              <div
                                key={i}
                                className="flex items-center gap-1.5 text-xs text-orange-400"
                              >
                                <Wrench className="h-3 w-3" />
                                <span className="font-mono">
                                  {(e.data as ToolCallEvent).name}
                                </span>
                              </div>
                            ))}
                        </div>
                      )}
                      {/* Status */}
                      {streamingStatus && !streamingContent && (
                        <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                          <Loader2 className="h-3 w-3 animate-spin text-orange-400" />
                          <PhaseIcon phase={streamingStatus.phase} />
                          <span>{streamingStatus.text}</span>
                        </div>
                      )}
                      {/* Streaming content */}
                      {streamingContent ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <Streamdown>{streamingContent}</Streamdown>
                        </div>
                      ) : !streamingStatus ? (
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span className="text-xs">Thinking...</span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* ─── Input area ─────────────────────────────────────────────────── */}
          <div className="border-t border-slate-700/50 bg-slate-900/80 p-4 flex-shrink-0">
            <div className="max-w-3xl mx-auto">
              <div className="flex gap-2 items-end">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    selectedProjectId !== "none" && projectContextQuery.data
                      ? "Ask about this project... (Enter to send, Shift+Enter for new line)"
                      : "Ask Sprocket anything... (Enter to send, Shift+Enter for new line)"
                  }
                  className="flex-1 min-h-[44px] max-h-32 resize-none bg-slate-800 border-slate-600 text-slate-100 placeholder:text-slate-500 text-sm focus:border-orange-500/50"
                  disabled={isStreaming || isPollingBgTask}
                  rows={1}
                />
                <Button
                  onClick={isStreaming ? () => abortRef.current?.abort() : handleSend}
                  size="sm"
                  className={cn(
                    "h-11 px-4 flex-shrink-0",
                    isStreaming
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-orange-500 hover:bg-orange-600 text-white"
                  )}
                  disabled={!isStreaming && !input.trim()}
                >
                  {isStreaming ? (
                    <span className="text-xs font-medium">Stop</span>
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-slate-600 mt-1.5 text-center">
                Powered by Sprocket · oe-ai-agent-2 · Knowledge Graph + Episodic Memory
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
