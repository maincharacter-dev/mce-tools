import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  Send,
  ArrowLeft,
  Loader2,
  MessageSquare,
  Plus,
  Trash2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export default function AgentChat() {
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>("none");
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch Sprocket projects
  const { data: sprocketProjects } = trpc.agent.getProjects.useQuery();

  // Fetch TA/TDD projects for the project selector
  // @ts-ignore - taTddProjects router exists at runtime
  const { data: taTddProjects } = trpc.taTddProjects.list.useQuery();

  // Fetch TA/TDD project context when a project is selected
  // @ts-ignore - taTddProjects router exists at runtime
  const { data: taTddContext } = trpc.taTddProjects.getProjectContext.useQuery(
    { projectId: parseInt(projectId) },
    { enabled: projectId !== "none" && !isNaN(parseInt(projectId)) }
  );

  // Fetch conversations from Sprocket
  const { data: conversations, refetch: refetchConversations } =
    trpc.agent.getConversations.useQuery();

  // Fetch messages when a conversation is selected
  const { data: conversationMessages } = trpc.agent.getMessages.useQuery(
    { conversationId: conversationId! },
    { enabled: !!conversationId }
  );

  // Load messages when switching conversations
  useEffect(() => {
    if (conversationMessages && conversationId) {
      const filtered = (conversationMessages as { role: string; content: string; createdAt: string }[])
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: new Date(m.createdAt),
        }));
      setMessages(filtered);
    }
  }, [conversationMessages, conversationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Chat mutation — proxied to Sprocket
  const chatMutation = trpc.agent.chat.useMutation({
    onSuccess: (result) => {
      const res = result as { message: string; conversationId: string };
      if (res.conversationId && !conversationId) {
        setConversationId(res.conversationId);
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.message,
          timestamp: new Date(),
        },
      ]);
      setIsProcessing(false);
      refetchConversations();
    },
    onError: (error) => {
      toast.error(`Agent error: ${error.message}`);
      setIsProcessing(false);
    },
  });

  const deleteConversationMutation = trpc.agent.deleteConversation.useMutation({
    onSuccess: () => {
      toast.success("Conversation deleted");
      setConversationId(null);
      setMessages([]);
      refetchConversations();
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const handleSend = () => {
    if (!message.trim() || isProcessing) return;

    const userMessage = message.trim();
    setMessage("");
    setIsProcessing(true);

    // Add user message to UI immediately
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userMessage, timestamp: new Date() },
    ]);

    // Build the mutation input — only include conversationId if we have one
    const input: {
      message: string;
      conversationId?: string;
      systemContext?: string;
    } = { message: userMessage };

    if (conversationId) input.conversationId = conversationId;

    // If a TA/TDD project is selected, inject its rich context into the message
    if (projectId !== "none" && taTddContext) {
      const ctx = taTddContext as { projectName: string; context: string };
      input.systemContext = `You are an expert OE/TA/TDD consultant. The user is asking about the following project:\n\n${ctx.context}\n\nPlease use this project context to inform your response.`;
    }

    chatMutation.mutate(input);
  };

  const handleNewConversation = () => {
    setConversationId(null);
    setMessages([]);
  };

  const handleSelectConversation = (id: string) => {
    if (id === conversationId) return;
    setConversationId(id);
    setMessages([]);
  };

  const handleDeleteConversation = (id: string) => {
    if (confirm("Delete this conversation?")) {
      deleteConversationMutation.mutate({ conversationId: id });
    }
  };

  const convList = (conversations as { id: string; title: string | null; createdAt: string; updatedAt: string }[] | undefined) ?? [];
  const projectList = (taTddProjects as { id: number; name: string }[] | undefined) ?? [];

  return (
    <div className="h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm shrink-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a href="/" className="text-slate-400 hover:text-white transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </a>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Bot className="h-7 w-7 text-orange-400" />
                  OE AI Agent
                </h1>
                <p className="text-slate-400 text-sm">
                  Powered by Sprocket — ask questions about your projects and knowledge base
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar — Conversations */}
        <div className="w-64 border-r border-slate-700/50 bg-slate-900/50 flex flex-col shrink-0 hidden md:flex">
          <div className="p-3 border-b border-slate-700/50">
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600"
              size="sm"
              onClick={handleNewConversation}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {convList.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-4">
                No conversations yet
              </p>
            ) : (
              convList.map((conv) => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                    conversationId === conv.id
                      ? "bg-slate-700/50 text-white"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-300"
                  }`}
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">
                      {conv.title && conv.title !== "Untitled" && !conv.title.startsWith("Conversation ")
                        ? conv.title
                        : "Chat " + new Date(conv.createdAt).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-slate-500">
                      {new Date(conv.updatedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conv.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Project Selector */}
          <div className="p-3 border-b border-slate-700/30 bg-slate-900/30">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Project context:</span>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="w-[220px] h-8 text-xs bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="none">No project context</SelectItem>
                  {projectList.map((project) => (
                    <SelectItem key={project.id} value={project.id.toString()}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Bot className="h-16 w-16 text-slate-600 mb-4" />
                <h3 className="text-xl font-semibold text-slate-300 mb-2">
                  OE AI Agent
                </h3>
                <p className="text-slate-500 max-w-md">
                  Ask questions about your projects, query the knowledge base, or get help
                  with TA/TDD and OE workflows.
                </p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-orange-500/20 text-white border border-orange-500/30"
                        : "bg-slate-800/50 text-slate-200 border border-slate-700/50"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-invert prose-sm max-w-none">
                        <Streamdown>{msg.content}</Streamdown>
                      </div>
                    ) : (
                      <p className="text-sm">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))
            )}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-700/50 bg-slate-900/50">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-3"
            >
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask the OE AI Agent..."
                className="bg-slate-800 border-slate-600 text-white"
                disabled={isProcessing}
              />
              <Button
                type="submit"
                className="bg-orange-500 hover:bg-orange-600 shrink-0"
                disabled={!message.trim() || isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
