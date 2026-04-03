import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Clock, 
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Terminal,
  Play,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { toast } from "sonner";

interface ProcessingJob {
  id: number;
  document_id: string;
  document_name: string;
  status: string;
  stage: string;
  progress_percent: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  estimated_completion: string | null;
}

interface ProcessingLog {
  id: string;
  documentId: string;
  document_name: string;
  step: string;
  status: string;
  message: string;
  durationMs: number | null;
  createdAt: string;
}

export default function ProcessingStatus() {
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const projectIdStr = searchParams.get("projectId");
  const projectId = projectIdStr ? parseInt(projectIdStr, 10) : null;
  const [consoleExpanded, setConsoleExpanded] = useState(true);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Fetch project details
  const { data: project, isLoading: isLoadingProject } = trpc.projects.get.useQuery(
    { id: Number(projectId) },
    { enabled: !!projectId }
  );

  // Fetch jobs
  const { data: jobs, isLoading: isLoadingJobs, refetch: refetchJobs } = trpc.processing.listJobs.useQuery(
    { projectId: String(projectId) },
    { 
      enabled: !!projectId,
      refetchInterval: 2000, // Poll every 2 seconds
    }
  );

  // Fetch processing logs
  const { data: logs, refetch: refetchLogs } = trpc.processing.getLogs.useQuery(
    { projectId: String(projectId), documentId: undefined },
    { 
      enabled: !!projectId,
      refetchInterval: 1500, // Poll every 1.5 seconds for real-time console
    }
  );

  // Process next document mutation
  const processNextMutation = trpc.documents.processNext.useMutation({
    onSuccess: (result) => {
      if (result.status === 'started' || result.status === 'processing') {
        // Processing started, logs will update automatically
      }
      refetchJobs();
      refetchLogs();
    },
    onError: (error: any) => {
      console.error('[ProcessingStatus] processNext error:', error);
    },
  });

  const clearLogsMutation = trpc.processing.clearLogs.useMutation({
    onSuccess: () => {
      refetchLogs();
      toast.success("Console cleared");
    },
    onError: (error: any) => {
      toast.error(`Failed to clear logs: ${error.message}`);
    },
  });

  const retryJobMutation = trpc.processing.retryJob.useMutation({
    onSuccess: () => {
      toast.success("Job queued for retry");
      refetchJobs();
    },
    onError: (error: any) => {
      toast.error(`Failed to retry job: ${error.message}`);
    },
  });

  // Auto-scroll console to bottom when new logs arrive
  useEffect(() => {
    if (consoleRef.current && consoleExpanded) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, consoleExpanded]);

  // Track which documents we've already triggered processing for
  const triggeredDocsRef = useRef<Set<string>>(new Set());
  
  // Trigger processing when there are queued jobs
  useEffect(() => {
    if (!projectId || !jobs) return;
    
    // Find queued jobs that we haven't already triggered
    const queuedJobs = jobs.filter((j: ProcessingJob) => j.status === 'queued');
    const hasProcessingJobs = jobs.some((j: ProcessingJob) => j.status === 'processing');
    
    // Clean up triggered docs that are no longer queued (completed or failed)
    const currentDocIds = new Set(jobs.map((j: ProcessingJob) => j.document_id));
    triggeredDocsRef.current.forEach(docId => {
      if (!currentDocIds.has(docId)) {
        triggeredDocsRef.current.delete(docId);
      }
    });
    
    // Find a queued job we haven't triggered yet
    const untriggeredQueuedJob = queuedJobs.find(
      (j: ProcessingJob) => !triggeredDocsRef.current.has(j.document_id)
    );
    
    // If there's an untriggered queued job and nothing is currently processing, start processing
    if (untriggeredQueuedJob && !hasProcessingJobs && !processNextMutation.isPending) {
      console.log(`[ProcessingStatus] Triggering processNext for ${untriggeredQueuedJob.document_id}`);
      triggeredDocsRef.current.add(untriggeredQueuedJob.document_id);
      processNextMutation.mutate({ projectId: String(projectId) });
    }
  }, [jobs, projectId]);

  const isLoading = isLoadingProject || isLoadingJobs;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
      case "Completed":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Completed</Badge>;
      case "failed":
      case "Failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Failed</Badge>;
      case "processing":
      case "In_Progress":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Processing</Badge>;
      case "queued":
      case "Started":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Started</Badge>;
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
      case "Completed":
        return <CheckCircle2 className="h-5 w-5 text-green-400" />;
      case "failed":
      case "Failed":
        return <XCircle className="h-5 w-5 text-red-400" />;
      case "processing":
      case "In_Progress":
        return <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />;
      case "queued":
      case "Started":
        return <Clock className="h-5 w-5 text-yellow-400" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-slate-400" />;
    }
  };

  const getLogColor = (status: string) => {
    switch (status) {
      case "Completed": return "text-green-400";
      case "Failed": return "text-red-400";
      case "In_Progress": return "text-blue-400";
      case "Started": return "text-yellow-400";
      default: return "text-slate-400";
    }
  };

  const getStepIcon = (step: string) => {
    switch (step) {
      case "Upload": return "📥";
      case "Text_Extraction": return "📄";
      case "Deterministic_Extraction": return "🔍";
      case "LLM_Extraction": return "🤖";
      case "Consolidation": return "🔗";
      case "Red_Flag_Detection": return "🚩";
      case "Complete": return "✅";
      default: return "⚙️";
    }
  };

  if (!projectId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Card className="p-6 bg-slate-900/50 border-slate-800">
          <p className="text-slate-400">No project selected</p>
          <Button
            onClick={() => navigate("/projects")}
            className="mt-4 bg-orange-500 hover:bg-orange-600"
          >
            Go to Projects
          </Button>
        </Card>
      </div>
    );
  }

  const stats = {
    total: jobs?.length || 0,
    queued: jobs?.filter((j: ProcessingJob) => j.status === "queued").length || 0,
    processing: jobs?.filter((j: ProcessingJob) => j.status === "processing").length || 0,
    completed: jobs?.filter((j: ProcessingJob) => j.status === "completed").length || 0,
    failed: jobs?.filter((j: ProcessingJob) => j.status === "failed").length || 0,
  };

  // Get the currently processing job for display
  const currentJob = jobs?.find((j: ProcessingJob) => j.status === "processing");

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => navigate(`/project/${projectId}/documents`)}
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Documents
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white">Processing Status</h1>
                <p className="text-sm text-slate-400 mt-1">
                  {project?.name || 'Loading...'} • Real-time processing monitor
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(stats.queued > 0 || stats.processing > 0) && (
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Processing Active
                </Badge>
              )}
              <Button
                onClick={() => {
                  refetchJobs();
                  refetchLogs();
                }}
                variant="outline"
                size="sm"
                className="border-slate-700 hover:bg-slate-800"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-sm text-slate-400">Total</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.queued}</p>
                <p className="text-sm text-slate-400">Queued</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <div className="flex items-center gap-3">
              <Loader2 className={`h-8 w-8 text-blue-400 ${stats.processing > 0 ? 'animate-spin' : ''}`} />
              <div>
                <p className="text-2xl font-bold text-white">{stats.processing}</p>
                <p className="text-sm text-slate-400">Processing</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.completed}</p>
                <p className="text-sm text-slate-400">Completed</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.failed}</p>
                <p className="text-sm text-slate-400">Failed</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Live Console */}
        <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
          <div 
            className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border-b border-slate-700 cursor-pointer"
            onClick={() => setConsoleExpanded(!consoleExpanded)}
          >
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-green-400" />
              <span className="font-medium text-white">Live Processing Console</span>
              {currentJob && (
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 ml-2">
                  {currentJob.document_name}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {logs && logs.length > 0 && (
                <>
                  <span className="text-xs text-slate-400">{logs.length} log entries</span>
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (projectId) clearLogsMutation.mutate({ projectId: String(projectId) });
                    }}
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs text-slate-400 hover:text-white hover:bg-slate-700"
                    disabled={clearLogsMutation.isPending}
                  >
                    Clear
                  </Button>
                </>
              )}
              {consoleExpanded ? (
                <ChevronUp className="h-5 w-5 text-slate-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-slate-400" />
              )}
            </div>
          </div>
          
          {consoleExpanded && (
            <div 
              ref={consoleRef}
              className="bg-slate-950 p-4 font-mono text-sm h-64 overflow-y-auto"
            >
              {!logs || logs.length === 0 ? (
                <div className="text-slate-500 flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  <span>Waiting for processing logs...</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {[...logs].reverse().map((log: ProcessingLog, index: number) => (
                    <div key={log.id || index} className="flex items-start gap-2">
                      <span className="text-slate-600 text-xs whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </span>
                      <span className="text-slate-500">{getStepIcon(log.step)}</span>
                      <span className={`font-semibold ${getLogColor(log.status)}`}>
                        [{log.step.replace(/_/g, ' ')}]
                      </span>
                      <span className="text-slate-300 flex-1">{log.message}</span>
                      {log.durationMs && (
                        <span className="text-slate-500 text-xs">
                          {(log.durationMs / 1000).toFixed(2)}s
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Jobs Table */}
        <Card className="bg-slate-900/50 border-slate-800">
          <div className="px-4 py-3 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-white">Processing Jobs</h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-slate-800/50">
                  <TableHead className="text-slate-300">Status</TableHead>
                  <TableHead className="text-slate-300">Document</TableHead>
                  <TableHead className="text-slate-300">Stage</TableHead>
                  <TableHead className="text-slate-300">Progress</TableHead>
                  <TableHead className="text-slate-300">Started</TableHead>
                  <TableHead className="text-slate-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      Loading jobs...
                    </TableCell>
                  </TableRow>
                ) : jobs && jobs.length > 0 ? (
                  jobs.map((job: ProcessingJob) => (
                    <TableRow key={job.id} className="border-slate-800 hover:bg-slate-800/30">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(job.status)}
                          {getStatusBadge(job.status)}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-white">{job.document_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-slate-700 text-slate-300">
                          {job.stage?.replace(/_/g, ' ') || 'pending'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 min-w-[120px]">
                          <Progress value={job.progress_percent} className="h-2" />
                          <p className="text-xs text-slate-400">{job.progress_percent}%</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-300 text-sm">
                        {new Date(job.started_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {job.status === "failed" && projectId && (
                          <Button
                            size="sm"
                            onClick={() => retryJobMutation.mutate({ 
                              projectId: String(projectId), 
                              jobId: job.id 
                            })}
                            className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30"
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                        )}
                        {job.error_message && (
                          <p className="text-xs text-red-400 mt-1 max-w-[200px] truncate" title={job.error_message}>
                            {job.error_message}
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No processing jobs found.</p>
                      <Button
                        onClick={() => navigate(`/project/${projectId}/documents`)}
                        variant="link"
                        className="text-orange-400 mt-2"
                      >
                        Upload documents to start processing
                      </Button>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </main>
    </div>
  );
}
