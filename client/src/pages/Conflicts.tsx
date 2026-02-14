import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, ArrowLeft, CheckCircle, XCircle, GitMerge, EyeOff, FileText } from "lucide-react";
import { toast } from "sonner";

interface Conflict {
  id: string;
  insight_a_id: string;
  insight_b_id: string;
  insight_a_value: string;
  insight_a_confidence: string;
  insight_a_sources: string | null;
  insight_b_value: string;
  insight_b_confidence: string;
  insight_b_sources: string | null;
  resolution_status: string;
  created_at: string;
}

export default function Conflicts() {
  const [, navigate] = useLocation();
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("projectId");
  const projectDbName = params.get("projectDbName");

  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);
  const [mergedValue, setMergedValue] = useState("");

  const { data: conflicts, isLoading, refetch } = trpc.conflicts.list.useQuery(
    { projectDbName: projectDbName || "" },
    { enabled: !!projectDbName }
  );

  const resolveMutation = trpc.conflicts.resolve.useMutation({
    onSuccess: () => {
      toast.success("Conflict resolved successfully");
      refetch();
      setMergeDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to resolve conflict: ${error.message}`);
    },
  });

  const handleAcceptA = (conflict: Conflict) => {
    if (!projectDbName) return;
    
    if (confirm("Keep Insight A and delete Insight B?")) {
      resolveMutation.mutate({
        projectDbName,
        conflictId: conflict.id,
        resolution: "accept_a",
      });
    }
  };

  const handleAcceptB = (conflict: Conflict) => {
    if (!projectDbName) return;
    
    if (confirm("Keep Insight B and delete Insight A?")) {
      resolveMutation.mutate({
        projectDbName,
        conflictId: conflict.id,
        resolution: "accept_b",
      });
    }
  };

  const handleMerge = (conflict: Conflict) => {
    setSelectedConflict(conflict);
    setMergedValue(`${conflict.insight_a_value}\n\n${conflict.insight_b_value}`);
    setMergeDialogOpen(true);
  };

  const handleIgnore = (conflict: Conflict) => {
    if (!projectDbName) return;
    
    if (confirm("Mark this conflict as ignored? Both insights will remain.")) {
      resolveMutation.mutate({
        projectDbName,
        conflictId: conflict.id,
        resolution: "ignore",
      });
    }
  };

  const submitMerge = () => {
    if (!selectedConflict || !projectDbName) return;
    
    resolveMutation.mutate({
      projectDbName,
      conflictId: selectedConflict.id,
      resolution: "merge",
      mergedValue,
    });
  };

  const parseSourceDocs = (sources: string | null): string[] => {
    if (!sources) return [];
    try {
      return JSON.parse(sources);
    } catch {
      return [];
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <Button
          onClick={() => navigate(`/insights?projectId=${projectId}`)}
          variant="ghost"
          className="mb-4 text-slate-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Insights
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-400" />
              Insight Conflicts
            </h1>
            <p className="text-slate-400">
              Resolve conflicting information from multiple documents
            </p>
          </div>
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-lg px-4 py-2">
            {conflicts?.length || 0} pending
          </Badge>
        </div>
      </div>

      {/* Conflicts List */}
      <div className="max-w-7xl mx-auto space-y-6">
        {isLoading ? (
          <Card className="p-8 bg-slate-900/50 border-slate-800 text-center">
            <p className="text-slate-400">Loading conflicts...</p>
          </Card>
        ) : !conflicts || conflicts.length === 0 ? (
          <Card className="p-8 bg-slate-900/50 border-slate-800 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-slate-300 text-lg font-medium mb-2">No conflicts found</p>
            <p className="text-slate-400">All insights are consistent across documents</p>
          </Card>
        ) : (
          conflicts.map((conflict: Conflict) => (
            <Card key={conflict.id} className="bg-slate-900/50 border-slate-800 overflow-hidden">
              {/* Conflict Header */}
              <div className="p-4 bg-red-500/10 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <span className="text-red-400 font-medium">Conflicting Information Detected</span>
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(conflict.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* Side-by-Side Comparison */}
              <div className="grid grid-cols-2 divide-x divide-slate-800">
                {/* Insight A */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Insight A</h3>
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      {(parseFloat(conflict.insight_a_confidence) * 100).toFixed(0)}% confidence
                    </Badge>
                  </div>
                  <p className="text-slate-200 leading-relaxed mb-4">{conflict.insight_a_value}</p>
                  {parseSourceDocs(conflict.insight_a_sources).length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <FileText className="h-4 w-4" />
                      {parseSourceDocs(conflict.insight_a_sources).length} source document(s)
                    </div>
                  )}
                </div>

                {/* Insight B */}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Insight B</h3>
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                      {(parseFloat(conflict.insight_b_confidence) * 100).toFixed(0)}% confidence
                    </Badge>
                  </div>
                  <p className="text-slate-200 leading-relaxed mb-4">{conflict.insight_b_value}</p>
                  {parseSourceDocs(conflict.insight_b_sources).length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <FileText className="h-4 w-4" />
                      {parseSourceDocs(conflict.insight_b_sources).length} source document(s)
                    </div>
                  )}
                </div>
              </div>

              {/* Resolution Actions */}
              <div className="p-4 bg-slate-800/50 border-t border-slate-800 flex items-center justify-center gap-3">
                <Button
                  onClick={() => handleAcceptA(conflict)}
                  className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30"
                  disabled={resolveMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accept A
                </Button>
                <Button
                  onClick={() => handleAcceptB(conflict)}
                  className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30"
                  disabled={resolveMutation.isPending}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Accept B
                </Button>
                <Button
                  onClick={() => handleMerge(conflict)}
                  className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30"
                  disabled={resolveMutation.isPending}
                >
                  <GitMerge className="h-4 w-4 mr-2" />
                  Merge Both
                </Button>
                <Button
                  onClick={() => handleIgnore(conflict)}
                  variant="outline"
                  className="border-slate-700 hover:bg-slate-800"
                  disabled={resolveMutation.isPending}
                >
                  <EyeOff className="h-4 w-4 mr-2" />
                  Ignore
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Merge Dialog */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <GitMerge className="h-5 w-5 text-green-400" />
              Merge Conflicting Insights
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Combine both insights into a single statement that captures all relevant information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Merged Value</label>
              <Textarea
                value={mergedValue}
                onChange={(e) => setMergedValue(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white min-h-[200px] resize-y"
                placeholder="Enter the merged insight statement..."
              />
              <p className="text-xs text-slate-500 mt-1">{mergedValue.length} characters</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setMergeDialogOpen(false)}
              variant="outline"
              className="border-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={submitMerge}
              className="bg-green-500 hover:bg-green-600 text-white"
              disabled={!mergedValue.trim() || resolveMutation.isPending}
            >
              <GitMerge className="h-4 w-4 mr-2" />
              Create Merged Insight
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
