import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Brain,
  Loader2,
  MessageSquare,
  Wrench,
} from "lucide-react";
import { agentTrpc } from "@/lib/agent-trpc";

export default function AgentStats() {
  const { data: knowledgeStats, isLoading: loadingKnowledge } =
    agentTrpc.getKnowledgeStats.useQuery({});

  const { data: conversationStats, isLoading: loadingConversations } =
    agentTrpc.getConversationStats.useQuery({});

  const { data: learningStats, isLoading: loadingLearning } =
    agentTrpc.getLearningStats.useQuery();

  const { data: tools, isLoading: loadingTools } =
    agentTrpc.getTools.useQuery();

  const isLoading =
    loadingKnowledge || loadingConversations || loadingLearning || loadingTools;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kStats = (knowledgeStats as any) || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cStats = (conversationStats as any) || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lStats = (learningStats as any) || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolsList: any[] = (tools as any) || [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a
                href="/agent"
                className="text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </a>
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <BarChart3 className="h-8 w-8 text-orange-400" />
                  Agent Statistics
                </h1>
                <p className="text-slate-400 mt-1">
                  Overview of AI agent usage and knowledge
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Top-level Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-blue-500/20">
                      <BookOpen className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {kStats.totalEntries || 0}
                      </p>
                      <p className="text-sm text-slate-400">
                        Knowledge Entries
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-green-500/20">
                      <MessageSquare className="h-6 w-6 text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {cStats.totalConversations || 0}
                      </p>
                      <p className="text-sm text-slate-400">Conversations</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-purple-500/20">
                      <Brain className="h-6 w-6 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {lStats.totalSamples || 0}
                      </p>
                      <p className="text-sm text-slate-400">
                        Learning Samples
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-orange-500/20">
                      <Wrench className="h-6 w-6 text-orange-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {toolsList.length || 0}
                      </p>
                      <p className="text-sm text-slate-400">
                        Available Tools
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Knowledge by Category */}
            {kStats.byCategory && kStats.byCategory.length > 0 && (
              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-white">
                    Knowledge by Category
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {kStats.byCategory.map((cat: any) => (
                      <div
                        key={cat.category}
                        className="flex items-center justify-between"
                      >
                        <span className="text-slate-300 text-sm capitalize">
                          {cat.category?.replace(/_/g, " ")}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-orange-500 rounded-full"
                              style={{
                                width: `${
                                  kStats.totalEntries
                                    ? (cat.count / kStats.totalEntries) * 100
                                    : 0
                                }%`,
                              }}
                            />
                          </div>
                          <span className="text-slate-400 text-sm w-8 text-right">
                            {cat.count}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Available Tools */}
            {toolsList.length > 0 && (
              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardHeader>
                  <CardTitle className="text-white">Available Tools</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {toolsList.map((tool: any) => (
                      <div
                        key={tool.name}
                        className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/30"
                      >
                        <p className="text-white text-sm font-medium">
                          {tool.name}
                        </p>
                        <p className="text-slate-400 text-xs mt-1 line-clamp-2">
                          {tool.description}
                        </p>
                        {tool.category && (
                          <span className="inline-block mt-2 text-[10px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">
                            {tool.category}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <div className="flex gap-4">
              <Button
                variant="outline"
                className="border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700"
                onClick={() => (window.location.href = "/agent")}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Open Chat
              </Button>
              <Button
                variant="outline"
                className="border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700"
                onClick={() => (window.location.href = "/agent/knowledge")}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Knowledge Base
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
