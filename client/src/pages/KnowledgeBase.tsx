/**
 * Knowledge Base Management Page
 * 
 * Browse, search, and manage the AI agent's knowledge base
 * Allows viewing and editing foundational knowledge used by the agent
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Plus, Database, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function KnowledgeBase() {
  const [searchQuery, setSearchQuery] = useState("");
  // Using sonner toast

  // Fetch knowledge base entries
  // @ts-ignore - Agent router types not yet inferred
  const { data: response, isLoading, refetch } = trpc.agent.listKnowledge.useQuery({});
  const entries = response?.entries || [];

  // Seed knowledge base mutation
  // @ts-ignore - Agent router types not yet inferred
  const seedMutation = trpc.agent.seedKnowledge.useMutation({
    onSuccess: (result: any) => {
      toast.success(`Knowledge Base Seeded: Added ${result.added} entries, skipped ${result.skipped} duplicates. Total: ${result.total} entries.`);
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Seed Failed: ${error.message}`);
    },
  });

  // Filter entries based on search
  const filteredEntries = entries?.filter((entry: any) =>
    entry.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-orange-500" />
              <div>
                <h1 className="text-2xl font-bold text-white">Knowledge Base</h1>
                <p className="text-sm text-slate-400">
                  {entries?.length || 0} entries
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="border-slate-700 hover:border-orange-500/50"
                onClick={() => refetch()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
              >
                {seedMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Seed Knowledge Base
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input
              placeholder="Search knowledge base..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Knowledge Entries Grid */}
        {filteredEntries && filteredEntries.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEntries.map((entry: any) => (
              <Card
                key={entry.id}
                className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700 p-6 hover:border-orange-500/50 transition-all"
              >
                <div className="mb-3">
                  {entry.category && (
                    <Badge
                      variant="outline"
                      className="bg-orange-500/10 text-orange-500 border-orange-500/30 mb-2"
                    >
                      {entry.category}
                    </Badge>
                  )}
                  <h3 className="text-lg font-bold text-white mb-2">
                    {entry.topic}
                  </h3>
                </div>
                <p className="text-sm text-slate-300 line-clamp-4 mb-4">
                  {entry.content}
                </p>
                {entry.source && (
                  <p className="text-xs text-slate-500">
                    Source: {entry.source}
                  </p>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Database className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">
              {searchQuery ? "No Results Found" : "Knowledge Base Empty"}
            </h3>
            <p className="text-slate-400 mb-6">
              {searchQuery
                ? "Try a different search term"
                : "Click 'Seed Knowledge Base' to add foundational knowledge"}
            </p>
            {!searchQuery && (
              <Button
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
              >
                {seedMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Seed Knowledge Base
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
