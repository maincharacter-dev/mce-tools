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
  BarChart3,
} from "lucide-react";
import { agentTrpc } from "@/lib/agent-trpc";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

export default function AgentChat() {
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string>("none");
  const [isProcessing, setIsProcessing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [messages, setMessages] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch projects list from TA/TDD database
  // @ts-ignore - taTddProjects router exists at runtime but TS hasn't picked up the type yet
  const { data: projectsData } = trpc.taTddProjects.list.useQuery();

  // Fetch conversations list
  const { data: conversationsData, refetch: refetchConversations } =
    agentTrpc.getConversations.useQuery({});

  // Fetch current conversation
  const { data: conversationData, refetch: refetchConversation } =
    agentTrpc.getConversation.useQuery(
      { conversationId: conversationId || "" },
      { enabled: !!conversationId }
    );

  // Chat mutation
  const chatMutation = agentTrpc.chat.useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (result: any) => {
      if (result.conversationId && !conversationId) {
        setConversationId(result.conversationId);
      }
      // Add assistant response
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.response,
          toolsUsed: result.toolsUsed,
          timestamp: new Date(),
        },
      ]);
      setIsProcessing(false);
      refetchConversations();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(`Agent error: ${error.message}`);
      setIsProcessing(false);
    },
  });

  const deleteConversation = agentTrpc.deleteConversation.useMutation({
    onSuccess: () => {
      toast.success("Conversation deleted");
      setConversationId(null);
      setMessages([]);
      refetchConversations();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  // Load conversation messages when switching
  useEffect(() => {
    if (conversationData && conversationId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conv = conversationData as any;
      if (conv.messages) {
        setMessages(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          conv.messages.map((m: any) => ({
            role: m.role,
            content: m.content,
            toolsUsed: m.toolsUsed,
            timestamp: m.createdAt ? new Date(m.createdAt) : new Date(),
          }))
        );
      }
    }
  }, [conversationData, conversationId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

    // Send to agent
    const mutationInput: {
      message: string;
      conversationId?: string;
      projectId?: number;
    } = {
      message: userMessage,
    };
    
    if (conversationId) {
      mutationInput.conversationId = conversationId;
    }
    
    if (projectId !== "none") {
      mutationInput.projectId = parseInt(projectId);
    }
    
    chatMutation.mutate(mutationInput);
  };

  const handleNewConversation = () => {
    setConversationId(null);
    setMessages([]);
  };

  const handleDeleteConversation = (id: string) => {
    if (confirm("Delete this conversation?")) {
      deleteConversation.mutate({ conversationId: id });
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conversations: any[] =
    (conversationsData as any)?.conversations || [];
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projects: any[] = projectsData || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm shrink-0">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a
                href="/"
                className="text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </a>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                  <Bot className="h-7 w-7 text-orange-400" />
                  OE AI Agent
                </h1>
                <p className="text-slate-400 text-sm">
                  Ask questions about your projects and knowledge base
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/agent/knowledge"
                className="text-slate-400 hover:text-orange-400 transition-colors text-sm font-medium"
              >
                Knowledge Base
              </a>
              <a
                href="/agent/stats"
                className="text-slate-400 hover:text-orange-400 transition-colors"
              >
                <BarChart3 className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Conversations */}
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
            {conversations.length === 0 ? (
              <p className="text-slate-500 text-xs text-center py-4">
                No conversations yet
              </p>
            ) : (
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              conversations.map((conv: any) => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                    conversationId === conv.id
                      ? "bg-slate-700/50 text-white"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-300"
                  }`}
                  onClick={() => setConversationId(conv.id)}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="text-sm truncate flex-1">
                    {conv.title || "Untitled"}
                  </span>
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
                <SelectTrigger className="w-[200px] h-8 text-xs bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="none">No project context</SelectItem>
                  {projects.map((project) => (
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
                  Ask questions about your projects, query the knowledge base,
                  or get help with TA/TDD and OE workflows.
                </p>
              </div>
            ) : (
              messages
                .filter((msg) => msg.role === "user" || msg.role === "assistant")
                .map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
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
                    {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {msg.toolsUsed.map((tool: string, j: number) => (
                          <span
                            key={j}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400"
                          >
                            {tool}
                          </span>
                        ))}
                      </div>
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
