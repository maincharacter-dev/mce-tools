import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Brain,
  MessageSquare,
  Wrench,
  GraduationCap,
  FileText,
  TrendingUp,
  BookOpen,
  Lightbulb,
  Globe,
  Scale,
  BarChart3,
  Loader2,
  ArrowLeft,
  Zap,
  Target,
  Activity,
  Clock,
} from "lucide-react";

const CATEGORY_CONFIG: Record<string, { icon: any; color: string; bgColor: string }> = {
  domain_knowledge: { icon: BookOpen, color: "text-blue-400", bgColor: "bg-blue-500/10" },
  best_practice: { icon: Lightbulb, color: "text-yellow-400", bgColor: "bg-yellow-500/10" },
  pattern: { icon: TrendingUp, color: "text-green-400", bgColor: "bg-green-500/10" },
  benchmark: { icon: BarChart3, color: "text-purple-400", bgColor: "bg-purple-500/10" },
  lesson_learned: { icon: GraduationCap, color: "text-orange-400", bgColor: "bg-orange-500/10" },
  regional_insight: { icon: Globe, color: "text-cyan-400", bgColor: "bg-cyan-500/10" },
  regulatory: { icon: Scale, color: "text-red-400", bgColor: "bg-red-500/10" },
  technical_standard: { icon: Wrench, color: "text-slate-400", bgColor: "bg-slate-500/10" },
};

const CONFIDENCE_CONFIG: Record<string, { color: string; bgColor: string }> = {
  high: { color: "text-green-400", bgColor: "bg-green-500/20 border-green-500/30" },
  medium: { color: "text-yellow-400", bgColor: "bg-yellow-500/20 border-yellow-500/30" },
  low: { color: "text-red-400", bgColor: "bg-red-500/20 border-red-500/30" },
};

