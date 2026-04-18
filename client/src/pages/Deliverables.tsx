import { useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  Download,
  FileText,
  FilePlus,
  Loader2,
  MoreVertical,
  PenTool,
  Printer,
  RefreshCw,
  Trash2,
  AlertTriangle,
  BarChart3,
  Shield,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

// ─── Report Type Definitions ──────────────────────────────────────────────

interface ReportType {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  available: boolean;
  comingSoon?: boolean;
}

const REPORT_TYPES: ReportType[] = [
  {
    id: "dd_report",
    name: "Due Diligence Report",
    description:
      "Comprehensive technical due diligence report covering site suitability, technology review, grid connection, performance assessment, financial model review, and risk analysis.",
    icon: FileText,
    available: true,
  },
  {
    id: "technical_summary",
    name: "Technical Summary",
    description:
      "Concise technical summary highlighting key project parameters, technology specifications, and critical findings for quick stakeholder review.",
    icon: BarChart3,
    available: false,
    comingSoon: true,
  },
  {
    id: "risk_register",
    name: "Risk Register Export",
    description:
      "Structured risk register with severity ratings, mitigation strategies, and ownership assignments extracted from project analysis.",
    icon: Shield,
    available: false,
    comingSoon: true,
  },
  {
    id: "performance_report",
    name: "Performance Validation Report",
    description:
      "Detailed performance assessment report covering energy yield analysis, capacity factors, degradation assumptions, and P50/P90 estimates.",
    icon: Zap,
    available: false,
    comingSoon: true,
  },
];

// ─── Step badge helper ──────────────────────────────────────────────────────

function StepBadge({ step }: { step: string }) {
  const config: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    structure: {
      label: "Structuring",
      className: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      icon: BookOpen,
    },
    content: {
      label: "Editing Content",
      className: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      icon: PenTool,
    },
    generating: {
      label: "Generating...",
      className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      icon: Loader2,
    },
    completed: {
      label: "Completed",
      className: "bg-green-500/20 text-green-400 border-green-500/30",
      icon: Check,
    },
    failed: {
      label: "Failed",
      className: "bg-red-500/20 text-red-400 border-red-500/30",
      icon: AlertTriangle,
    },
  };

  const c = config[step] || {
    label: step,
    className: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    icon: Clock,
  };
  const Icon = c.icon;

  return (
    <Badge variant="outline" className={`text-xs ${c.className}`}>
      <Icon className={`h-3 w-3 mr-1 ${step === "generating" ? "animate-spin" : ""}`} />
      {c.label}
    </Badge>
  );
}

// ─── Format date helper ─────────────────────────────────────────────────────

