/**
 * Agent Stats Dashboard
 * 
 * View AI agent learning statistics and performance metrics
 * Shows conversation history, tool usage, and learning samples
 */

import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Brain, MessageSquare, Wrench, TrendingUp } from "lucide-react";

export default function AgentStats() {
  // Fetch agent statistics
  // TODO: Wire up actual stats endpoint once types are regenerated
  const stats = {
    totalConversations: 0,
    totalMessages: 0,
    totalActions: 0,
    learningSamples: 0,
    recentConversations: [],
    topTools: [],
  };
  const isLoading = false;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800/50 backdrop-blur-xl bg-slate-900/50 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <Brain className="h-8 w-8 text-orange-500" />
            <div>
              <h1 className="text-2xl font-bold text-white">Agent Stats</h1>
              <p className="text-sm text-slate-400">
                Learning and performance metrics
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700 p-6">
            <div className="flex items-center justify-between mb-2">
              <MessageSquare className="h-8 w-8 text-blue-500" />
              <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30">
                Total
              </Badge>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {stats?.totalConversations || 0}
            </div>
            <div className="text-sm text-slate-400">Conversations</div>
          </Card>

          <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700 p-6">
            <div className="flex items-center justify-between mb-2">
              <MessageSquare className="h-8 w-8 text-green-500" />
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                Total
              </Badge>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {stats?.totalMessages || 0}
            </div>
            <div className="text-sm text-slate-400">Messages</div>
          </Card>

          <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700 p-6">
            <div className="flex items-center justify-between mb-2">
              <Wrench className="h-8 w-8 text-purple-500" />
              <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30">
                Actions
              </Badge>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {stats?.totalActions || 0}
            </div>
            <div className="text-sm text-slate-400">Tool Executions</div>
          </Card>

          <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700 p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-8 w-8 text-orange-500" />
              <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30">
                Learning
              </Badge>
            </div>
            <div className="text-3xl font-bold text-white mb-1">
              {stats?.learningSamples || 0}
            </div>
            <div className="text-sm text-slate-400">Learning Samples</div>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Conversations */}
          <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700 p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              Recent Conversations
            </h3>
            {stats?.recentConversations && stats.recentConversations.length > 0 ? (
              <div className="space-y-3">
                {stats.recentConversations.map((conv: any) => (
                  <div
                    key={conv.id}
                    className="bg-slate-900/50 border border-slate-700 rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-semibold text-white">
                        {conv.title || "Untitled Conversation"}
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        {conv.messageCount} messages
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400">
                      {new Date(conv.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No conversations yet</p>
            )}
          </Card>

          {/* Top Tools */}
          <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700 p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Wrench className="h-5 w-5 text-purple-500" />
              Most Used Tools
            </h3>
            {stats?.topTools && stats.topTools.length > 0 ? (
              <div className="space-y-3">
                {stats.topTools.map((tool: any, index: number) => (
                  <div
                    key={index}
                    className="bg-slate-900/50 border border-slate-700 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-white">
                        {tool.toolName}
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        {tool.count} uses
                      </Badge>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full"
                        style={{
                          width: `${((tool as any).count / ((stats.topTools[0] as any)?.count || 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No tool usage yet</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