export default function AgentStats() {
  const [, navigate] = useLocation();

  const { data: stats, isLoading } = trpc.agent.getKnowledgeStats.useQuery();
  const { data: learningStats } = trpc.agent.getLearningStats.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
      </div>
    );
  }

  const knowledge = stats?.knowledge;
  const activity = stats?.activity;

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-purple-400" />
              <div>
                <h1 className="text-3xl font-bold text-white mb-1">Agent Learning Stats</h1>
                <p className="text-slate-400">
                  How the agent is learning and evolving across projects
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => navigate("/knowledge-base")}
                variant="outline"
                className="border-slate-700 hover:bg-slate-800"
              >
                <Brain className="h-4 w-4 mr-2" />
                Knowledge Base
              </Button>
              <Button
                onClick={() => navigate("/projects")}
                variant="outline"
                className="border-slate-700 hover:bg-slate-800"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Projects
              </Button>
            </div>
          </div>
        </div>

        {/* Top-Level Activity Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <div className="flex flex-col items-center text-center gap-2">
              <Brain className="h-6 w-6 text-purple-400" />
              <p className="text-2xl font-bold text-white">{knowledge?.totalEntries || 0}</p>
              <p className="text-xs text-slate-400">Knowledge Entries</p>
            </div>
          </Card>
          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <div className="flex flex-col items-center text-center gap-2">
              <MessageSquare className="h-6 w-6 text-blue-400" />
              <p className="text-2xl font-bold text-white">{activity?.totalConversations || 0}</p>
              <p className="text-xs text-slate-400">Conversations</p>
            </div>
          </Card>
          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <div className="flex flex-col items-center text-center gap-2">
              <Activity className="h-6 w-6 text-green-400" />
              <p className="text-2xl font-bold text-white">{activity?.totalMessages || 0}</p>
              <p className="text-xs text-slate-400">Messages</p>
            </div>
          </Card>
          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <div className="flex flex-col items-center text-center gap-2">
              <Wrench className="h-6 w-6 text-orange-400" />
              <p className="text-2xl font-bold text-white">{activity?.totalActions || 0}</p>
              <p className="text-xs text-slate-400">Tool Actions</p>
            </div>
          </Card>
          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <div className="flex flex-col items-center text-center gap-2">
              <GraduationCap className="h-6 w-6 text-yellow-400" />
              <p className="text-2xl font-bold text-white">{activity?.totalLearningSamples || 0}</p>
              <p className="text-xs text-slate-400">Learning Samples</p>
            </div>
          </Card>
          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <div className="flex flex-col items-center text-center gap-2">
              <FileText className="h-6 w-6 text-cyan-400" />
              <p className="text-2xl font-bold text-white">{activity?.totalGeneratedContent || 0}</p>
              <p className="text-xs text-slate-400">Generated Content</p>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Knowledge by Category */}
          <Card className="p-6 bg-slate-900/50 border-slate-800">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-400" />
              Knowledge by Category
            </h2>
            <div className="space-y-3">
              {Object.entries(knowledge?.byCategory || {})
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([category, count]) => {
                  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.domain_knowledge;
                  const Icon = config.icon;
                  const total = knowledge?.totalEntries || 1;
                  const percentage = Math.round(((count as number) / total) * 100);

                  return (
                    <div key={category} className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.bgColor}`}>
                        <Icon className={`h-4 w-4 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-slate-300 capitalize">
                            {category.replace(/_/g, " ")}
                          </span>
                          <span className="text-sm font-medium text-white">{count as number}</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${config.bgColor.replace("/10", "/60")}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              {Object.keys(knowledge?.byCategory || {}).length === 0 && (
                <p className="text-slate-500 text-sm text-center py-4">No knowledge entries yet</p>
              )}
            </div>
          </Card>

          {/* Knowledge by Confidence */}
          <Card className="p-6 bg-slate-900/50 border-slate-800">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              Confidence Distribution
            </h2>
            <div className="space-y-6">
              {["high", "medium", "low"].map((level) => {
                const count = (knowledge?.byConfidence?.[level] as number) || 0;
                const total = knowledge?.totalEntries || 1;
                const percentage = Math.round((count / total) * 100);
                const config = CONFIDENCE_CONFIG[level];

                return (
                  <div key={level}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={config.bgColor}>{level.charAt(0).toUpperCase() + level.slice(1)}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-white">{count}</span>
                        <span className="text-sm text-slate-500">({percentage}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          level === "high"
                            ? "bg-green-500/60"
                            : level === "medium"
                            ? "bg-yellow-500/60"
                            : "bg-red-500/60"
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              <div className="pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Average Source Count</span>
                  <span className="text-lg font-bold text-white">
                    {(knowledge?.averageSourceCount || 0).toFixed(1)}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Higher source count = knowledge validated across more projects
                </p>
              </div>
            </div>
          </Card>

          {/* Most Validated Knowledge */}
          <Card className="p-6 bg-slate-900/50 border-slate-800">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              Most Validated Knowledge
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Entries confirmed across the most project sources
            </p>
            <div className="space-y-3">
              {knowledge?.topEntries?.map((entry: any, idx: number) => {
                const config = CATEGORY_CONFIG[entry.category] || CATEGORY_CONFIG.domain_knowledge;
                const Icon = config.icon;

                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                  >
                    <span className="text-lg font-bold text-slate-600 w-6 text-center">
                      {idx + 1}
                    </span>
                    <Icon className={`h-4 w-4 ${config.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{entry.topic}</p>
                      <p className="text-xs text-slate-500 capitalize">
                        {entry.category.replace(/_/g, " ")}
                      </p>
                    </div>
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 shrink-0">
                      {entry.sourceCount} sources
                    </Badge>
                  </div>
                );
              })}
              {(!knowledge?.topEntries || knowledge.topEntries.length === 0) && (
                <p className="text-slate-500 text-sm text-center py-4">No entries yet</p>
              )}
            </div>
          </Card>

          {/* Recently Learned */}
          <Card className="p-6 bg-slate-900/50 border-slate-800">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-400" />
              Recently Learned
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Latest knowledge entries added or updated
            </p>
            <div className="space-y-3">
              {knowledge?.recentEntries?.map((entry: any) => {
                const config = CATEGORY_CONFIG[entry.category] || CATEGORY_CONFIG.domain_knowledge;
                const Icon = config.icon;
                const confConfig = CONFIDENCE_CONFIG[entry.confidence || "medium"];
                const updatedAt = entry.updatedAt
                  ? new Date(entry.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "";

                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
                  >
                    <Icon className={`h-4 w-4 ${config.color} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{entry.topic}</p>
                      <p className="text-xs text-slate-500">{updatedAt}</p>
                    </div>
                    <Badge className={confConfig?.bgColor || ""}>
                      {(entry.confidence || "medium").charAt(0).toUpperCase() +
                        (entry.confidence || "medium").slice(1)}
                    </Badge>
                  </div>
                );
              })}
              {(!knowledge?.recentEntries || knowledge.recentEntries.length === 0) && (
                <p className="text-slate-500 text-sm text-center py-4">No entries yet</p>
              )}
            </div>
          </Card>
        </div>

        {/* Learning Model Stats */}
        {learningStats && (
          <Card className="p-6 bg-slate-900/50 border-slate-800 mt-8">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-yellow-400" />
              Style Learning Model
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-slate-400">Total Edits Learned From</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {learningStats?.totalEdits || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Total Generations</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {learningStats?.totalGenerations || 0}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Avg Edit Distance</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {(learningStats?.averageEditDistance || 0).toFixed(1)}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-400">Improvement Score</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {(learningStats?.improvementScore || 0).toFixed(1)}%
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Intelligence Summary */}
        <Card className="p-6 bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-purple-800/30 mt-8">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-purple-500/10">
              <Sparkles className="h-8 w-8 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">Intelligence Summary</h2>
              <p className="text-slate-300 text-sm leading-relaxed">
                The agent has accumulated{" "}
                <span className="text-purple-400 font-semibold">
                  {knowledge?.totalEntries || 0} knowledge entries
                </span>{" "}
                across{" "}
                <span className="text-blue-400 font-semibold">
                  {Object.keys(knowledge?.byCategory || {}).length} categories
                </span>
                . It has processed{" "}
                <span className="text-green-400 font-semibold">
                  {activity?.totalConversations || 0} conversations
                </span>{" "}
                with{" "}
                <span className="text-orange-400 font-semibold">
                  {activity?.totalActions || 0} tool actions
                </span>
                . The average knowledge validation score is{" "}
                <span className="text-yellow-400 font-semibold">
                  {(knowledge?.averageSourceCount || 0).toFixed(1)} sources per entry
                </span>
                .
                {(knowledge?.totalEntries || 0) < 20 && (
                  <span className="text-slate-400">
                    {" "}
                    The knowledge base is still growing. As more projects are analyzed, the agent
                    will accumulate more validated insights and become increasingly intelligent.
                  </span>
                )}
                {(knowledge?.totalEntries || 0) >= 20 && (knowledge?.totalEntries || 0) < 50 && (
                  <span className="text-slate-400">
                    {" "}
                    The knowledge base has a solid foundation. The agent can now make informed
                    comparisons and validate project data against accumulated benchmarks.
                  </span>
                )}
                {(knowledge?.totalEntries || 0) >= 50 && (
                  <span className="text-slate-400">
                    {" "}
                    The knowledge base is mature. The agent has deep domain expertise and can provide
                    sophisticated analysis based on patterns observed across multiple projects.
                  </span>
                )}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
