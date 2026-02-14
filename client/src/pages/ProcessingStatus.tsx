import { useEffect, useState } from "react";
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
  ArrowLeft 
} from "lucide-react";
import { toast } from "sonner";

interface ProcessingJob {
  id: number;
  document_id: number;
  document_name: string;
  status: string;
  stage: string;
  progress_percent: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  estimated_completion: string | null;
}

export default function ProcessingStatus() {
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const projectIdStr = searchParams.get("projectId");
  const projectId = projectIdStr ? parseInt(projectIdStr, 10) : null;

  // Fetch project details to get dbName
  const { data: project, isLoading: isLoadingProject } = trpc.projects.get.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  // Fetch jobs using dbName from project
  const { data: jobs, isLoading: isLoadingJobs, refetch } = trpc.processing.listJobs.useQuery(
    { projectId: project?.dbName || "" },
    { 
      enabled: !!project?.dbName,
      refetchInterval: 3000, // Poll every 3 seconds for real-time updates
    }
  );

  const isLoading = isLoadingProject || isLoadingJobs;

  const retryJobMutation = trpc.processing.retryJob.useMutation({
    onSuccess: () => {
      toast.success("Job queued for retry");
      refetch();
    },
    onError: (error: any) => {
      toast.error(`Failed to retry job: ${error.message}`);
    },
  });

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Completed</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Failed</Badge>;
      case "processing":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Processing</Badge>;
      case "queued":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Queued</Badge>;
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">{status}</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-5 w-5 text-green-400" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-400" />;
      case "processing":
        return <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />;
      case "queued":
        return <Clock className="h-5 w-5 text-yellow-400" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-slate-400" />;
    }
  };

  const stats = {
    total: jobs?.length || 0,
    queued: jobs?.filter((j: ProcessingJob) => j.status === "queued").length || 0,
    processing: jobs?.filter((j: ProcessingJob) => j.status === "processing").length || 0,
    completed: jobs?.filter((j: ProcessingJob) => j.status === "completed").length || 0,
    failed: jobs?.filter((j: ProcessingJob) => j.status === "failed").length || 0,
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                onClick={() => navigate("/projects")}
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-white">Processing Status</h1>
                <p className="text-sm text-slate-400 mt-1">Monitor document processing jobs</p>
              </div>
            </div>
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              className="border-slate-700 hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-sm text-slate-400">Total Jobs</p>
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

        {/* Jobs Table */}
        <Card className="bg-slate-900/50 border-slate-800">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-slate-800/50">
                  <TableHead className="text-slate-300">Status</TableHead>
                  <TableHead className="text-slate-300">Document</TableHead>
                  <TableHead className="text-slate-300">Stage</TableHead>
                  <TableHead className="text-slate-300">Progress</TableHead>
                  <TableHead className="text-slate-300">Started</TableHead>
                  <TableHead className="text-slate-300">Est. Completion</TableHead>
                  <TableHead className="text-slate-300">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-400 py-8">
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
                          {job.stage}
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
                      <TableCell className="text-slate-300 text-sm">
                        {job.estimated_completion 
                          ? new Date(job.estimated_completion).toLocaleString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {job.status === "failed" && project?.dbName && (
                          <Button
                            size="sm"
                            onClick={() => retryJobMutation.mutate({ 
                              projectId: project.dbName, 
                              jobId: job.id 
                            })}
                            className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30"
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                        )}
                        {job.error_message && (
                          <p className="text-xs text-red-400 mt-1">{job.error_message}</p>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-400 py-8">
                      No processing jobs found. Upload documents to start processing.
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
