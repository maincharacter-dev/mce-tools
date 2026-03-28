import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
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
  DollarSign,
  Loader2,
  MessageSquare,
  TrendingUp,
  Wrench,
  Zap,
} from "lucide-react";
import { agentTrpc } from "@/lib/agent-trpc";

// ─── Soft budget limits (USD / 30 days) ──────────────────────────────────────
// Adjust these to match your actual budget targets.
const BUDGET_LIMITS: Record<string, number> = {
  sprocket:         20.00,
  "knowledge-engine": 10.00,
  "oe-toolkit":      5.00,
};
const TOTAL_BUDGET = Object.values(BUDGET_LIMITS).reduce((a, b) => a + b, 0);

type Tab = "overview" | "usage";

export default function AgentStats() {
  useAuth({ redirectOnUnauthenticated: true });
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [usageDays, setUsageDays] = useState(30);

  const { data: knowledgeStats, isLoading: loadingKnowledge } =
    agentTrpc.getKnowledgeStats.useQuery({});
  const { data: conversationStats, isLoading: loadingConversations } =
    agentTrpc.getConversationStats.useQuery({});
  const { data: learningStats, isLoading: loadingLearning } =
    agentTrpc.getLearningStats.useQuery();
  const { data: tools, isLoading: loadingTools } =
    agentTrpc.getTools.useQuery();
  const { data: usageData, isLoading: loadingUsage } =
    agentTrpc.getUsage.useQuery({ days: usageDays });

  const isOverviewLoading =
    loadingKnowledge || loadingConversations || loadingLearning || loadingTools;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kStats = (knowledgeStats as any) || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cStats = (conversationStats as any) || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lStats = (learningStats as any) || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toolsList: any[] = (tools as any) || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usage = (usageData as any) || null;

  const fmt = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(2)}M`
      : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}k`
      : String(n);

  const fmtCost = (n: number) =>
    n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`;

  const budgetPct = (service: string, cost: number) => {
    const limit = BUDGET_LIMITS[service] ?? TOTAL_BUDGET;
    return Math.min((cost / limit) * 100, 100);
  };

  const budgetColor = (pct: number) =>
    pct >= 90
      ? "bg-red-500"
      : pct >= 70
      ? "bg-amber-500"
      : "bg-emerald-500";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
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
      </header>

      {/* Tab bar */}
      <div className="border-b border-slate-700/50 bg-slate-900/60">
        <div className="container mx-auto px-4">
          <div className="flex gap-1">
            {(["overview", "usage"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-5 py-3 text-sm font-medium capitalize transition-colors border-b-2 ${
                  activeTab === tab
                    ? "border-orange-400 text-orange-400"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                {tab === "usage" ? "LLM Usage & Spend" : "Overview"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          isOverviewLoading ? (
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
                        <p className="text-sm text-slate-400">Knowledge Entries</p>
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
                        <p className="text-sm text-slate-400">Learning Samples</p>
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
                        <p className="text-sm text-slate-400">Available Tools</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Knowledge by Category */}
              {kStats.byCategory && kStats.byCategory.length > 0 && (
                <Card className="bg-slate-900/50 border-slate-700/50">
                  <CardHeader>
                    <CardTitle className="text-white">Knowledge by Category</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {kStats.byCategory.map((cat: any) => (
                        <div key={cat.category} className="flex items-center justify-between">
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
                          <p className="text-white text-sm font-medium">{tool.name}</p>
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
          )
        )}

        {/* ── USAGE TAB ── */}
        {activeTab === "usage" && (
          <div className="space-y-8">
            {/* Period selector */}
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-sm">Period:</span>
              {[7, 14, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setUsageDays(d)}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    usageDays === d
                      ? "bg-orange-500 text-white"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>

            {loadingUsage ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
              </div>
            ) : !usage ? (
              <Card className="bg-slate-900/50 border-slate-700/50">
                <CardContent className="pt-8 pb-8 text-center">
                  <p className="text-slate-400">
                    No usage data yet — usage is recorded automatically once LLM calls are made.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-slate-900/50 border-slate-700/50">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-emerald-500/20">
                          <DollarSign className="h-6 w-6 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-white">
                            {fmtCost(usage.totalCostUsd ?? 0)}
                          </p>
                          <p className="text-sm text-slate-400">
                            Total spend ({usageDays}d)
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-900/50 border-slate-700/50">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-blue-500/20">
                          <Zap className="h-6 w-6 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-white">
                            {fmt(usage.totalTokens ?? 0)}
                          </p>
                          <p className="text-sm text-slate-400">Total tokens</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-900/50 border-slate-700/50">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-purple-500/20">
                          <TrendingUp className="h-6 w-6 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-white">
                            {usage.callCount ?? 0}
                          </p>
                          <p className="text-sm text-slate-400">LLM calls</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Budget gauges by service */}
                {usage.byService && usage.byService.length > 0 && (
                  <Card className="bg-slate-900/50 border-slate-700/50">
                    <CardHeader>
                      <CardTitle className="text-white">
                        Budget Usage by Service
                        <span className="ml-2 text-sm font-normal text-slate-400">
                          (soft limits — {usageDays}d window)
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {usage.byService.map((s: any) => {
                          const limit = BUDGET_LIMITS[s.service] ?? TOTAL_BUDGET;
                          const pct = budgetPct(s.service, s.costUsd);
                          return (
                            <div key={s.service}>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-slate-300 text-sm font-medium capitalize">
                                  {s.service}
                                </span>
                                <span className="text-slate-400 text-sm">
                                  {fmtCost(s.costUsd)} / {fmtCost(limit)}
                                  {pct >= 90 && (
                                    <span className="ml-2 text-red-400 text-xs font-semibold">
                                      NEAR LIMIT
                                    </span>
                                  )}
                                </span>
                              </div>
                              <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${budgetColor(pct)}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <p className="text-slate-500 text-xs mt-1">
                                {s.callCount} calls · {fmt(s.totalTokens)} tokens
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Cost by model */}
                {usage.byModel && usage.byModel.length > 0 && (
                  <Card className="bg-slate-900/50 border-slate-700/50">
                    <CardHeader>
                      <CardTitle className="text-white">Cost by Model</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {usage.byModel.map((m: any) => {
                          const maxCost = usage.byModel[0]?.costUsd ?? 1;
                          const pct = maxCost > 0 ? (m.costUsd / maxCost) * 100 : 0;
                          return (
                            <div key={m.model} className="flex items-center justify-between gap-4">
                              <span className="text-slate-300 text-sm font-mono truncate w-48">
                                {m.model}
                              </span>
                              <div className="flex-1 flex items-center gap-3">
                                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-orange-500 rounded-full"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-slate-400 text-sm w-16 text-right">
                                  {fmtCost(m.costUsd)}
                                </span>
                              </div>
                              <span className="text-slate-500 text-xs w-20 text-right">
                                {fmt(m.totalTokens)} tok
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Cost by source/feature */}
                {usage.bySource && usage.bySource.length > 0 && (
                  <Card className="bg-slate-900/50 border-slate-700/50">
                    <CardHeader>
                      <CardTitle className="text-white">Cost by Feature</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {usage.bySource.map((s: any) => (
                          <div
                            key={s.source}
                            className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700/30"
                          >
                            <div>
                              <p className="text-slate-300 text-sm font-medium capitalize">
                                {s.source?.replace(/_/g, " ")}
                              </p>
                              <p className="text-slate-500 text-xs mt-0.5">
                                {s.callCount} calls · {fmt(s.totalTokens)} tokens
                              </p>
                            </div>
                            <span className="text-emerald-400 text-sm font-semibold">
                              {fmtCost(s.costUsd)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Daily trend (simple bar chart) */}
                {usage.daily && usage.daily.length > 1 && (
                  <Card className="bg-slate-900/50 border-slate-700/50">
                    <CardHeader>
                      <CardTitle className="text-white">Daily Spend Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-end gap-1 h-32">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {usage.daily.map((d: any) => {
                          const maxCost = Math.max(
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            ...usage.daily.map((x: any) => x.costUsd),
                            0.001
                          );
                          const pct = (d.costUsd / maxCost) * 100;
                          return (
                            <div
                              key={d.date}
                              className="flex-1 flex flex-col items-center gap-1 group"
                            >
                              <div className="relative w-full flex items-end justify-center h-24">
                                <div
                                  className="w-full bg-orange-500/70 hover:bg-orange-400 rounded-t transition-all cursor-default"
                                  style={{ height: `${Math.max(pct, 2)}%` }}
                                  title={`${d.date}: ${fmtCost(d.costUsd)}`}
                                />
                              </div>
                              <span className="text-[9px] text-slate-500 rotate-45 origin-left whitespace-nowrap">
                                {d.date.slice(5)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
