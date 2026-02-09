import { useState, useRef, useEffect } from "react";
import { trpc } from "../lib/trpc";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { ScrollArea } from "./ui/scroll-area";
import { Loader2, Send, Bot, User, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  toolsUsed?: string[];
  timestamp: Date;
}

interface AgentChatProps {
  projectId: number;
  conversationId?: string;
  onConversationCreated?: (conversationId: string) => void;
}

export function AgentChat({ projectId, conversationId, onConversationCreated }: AgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [currentConversationId, setCurrentConversationId] = useState(conversationId);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.agent.chat.useMutation({
    onSuccess: (data) => {
      // Add assistant response
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.message,
          toolsUsed: data.metadata.toolsUsed,
          timestamp: new Date(),
        },
      ]);

      // Update conversation ID if this was the first message
      if (!currentConversationId && data.conversationId) {
        setCurrentConversationId(data.conversationId);
        onConversationCreated?.(data.conversationId);
      }
    },
  });

  const handleSend = async () => {
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage = input.trim();
    setInput("");

    // Add user message to UI
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
        timestamp: new Date(),
      },
    ]);

    // Send to agent
    chatMutation.mutate({
      projectId,
      conversationId: currentConversationId,
      message: userMessage,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  return (
    <Card className="flex flex-col h-[600px] w-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b">
        <Bot className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">AI Assistant</h3>
        {currentConversationId && (
          <span className="ml-auto text-xs text-muted-foreground">
            Conversation: {currentConversationId.slice(0, 8)}
          </span>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <Sparkles className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-sm">
                Ask me anything about your project!
              </p>
              <p className="text-xs mt-2">
                I can query data, generate reports, and guide you through workflows.
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                
                {message.toolsUsed && message.toolsUsed.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <p className="text-xs opacity-70">
                      Tools used: {message.toolsUsed.join(", ")}
                    </p>
                  </div>
                )}

                <p className="text-xs opacity-50 mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>

              {message.role === "user" && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <User className="w-4 h-4 text-primary-foreground" />
                  </div>
                </div>
              )}
            </div>
          ))}

          {chatMutation.isPending && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              </div>
              <div className="max-w-[80%] rounded-lg p-3 bg-muted">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <p className="text-sm">Thinking...</p>
                </div>
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about your project..."
            disabled={chatMutation.isPending}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
            size="icon"
          >
            {chatMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInput("What are the high-risk facts in this project?")}
            disabled={chatMutation.isPending}
          >
            Show risks
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInput("Give me a project summary")}
            disabled={chatMutation.isPending}
          >
            Project summary
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInput("What should I do next?")}
            disabled={chatMutation.isPending}
          >
            Next steps
          </Button>
        </div>
      </div>
    </Card>
  );
}
