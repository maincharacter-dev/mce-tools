import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText,
  ArrowLeft,
  RefreshCw,
  Download,
  Edit3,
  Check,
  X,
  Loader2,
  Sparkles,
  BookOpen,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Copy,
} from "lucide-react";
import {
  CANONICAL_SECTIONS,
  SECTION_DISPLAY_NAMES,
  SECTION_DESCRIPTIONS,
  normalizeSection,
} from "../../../shared/section-normalizer";
import { toast } from "sonner";

const SECTION_ORDER = [
  CANONICAL_SECTIONS.PROJECT_OVERVIEW,
  CANONICAL_SECTIONS.TECHNICAL_DESIGN,
  CANONICAL_SECTIONS.FINANCIAL_STRUCTURE,
  CANONICAL_SECTIONS.DEPENDENCIES,
  CANONICAL_SECTIONS.RISKS_AND_ISSUES,
  CANONICAL_SECTIONS.ENGINEERING_ASSUMPTIONS,
];

export default function Deliverables() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, navigate] = useLocation();
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<string>("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(SECTION_ORDER)
  );
  const [consolidating, setConsolidating] = useState(false);
  const [consolidationProgress, setConsolidationProgress] = useState(0);
  const [consolidationStep, setConsolidationStep] = useState("");
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);

  // Fetch project details
  const { data: project } = trpc.projects.get.useQuery(
    { id: Number(projectId) || 0 },
    { enabled: !!projectId }
  );

  // Fetch narratives
  const {
    data: narratives,
    isLoading: narrativesLoading,
    refetch: refetchNarratives,
  } = trpc.facts.getNarratives.useQuery(
    { projectId: projectId || "" },
    { enabled: !!projectId }
  );

  // Fetch facts for re-synthesis
  const { data: factsData } = trpc.facts.list.useQuery(
    { projectId: projectId || "" },
    { enabled: !!projectId }
  );

  // Fetch consolidation job status
  const { data: consolidationStatus, refetch: refetchConsolidation } =
    trpc.projects.getConsolidationStatus.useQuery(
      { projectId: projectId || "" },
      { enabled: !!projectId }
    );

  // Save narrative mutation
  const saveNarrativeMutation = trpc.facts.saveNarrative.useMutation({
    onSuccess: () => {
      refetchNarratives();
      setEditingSection(null);
      toast.success("Narrative saved");
    },
    onError: (err) => {
      toast.error(`Failed to save: ${err.message}`);
    },
  });

  // Synthesize narrative on demand
  const synthesizeMutation = trpc.facts.synthesizeNarrativeOnDemand.useMutation({
    onSuccess: async (data, variables) => {
      // Auto-save the synthesized narrative
      await saveNarrativeMutation.mutateAsync({
        projectId: projectId || "",
        sectionKey: variables.canonicalName,
        narrative: data.narrative,
      });
      setRegeneratingSection(null);
      toast.success(`Narrative regenerated for ${SECTION_DISPLAY_NAMES[variables.canonicalName] || variables.section}`);
    },
    onError: (err) => {
      setRegeneratingSection(null);
      toast.error(`Failed to regenerate: ${err.message}`);
    },
  });

  // Consolidate mutation
  const consolidateMutation = trpc.projects.consolidate.useMutation({
    onSuccess: (data) => {
      const job = data.job;
      setConsolidationProgress(job?.progress || 0);
      setConsolidationStep(job?.currentStep || "");
      if (data.done || job?.status === "completed") {
        setConsolidating(false);
        refetchNarratives();
        toast.success("Consolidation complete! All narratives generated.");
      } else if (job?.status === "failed") {
        setConsolidating(false);
        toast.error(`Consolidation failed: ${job?.error || "Unknown error"}`);
      } else {
        // Continue polling — call next step
        setTimeout(() => consolidateMutation.mutate({ projectId: projectId || "" }), 1500);
      }
    },
    onError: (err) => {
      setConsolidating(false);
      toast.error(`Consolidation error: ${err.message}`);
    },
  });

  const handleConsolidate = () => {
    setConsolidating(true);
    setConsolidationProgress(0);
    setConsolidationStep("Starting...");
    consolidateMutation.mutate({ projectId: projectId || "" });
  };

  const handleRegenerateSection = (sectionKey: string) => {
    if (!factsData) return;
    const sectionFacts = factsData.filter(
      (f: any) => normalizeSection(f.category || f.section || f.section_key || "") === sectionKey
    );
    if (sectionFacts.length === 0) {
      toast.warning("No facts available for this section to generate a narrative from.");
      return;
    }
    setRegeneratingSection(sectionKey);
    synthesizeMutation.mutate({
      projectId: projectId || "",
      section: SECTION_DISPLAY_NAMES[sectionKey] || sectionKey,
      canonicalName: sectionKey,
      facts: sectionFacts.map((f: any) => ({
        key: f.key || f.fact_key || "",
        value: f.value || f.fact_value || "",
        confidence: f.confidence || "medium",
      })),
    });
  };

  const handleStartEdit = (sectionKey: string) => {
    setEditDraft(narratives?.[sectionKey] || "");
    setEditingSection(sectionKey);
  };

  const handleSaveEdit = () => {
    if (!editingSection) return;
    saveNarrativeMutation.mutate({
      projectId: projectId || "",
      sectionKey: editingSection,
      narrative: editDraft,
    });
  };

  const handleCancelEdit = () => {
    setEditingSection(null);
    setEditDraft("");
  };

  const toggleSection = (sectionKey: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  };

  const handleCopySection = (sectionKey: string) => {
    const text = narratives?.[sectionKey];
    if (text) {
      navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    }
  };

  const handleCopyAll = () => {
    if (!narratives) return;
    const fullReport = SECTION_ORDER
      .filter((key) => narratives[key])
      .map((key) => `## ${SECTION_DISPLAY_NAMES[key] || key}\n\n${narratives[key]}`)
      .join("\n\n---\n\n");
    navigator.clipboard.writeText(fullReport);
    toast.success("Full report copied to clipboard");
  };

  const handleDownloadMarkdown = () => {
    if (!narratives) return;
    const projectName = project?.name || `Project ${projectId}`;
    const date = new Date().toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const header = `# ${projectName} — Technical Advisory Report\n\n*Generated: ${date}*\n\n---\n\n`;
    const body = SECTION_ORDER
      .filter((key) => narratives[key])
      .map((key) => `## ${SECTION_DISPLAY_NAMES[key] || key}\n\n${narratives[key]}`)
      .join("\n\n---\n\n");
    const content = header + body;
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, "_")}_TA_Report.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  const narrativeCount = narratives
    ? SECTION_ORDER.filter((key) => narratives[key]).length
    : 0;
  const totalSections = SECTION_ORDER.length;
  const hasAnyNarratives = narrativeCount > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/project-dashboard?projectId=${projectId}`)}
              className="text-slate-400 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div className="h-4 w-px bg-slate-700" />
            <BookOpen className="h-5 w-5 text-orange-400" />
            <div>
              <h1 className="text-lg font-semibold text-white">Deliverables</h1>
              {project && (
                <p className="text-xs text-slate-400">{project.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-slate-600 text-slate-300 text-xs"
            >
              {narrativeCount}/{totalSections} sections
            </Badge>
            {hasAnyNarratives && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAll}
                  className="border-slate-700 hover:bg-slate-800 text-slate-300"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copy All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadMarkdown}
                  className="border-slate-700 hover:bg-slate-800 text-slate-300"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download .md
                </Button>
              </>
            )}
            <Button
              size="sm"
              onClick={handleConsolidate}
              disabled={consolidating}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {consolidating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  {consolidationStep || "Processing..."}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1" />
                  {hasAnyNarratives ? "Re-generate All" : "Generate Report"}
                </>
              )}
            </Button>
          </div>
        </div>
        {/* Consolidation progress bar */}
        {consolidating && (
          <div className="h-1 bg-slate-800">
            <div
              className="h-1 bg-orange-500 transition-all duration-500"
              style={{ width: `${consolidationProgress}%` }}
            />
          </div>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Empty state */}
        {narrativesLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
          </div>
        ) : !hasAnyNarratives ? (
          <Card className="bg-slate-900 border-slate-800 p-12 text-center">
            <BookOpen className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">
              No report sections yet
            </h2>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              Run consolidation to generate AI-written narrative sections from
              the extracted insights. Make sure you have uploaded and processed
              documents first.
            </p>
            <Button
              onClick={handleConsolidate}
              disabled={consolidating}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {consolidating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Report Sections
                </>
              )}
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Report intro */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-1">
                {project?.name || `Project ${projectId}`}
              </h2>
              <p className="text-slate-400 text-sm">
                Technical Advisory Report — AI-generated from extracted insights.
                Click any section to expand, edit, or regenerate.
              </p>
            </div>

            {SECTION_ORDER.map((sectionKey) => {
              const narrative = narratives?.[sectionKey];
              const displayName =
                SECTION_DISPLAY_NAMES[sectionKey] || sectionKey;
              const description = SECTION_DESCRIPTIONS[sectionKey] || "";
              const isExpanded = expandedSections.has(sectionKey);
              const isEditing = editingSection === sectionKey;
              const isRegenerating = regeneratingSection === sectionKey;
              const hasNarrative = !!narrative;

              return (
                <Card
                  key={sectionKey}
                  className={`bg-slate-900 border-slate-800 overflow-hidden transition-all ${
                    hasNarrative
                      ? "border-slate-700"
                      : "border-dashed border-slate-700 opacity-70"
                  }`}
                >
                  {/* Section header */}
                  <div
                    className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
                    onClick={() => !isEditing && toggleSection(sectionKey)}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          hasNarrative ? "bg-green-400" : "bg-slate-600"
                        }`}
                      />
                      <div>
                        <h3 className="font-semibold text-white text-sm">
                          {displayName}
                        </h3>
                        <p className="text-xs text-slate-500">{description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {hasNarrative && !isEditing && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopySection(sectionKey)}
                            className="h-7 px-2 text-slate-400 hover:text-white"
                            title="Copy section"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEdit(sectionKey)}
                            className="h-7 px-2 text-slate-400 hover:text-white"
                            title="Edit narrative"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRegenerateSection(sectionKey)}
                        disabled={isRegenerating}
                        className="h-7 px-2 text-slate-400 hover:text-orange-400"
                        title="Regenerate with AI"
                      >
                        {isRegenerating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <button
                        onClick={() => toggleSection(sectionKey)}
                        className="text-slate-500 hover:text-white ml-1"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Section content */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-slate-800">
                      {isEditing ? (
                        <div className="mt-4 space-y-3">
                          <Textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            className="min-h-[200px] bg-slate-800 border-slate-600 text-white text-sm leading-relaxed resize-y"
                            placeholder="Write the narrative for this section..."
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={handleSaveEdit}
                              disabled={saveNarrativeMutation.isPending}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              {saveNarrativeMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4 mr-1" />
                              )}
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEdit}
                              className="border-slate-600 text-slate-300 hover:bg-slate-800"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : hasNarrative ? (
                        <div className="mt-4">
                          <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">
                            {narrative}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-4 flex items-start gap-3 text-slate-500">
                          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm">
                              No narrative generated for this section yet.
                            </p>
                            <p className="text-xs mt-1">
                              Click the{" "}
                              <Sparkles className="h-3 w-3 inline" /> button to
                              generate one from available insights, or run
                              full consolidation.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