function formatDate(dateStr: string | Date | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Deliverables() {
  const [, navigate] = useLocation();
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId ? parseInt(params.projectId, 10) : null;

  // Fetch project details
  const { data: project, isLoading: isLoadingProject } = trpc.projects.get.useQuery(
    { id: Number(projectId) },
    { enabled: !!projectId }
  );

  // Fetch report drafts
  const {
    data: drafts,
    isLoading: isLoadingDrafts,
    refetch: refetchDrafts,
  } = trpc.report.listDrafts.useQuery({ projectId: projectId! }, { enabled: !!projectId });

  // Fetch completed reports
  const {
    data: completedReports,
    isLoading: isLoadingReports,
  } = trpc.report.listByProject.useQuery({ projectId: projectId! }, { enabled: !!projectId });

  // Delete draft mutation
  const deleteDraft = trpc.report.deleteDraft.useMutation({
    onSuccess: () => {
      toast.success("Draft deleted");
      refetchDrafts();
    },
    onError: (err) => toast.error("Failed to delete draft", { description: err.message }),
  });

  const projectName = (project as any)?.projectName || (project as any)?.name || `Project ${projectId}`;

  // Separate active drafts from completed
  const activeDrafts = useMemo(
    () => (drafts || []).filter((d: any) => d.step !== "completed"),
    [drafts]
  );

  const completedDrafts = useMemo(
    () => (drafts || []).filter((d: any) => d.step === "completed"),
    [drafts]
  );

  if (!projectId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <p className="text-slate-400">No project selected</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/project-dashboard?projectId=${projectId}`)}
              className="text-slate-400 hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <Separator orientation="vertical" className="h-6 bg-slate-700" />
            <div>
              <h1 className="text-sm font-semibold text-slate-200">Deliverables</h1>
              <p className="text-xs text-slate-500">{projectName}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-5xl">
        {/* Available Report Types */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <FilePlus className="h-5 w-5 text-orange-400" />
            Create New Report
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {REPORT_TYPES.map((rt) => {
              const Icon = rt.icon;
              return (
                <Card
                  key={rt.id}
                  className={`border-slate-700 p-5 transition-all ${
                    rt.available
                      ? "bg-slate-900/60 hover:bg-slate-800/60 hover:border-orange-500/40 cursor-pointer"
                      : "bg-slate-900/30 opacity-60 cursor-not-allowed"
                  }`}
                  onClick={() => {
                    if (rt.available) {
                      navigate(`/project/${projectId}/report-builder`);
                    } else {
                      toast.info("Feature coming soon", {
                        description: `${rt.name} will be available in a future update.`,
                      });
                    }
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        rt.available
                          ? "bg-orange-500/20 text-orange-400"
                          : "bg-slate-700/50 text-slate-500"
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-slate-200">{rt.name}</h3>
                        {rt.comingSoon && (
                          <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-600">
                            Coming Soon
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{rt.description}</p>
                    </div>
                    {rt.available && (
                      <ArrowRight className="h-4 w-4 text-slate-600 shrink-0 mt-1" />
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Active Drafts */}
        {activeDrafts.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <PenTool className="h-5 w-5 text-purple-400" />
              Drafts in Progress
              <Badge variant="outline" className="text-xs text-slate-500 border-slate-700 ml-1">
                {activeDrafts.length}
              </Badge>
            </h2>
            <div className="space-y-3">
              {activeDrafts.map((draft: any) => (
                <Card
                  key={draft.id}
                  className="bg-slate-900/60 border-slate-700 p-4 hover:bg-slate-800/60 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-medium text-slate-200 truncate">
                          {draft.report_title || "Untitled Draft"}
                        </h3>
                        <StepBadge step={draft.step} />
                      </div>
                      <p className="text-xs text-slate-500">
                        Started by {draft.created_by_user_name} &middot; {formatDate(draft.created_at)}
                        {draft.updated_at !== draft.created_at && (
                          <> &middot; Updated {formatDate(draft.updated_at)}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => navigate(`/project/${projectId}/report-builder`)}
                        className="bg-orange-600 hover:bg-orange-700 text-white text-xs"
                      >
                        Continue
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm("Delete this draft? This cannot be undone.")) {
                            deleteDraft.mutate({ draftId: draft.id });
                          }
                        }}
                        className="text-slate-500 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Completed Reports */}
        <section>
          <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Check className="h-5 w-5 text-green-400" />
            Completed Reports
            <Badge variant="outline" className="text-xs text-slate-500 border-slate-700 ml-1">
              {(completedDrafts.length || 0) + (completedReports?.length || 0)}
            </Badge>
          </h2>

          {isLoadingDrafts || isLoadingReports ? (
            <div className="text-center py-10">
              <Loader2 className="h-6 w-6 text-slate-500 animate-spin mx-auto" />
            </div>
          ) : (completedDrafts.length === 0 && (!completedReports || completedReports.length === 0)) ? (
            <Card className="bg-slate-900/30 border-slate-700/50 p-10 text-center">
              <FileText className="h-10 w-10 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-slate-500 mb-1">No completed reports yet</p>
              <p className="text-xs text-slate-600">
                Create a new report above to get started.
              </p>
            </Card>
          ) : (
            <div className="space-y-3">
              {/* Completed drafts (new workflow) */}
              {completedDrafts.map((draft: any) => (
                <Card
                  key={`draft-${draft.id}`}
                  className="bg-slate-900/60 border-slate-700 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center shrink-0">
                      <Check className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-medium text-slate-200 truncate">
                          {draft.report_title || "DD Report"}
                        </h3>
                        <StepBadge step="completed" />
                      </div>
                      <p className="text-xs text-slate-500">
                        By {draft.created_by_user_name} &middot; {formatDate(draft.updated_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {draft.file_url && (
                        <Button
                          size="sm"
                          onClick={() => window.open(draft.file_url, "_blank")}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}

              {/* Legacy completed reports */}
              {(completedReports || []).map((report: any) => (
                <Card
                  key={`report-${report.id}`}
                  className="bg-slate-900/60 border-slate-700 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-green-500/20 text-green-400 flex items-center justify-center shrink-0">
                      <Check className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-sm font-medium text-slate-200 truncate">
                          {report.report_title || "DD Report"}
                        </h3>
                        <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-600">
                          Legacy
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500">
                        By {report.generated_by_user_name} &middot; {formatDate(report.completed_at || report.created_at)}
                        {report.file_size_bytes && (
                          <> &middot; {(report.file_size_bytes / 1024).toFixed(0)} KB</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {report.file_url && (
                        <Button
                          size="sm"
                          onClick={() => window.open(report.file_url, "_blank")}
                          className="bg-green-600 hover:bg-green-700 text-white text-xs"
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Download
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
