import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronUp,
  ChevronDown,
  Download,
  Edit3,
  FileText,
  GripVertical,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  X,
  Sparkles,
  BookOpen,
  PenTool,
  Printer,
  AlertCircle,
  MessageSquare,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReportSection {
  id: string;
  title: string;
  order: number;
  wordTarget: number;
  prompt: string;
}

interface ReportMetadata {
  clientName: string;
  preparedBy: string;
  reviewedBy: string;
  approvedBy: string;
  projectNumber: string;
  revisionNumber: string;
  documentType: string;
}

type WorkflowStep = "structure" | "content" | "generate";

// ─── Step Indicator ─────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: WorkflowStep }) {
  const steps = [
    { key: "structure" as const, label: "Structure", icon: BookOpen, description: "Define Table of Contents" },
    { key: "content" as const, label: "Content", icon: PenTool, description: "Review & Edit Content" },
    { key: "generate" as const, label: "Generate", icon: Printer, description: "Generate DOCX" },
  ];

  const stepIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center justify-center gap-2 py-6">
      {steps.map((step, i) => {
        const isActive = step.key === currentStep;
        const isCompleted = i < stepIndex;
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex items-center">
            {i > 0 && (
              <div
                className={`w-12 h-0.5 mx-2 transition-colors ${
                  isCompleted ? "bg-orange-500" : "bg-slate-700"
                }`}
              />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isActive
                    ? "bg-orange-500 text-white ring-2 ring-orange-500/30"
                    : isCompleted
                    ? "bg-orange-500/20 text-orange-400 border border-orange-500/40"
                    : "bg-slate-800 text-slate-500 border border-slate-700"
                }`}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <span
                className={`text-xs font-medium ${
                  isActive ? "text-orange-400" : isCompleted ? "text-slate-400" : "text-slate-600"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Structure Editor ───────────────────────────────────────────────

function StructureEditor({
  sections,
  onSectionsChange,
  dataSummary,
  projectType,
  onNext,
  isSaving,
}: {
  sections: ReportSection[];
  onSectionsChange: (sections: ReportSection[]) => void;
  dataSummary: string;
  projectType: string;
  onNext: () => void;
  isSaving: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editWordTarget, setEditWordTarget] = useState(0);
  const [editPrompt, setEditPrompt] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newWordTarget, setNewWordTarget] = useState(500);
  const [newPrompt, setNewPrompt] = useState("");

  const sorted = useMemo(() => [...sections].sort((a, b) => a.order - b.order), [sections]);

  const moveSection = (id: string, direction: "up" | "down") => {
    const idx = sorted.findIndex((s) => s.id === id);
    if (direction === "up" && idx <= 0) return;
    if (direction === "down" && idx >= sorted.length - 1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const newSections = [...sorted];
    const tempOrder = newSections[idx].order;
    newSections[idx] = { ...newSections[idx], order: newSections[swapIdx].order };
    newSections[swapIdx] = { ...newSections[swapIdx], order: tempOrder };
    onSectionsChange(newSections);
  };

  const removeSection = (id: string) => {
    onSectionsChange(sections.filter((s) => s.id !== id));
  };

  const startEdit = (section: ReportSection) => {
    setEditingId(section.id);
    setEditTitle(section.title);
    setEditWordTarget(section.wordTarget);
    setEditPrompt(section.prompt);
  };

  const saveEdit = () => {
    if (!editingId) return;
    onSectionsChange(
      sections.map((s) =>
        s.id === editingId
          ? { ...s, title: editTitle, wordTarget: editWordTarget, prompt: editPrompt }
          : s
      )
    );
    setEditingId(null);
  };

  const addSection = () => {
    if (!newTitle.trim()) return;
    const maxOrder = Math.max(...sections.map((s) => s.order), 0);
    const newId = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    onSectionsChange([
      ...sections,
      {
        id: newId,
        title: newTitle.trim(),
        order: maxOrder + 1,
        wordTarget: newWordTarget,
        prompt: newPrompt || `Write the ${newTitle.trim()} section.`,
      },
    ]);
    setNewTitle("");
    setNewWordTarget(500);
    setNewPrompt("");
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Data Summary */}
      <Card className="bg-slate-800/50 border-slate-700 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-orange-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-slate-200">
              AI-Proposed Structure
              {projectType !== "default" && (
                <Badge className="ml-2 bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
                  {projectType.toUpperCase()} Project
                </Badge>
              )}
            </p>
            <p className="text-xs text-slate-400 mt-1">{dataSummary}</p>
            <p className="text-xs text-slate-500 mt-2">
              Review the proposed Table of Contents below. You can rename, reorder, add, or remove sections before proceeding.
            </p>
          </div>
        </div>
      </Card>

      {/* Sections List */}
      <div className="space-y-2">
        {sorted.map((section, idx) => (
          <Card
            key={section.id}
            className={`border transition-all ${
              editingId === section.id
                ? "bg-slate-800 border-orange-500/40"
                : "bg-slate-900/50 border-slate-700/50 hover:border-slate-600"
            }`}
          >
            {editingId === section.id ? (
              /* Edit Mode */
              <div className="p-4 space-y-3">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-slate-400 mb-1 block">Section Title</label>
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="bg-slate-900 border-slate-600 text-slate-200"
                    />
                  </div>
                  <div className="w-32">
                    <label className="text-xs text-slate-400 mb-1 block">Word Target</label>
                    <Input
                      type="number"
                      value={editWordTarget}
                      onChange={(e) => setEditWordTarget(parseInt(e.target.value) || 0)}
                      className="bg-slate-900 border-slate-600 text-slate-200"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">AI Prompt Guidance</label>
                  <Textarea
                    value={editPrompt}
                    onChange={(e) => setEditPrompt(e.target.value)}
                    rows={2}
                    className="bg-slate-900 border-slate-600 text-slate-200 text-sm"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={saveEdit} className="bg-orange-600 hover:bg-orange-700 text-white">
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              /* View Mode */
              <div className="p-3 flex items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveSection(section.id, "up")}
                    disabled={idx === 0}
                    className="text-slate-500 hover:text-slate-300 disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => moveSection(section.id, "down")}
                    disabled={idx === sorted.length - 1}
                    className="text-slate-500 hover:text-slate-300 disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="text-xs text-slate-600 font-mono w-6 text-center">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{section.title}</p>
                  <p className="text-xs text-slate-500 truncate">{section.prompt}</p>
                </div>
                <Badge variant="outline" className="text-xs text-slate-400 border-slate-600 shrink-0">
                  ~{section.wordTarget} words
                </Badge>
                <button
                  onClick={() => startEdit(section)}
                  className="text-slate-500 hover:text-orange-400 transition-colors p-1"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => removeSection(section.id)}
                  className="text-slate-500 hover:text-red-400 transition-colors p-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* Add Section */}
      {showAddForm ? (
        <Card className="bg-slate-800 border-slate-600 p-4 space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-slate-400 mb-1 block">New Section Title</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Environmental Impact Assessment"
                className="bg-slate-900 border-slate-600 text-slate-200"
                autoFocus
              />
            </div>
            <div className="w-32">
              <label className="text-xs text-slate-400 mb-1 block">Word Target</label>
              <Input
                type="number"
                value={newWordTarget}
                onChange={(e) => setNewWordTarget(parseInt(e.target.value) || 500)}
                className="bg-slate-900 border-slate-600 text-slate-200"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">AI Prompt Guidance (optional)</label>
            <Textarea
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              rows={2}
              placeholder="Describe what this section should cover..."
              className="bg-slate-900 border-slate-600 text-slate-200 text-sm"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={addSection}
              disabled={!newTitle.trim()}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Section
            </Button>
          </div>
        </Card>
      ) : (
        <Button
          variant="outline"
          onClick={() => setShowAddForm(true)}
          className="w-full border-dashed border-slate-600 text-slate-400 hover:text-orange-400 hover:border-orange-500/40"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Section
        </Button>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <div className="text-sm text-slate-500">
          {sections.length} sections | ~{sections.reduce((sum, s) => sum + s.wordTarget, 0).toLocaleString()} words total
        </div>
        <Button
          onClick={onNext}
          disabled={sections.length === 0 || isSaving}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <ArrowRight className="h-4 w-4 mr-2" />
          )}
          {isSaving ? "Saving..." : "Continue to Content"}
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2: Content Editor ─────────────────────────────────────────────────

function ContentEditor({
  draftId,
  projectId,
  sections,
  content,
  metadata,
  onContentChange,
  onMetadataChange,
  onBack,
  onNext,
}: {
  draftId: number;
  projectId: number;
  sections: ReportSection[];
  content: Record<string, string>;
  metadata: ReportMetadata;
  onContentChange: (content: Record<string, string>) => void;
  onMetadataChange: (metadata: ReportMetadata) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<Record<string, string>>({});
  const [generatingSection, setGeneratingSection] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState<Record<string, string>>({});
  const [showRefineInput, setShowRefineInput] = useState<Record<string, boolean>>({});
  const [refiningSection, setRefiningSection] = useState<string | null>(null);

  const generateSection = trpc.report.generateSection.useMutation();
  const generateAllSections = trpc.report.generateAllSections.useMutation();
  const updateSectionContent = trpc.report.updateSectionContent.useMutation();
  const updateMetadata = trpc.report.updateMetadata.useMutation();
  const refineSection = trpc.report.refineSection.useMutation();

  // Polling for content generation progress
  const contentProgress = trpc.report.getContentProgress.useQuery(
    { draftId },
    { enabled: generatingAll, refetchInterval: generatingAll ? 3000 : false }
  );

  const handleRefineSection = async (section: ReportSection) => {
    const instruction = refineInstruction[section.id];
    if (!instruction?.trim()) {
      toast.error("Please enter an instruction for the AI");
      return;
    }
    setRefiningSection(section.id);
    try {
      const result = await refineSection.mutateAsync({
        draftId,
        projectId,
        sectionId: section.id,
        sectionTitle: section.title,
        currentContent: content[section.id] || "",
        instruction: instruction.trim(),
        wordTarget: section.wordTarget,
      });
      onContentChange({ ...content, [result.sectionId]: result.content });
      setRefineInstruction((prev) => ({ ...prev, [section.id]: "" }));
      setShowRefineInput((prev) => ({ ...prev, [section.id]: false }));
      toast.success(`Refined: ${section.title}`);
    } catch (err: any) {
      toast.error(`Failed to refine ${section.title}`, { description: err.message });
    } finally {
      setRefiningSection(null);
    }
  };

  const sorted = useMemo(() => [...sections].sort((a, b) => a.order - b.order), [sections]);

  const sectionsWithContent = sorted.filter((s) => content[s.id] && content[s.id].length > 0);
  const progressPercent = sections.length > 0 ? Math.round((sectionsWithContent.length / sections.length) * 100) : 0;

  const handleGenerateSection = async (section: ReportSection) => {
    setGeneratingSection(section.id);
    try {
      const result = await generateSection.mutateAsync({
        draftId,
        projectId,
        section,
      });
      onContentChange({ ...content, [result.sectionId]: result.content });
      toast.success(`Generated: ${section.title}`);
    } catch (err: any) {
      toast.error(`Failed to generate ${section.title}`, { description: err.message });
    } finally {
      setGeneratingSection(null);
    }
  };

  // Watch polling results to update content and detect completion
  useEffect(() => {
    if (!generatingAll || !contentProgress.data) return;
    const progress = contentProgress.data;
    
    // Update content as sections complete
    if (progress.content && Object.keys(progress.content).length > 0) {
      onContentChange(progress.content);
    }
    
    if (progress.isComplete) {
      setGeneratingAll(false);
      toast.success(`Generated ${progress.completedSections} sections`);
    } else if (progress.isFailed) {
      setGeneratingAll(false);
      toast.error("Content generation failed. You can retry or generate sections individually.");
    }
  }, [contentProgress.data]);

  const handleGenerateAll = async () => {
    setGeneratingAll(true);
    try {
      await generateAllSections.mutateAsync({ draftId, projectId });
    } catch (err: any) {
      setGeneratingAll(false);
      toast.error("Failed to start content generation", { description: err.message });
    }
  };

  const handleSaveContent = async (sectionId: string) => {
    const text = editingContent[sectionId];
    if (text === undefined) return;
    try {
      await updateSectionContent.mutateAsync({ draftId, sectionId, content: text });
      onContentChange({ ...content, [sectionId]: text });
      setEditingContent((prev) => {
        const next = { ...prev };
        delete next[sectionId];
        return next;
      });
      toast.success("Section saved");
    } catch (err: any) {
      toast.error("Failed to save", { description: err.message });
    }
  };

  const handleSaveMetadata = async () => {
    try {
      await updateMetadata.mutateAsync({ draftId, metadata });
      toast.success("Report details saved");
    } catch (err: any) {
      toast.error("Failed to save details", { description: err.message });
    }
  };

  const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-6">
      {/* Metadata Fields */}
      <Card className="bg-slate-800/50 border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4 text-orange-400" />
          Report Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Client Name</label>
            <Input
              value={metadata.clientName}
              onChange={(e) => onMetadataChange({ ...metadata, clientName: e.target.value })}
              placeholder="Enter client name"
              className="bg-slate-900 border-slate-600 text-slate-200"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Document Type</label>
            <Input
              value={metadata.documentType}
              onChange={(e) => onMetadataChange({ ...metadata, documentType: e.target.value })}
              className="bg-slate-900 border-slate-600 text-slate-200"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Prepared By</label>
            <Input
              value={metadata.preparedBy}
              onChange={(e) => onMetadataChange({ ...metadata, preparedBy: e.target.value })}
              className="bg-slate-900 border-slate-600 text-slate-200"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Reviewed By</label>
            <Input
              value={metadata.reviewedBy}
              onChange={(e) => onMetadataChange({ ...metadata, reviewedBy: e.target.value })}
              className="bg-slate-900 border-slate-600 text-slate-200"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Approved By</label>
            <Input
              value={metadata.approvedBy}
              onChange={(e) => onMetadataChange({ ...metadata, approvedBy: e.target.value })}
              className="bg-slate-900 border-slate-600 text-slate-200"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Project Number</label>
            <Input
              value={metadata.projectNumber}
              onChange={(e) => onMetadataChange({ ...metadata, projectNumber: e.target.value })}
              className="bg-slate-900 border-slate-600 text-slate-200"
            />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button
            size="sm"
            onClick={handleSaveMetadata}
            disabled={updateMetadata.isPending}
            className="bg-slate-700 hover:bg-slate-600 text-slate-200"
          >
            {updateMetadata.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
            Save Details
          </Button>
        </div>
      </Card>

      {/* Content Generation Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-200">Section Content</h3>
          <Badge className={`text-xs ${progressPercent === 100 ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-slate-700 text-slate-400 border-slate-600"}`}>
            {sectionsWithContent.length}/{sections.length} generated
          </Badge>
        </div>
        <Button
          onClick={handleGenerateAll}
          disabled={generatingAll || generatingSection !== null}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          {generatingAll ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          {generatingAll ? "Generating All..." : "Generate All Sections"}
        </Button>
      </div>

      {generatingAll && (
        <div className="space-y-2">
          <Progress 
            value={contentProgress.data ? Math.round((contentProgress.data.completedSections / Math.max(contentProgress.data.totalSections, 1)) * 100) : 0} 
            className="h-2" 
          />
          <p className="text-xs text-slate-400 text-center">
            {contentProgress.data?.currentSection 
              ? `Generating: ${contentProgress.data.currentSection} (${contentProgress.data.completedSections}/${contentProgress.data.totalSections} complete)`
              : "Starting content generation... This may take a few minutes."}
          </p>
        </div>
      )}

      {/* Sections Content List */}
      <div className="space-y-2">
        {sorted.map((section) => {
          const hasContent = content[section.id] && content[section.id].length > 0;
          const isExpanded = expandedSection === section.id;
          const isEditing = editingContent[section.id] !== undefined;
          const isGenerating = generatingSection === section.id;
          const displayContent = isEditing ? editingContent[section.id] : (content[section.id] || "");
          const wc = hasContent ? wordCount(content[section.id]) : 0;

          return (
            <Card
              key={section.id}
              className={`border transition-all ${
                isExpanded ? "bg-slate-800/80 border-slate-600" : "bg-slate-900/50 border-slate-700/50"
              }`}
            >
              {/* Section Header */}
              <button
                onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                className="w-full p-3 flex items-center gap-3 text-left"
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    hasContent
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-slate-800 text-slate-500 border border-slate-700"
                  }`}
                >
                  {hasContent ? <Check className="h-3 w-3" /> : section.order}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200">{section.title}</p>
                  {hasContent && (
                    <p className="text-xs text-slate-500">{wc} words (target: {section.wordTarget})</p>
                  )}
                </div>
                {isGenerating && <Loader2 className="h-4 w-4 text-orange-400 animate-spin shrink-0" />}
                <ChevronDown
                  className={`h-4 w-4 text-slate-500 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                />
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3">
                  <Separator className="bg-slate-700" />

                  {!hasContent && !isGenerating ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-slate-500 mb-3">No content generated yet</p>
                      <Button
                        onClick={() => handleGenerateSection(section)}
                        disabled={generatingAll}
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Content
                      </Button>
                    </div>
                  ) : isGenerating ? (
                    <div className="text-center py-6">
                      <Loader2 className="h-8 w-8 text-orange-400 animate-spin mx-auto mb-3" />
                      <p className="text-sm text-slate-400">Generating content for {section.title}...</p>
                    </div>
                  ) : (
                    <>
                      {isEditing ? (
                        <Textarea
                          value={displayContent}
                          onChange={(e) =>
                            setEditingContent((prev) => ({ ...prev, [section.id]: e.target.value }))
                          }
                          rows={12}
                          className="bg-slate-900 border-slate-600 text-slate-200 text-sm leading-relaxed font-sans"
                        />
                      ) : (
                        <div className="bg-slate-900/50 rounded-md p-4 max-h-80 overflow-y-auto">
                          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {displayContent}
                          </p>
                        </div>
                      )}

                      <div className="flex gap-2 justify-end">
                        {isEditing ? (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setEditingContent((prev) => {
                                  const next = { ...prev };
                                  delete next[section.id];
                                  return next;
                                })
                              }
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleSaveContent(section.id)}
                              disabled={updateSectionContent.isPending}
                              className="bg-orange-600 hover:bg-orange-700 text-white"
                            >
                              <Save className="h-3 w-3 mr-1" />
                              Save Changes
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setEditingContent((prev) => ({
                                  ...prev,
                                  [section.id]: content[section.id] || "",
                                }))
                              }
                              className="text-slate-400"
                            >
                              <Edit3 className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setShowRefineInput((prev) => ({
                                  ...prev,
                                  [section.id]: !prev[section.id],
                                }))
                              }
                              disabled={refiningSection === section.id}
                              className="text-purple-400 hover:text-purple-300"
                            >
                              <Wand2 className="h-3 w-3 mr-1" />
                              Refine with AI
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleGenerateSection(section)}
                              disabled={generatingAll}
                              className="text-slate-400"
                            >
                              <RefreshCw className="h-3 w-3 mr-1" />
                              Regenerate
                            </Button>
                          </>
                        )}
                      </div>

                      {/* AI Refine Input Panel */}
                      {showRefineInput[section.id] && (
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 space-y-2">
                          <div className="flex items-center gap-2 mb-1">
                            <Wand2 className="h-3.5 w-3.5 text-purple-400" />
                            <span className="text-xs font-medium text-purple-300">Refine with AI</span>
                          </div>
                          <p className="text-xs text-slate-500">
                            Describe how you'd like this section changed. E.g., "make it more concise", "add more detail about grid risks", "focus on financial implications".
                          </p>
                          <div className="flex gap-2">
                            <Input
                              value={refineInstruction[section.id] || ""}
                              onChange={(e) =>
                                setRefineInstruction((prev) => ({
                                  ...prev,
                                  [section.id]: e.target.value,
                                }))
                              }
                              placeholder="e.g., Make this more concise and focus on key risks..."
                              className="bg-slate-900 border-purple-500/30 text-slate-200 text-sm placeholder:text-slate-600"
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleRefineSection(section);
                                }
                              }}
                              disabled={refiningSection === section.id}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleRefineSection(section)}
                              disabled={refiningSection === section.id || !refineInstruction[section.id]?.trim()}
                              className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
                            >
                              {refiningSection === section.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Sparkles className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                          {refiningSection === section.id && (
                            <p className="text-xs text-purple-400 animate-pulse">
                              AI is refining this section...
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} className="text-slate-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Structure
        </Button>
        <Button
          onClick={onNext}
          disabled={sectionsWithContent.length === 0}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          <ArrowRight className="h-4 w-4 mr-2" />
          Continue to Generate
        </Button>
      </div>
    </div>
  );
}

// ─── Step 3: Generate Final Report ──────────────────────────────────────────

function GenerateStep({
  draftId,
  projectId,
  projectName,
  sections,
  content,
  metadata,
  onBack,
}: {
  draftId: number;
  projectId: number;
  projectName: string;
  sections: ReportSection[];
  content: Record<string, string>;
  metadata: ReportMetadata;
  onBack: () => void;
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<{ fileUrl: string; filename: string; fileSizeBytes: number } | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const generateFinal = trpc.report.generateFinalReport.useMutation();
  const retryGen = trpc.report.retryGeneration.useMutation();

  // Poll for completion when generating
  const { data: genStatus } = trpc.report.getGenerationStatus.useQuery(
    { draftId },
    { enabled: isGenerating, refetchInterval: isGenerating ? 3000 : false }
  );

  // Check poll results
  useEffect(() => {
    if (!isGenerating || !genStatus) return;
    if (genStatus.generation_status === 'completed' && genStatus.generated_filename) {
      setIsGenerating(false);
      setResult({
        fileUrl: `/api/reports/download-by-draft/${draftId}`,
        filename: genStatus.generated_filename,
        fileSizeBytes: genStatus.generated_file_size_bytes || 0,
      });
      toast.success("Report generated successfully!");
    } else if (genStatus.generation_status === 'failed') {
      setIsGenerating(false);
      setGenError(genStatus.generation_error || 'Report generation failed on the server. You can retry.');
      toast.error("Report generation failed");
    }
  }, [genStatus, isGenerating, draftId]);

  const sorted = useMemo(() => [...sections].sort((a, b) => a.order - b.order), [sections]);
  const totalWords = sorted.reduce((sum, s) => sum + (content[s.id] || "").split(/\s+/).filter(Boolean).length, 0);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenError(null);
    try {
      await generateFinal.mutateAsync({ draftId, projectId, projectName });
      // Don't set result here - we poll via getDraft
    } catch (err: any) {
      setIsGenerating(false);
      toast.error("Failed to start report generation", { description: err.message });
    }
  };

  const handleRetry = async () => {
    setGenError(null);
    await retryGen.mutateAsync({ draftId });
    handleGenerate();
  };

  const handleDownload = () => {
    if (!result) return;
    window.open(result.fileUrl, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card className="bg-slate-800/50 border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-4">Report Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-orange-400">{sections.length}</p>
            <p className="text-xs text-slate-500">Sections</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-400">{totalWords.toLocaleString()}</p>
            <p className="text-xs text-slate-500">Total Words</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-400">{metadata.clientName || "—"}</p>
            <p className="text-xs text-slate-500">Client</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-400">{metadata.preparedBy || "—"}</p>
            <p className="text-xs text-slate-500">Prepared By</p>
          </div>
        </div>
      </Card>

      {/* Section Preview */}
      <Card className="bg-slate-900/50 border-slate-700 p-5">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Content Preview</h3>
        <div className="space-y-2">
          {sorted.map((section) => {
            const wc = (content[section.id] || "").split(/\s+/).filter(Boolean).length;
            const hasContent = wc > 0;
            return (
              <div key={section.id} className="flex items-center gap-3 py-1.5">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    hasContent
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {hasContent ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                </div>
                <span className="text-sm text-slate-300 flex-1">{section.title}</span>
                <span className="text-xs text-slate-500">{wc} words</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Generate / Download / Error */}
      {result ? (
        <Card className="bg-green-500/10 border-green-500/30 p-6 text-center">
          <Check className="h-12 w-12 text-green-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-green-300 mb-1">Report Generated Successfully</h3>
          <p className="text-sm text-slate-400 mb-4">
            {result.filename} ({result.fileSizeBytes > 0 ? `${(result.fileSizeBytes / 1024).toFixed(0)} KB` : 'Ready'})
          </p>
          <Button onClick={handleDownload} className="bg-green-600 hover:bg-green-700 text-white">
            <Download className="h-4 w-4 mr-2" />
            Download Report
          </Button>
        </Card>
      ) : genError ? (
        <Card className="bg-red-500/10 border-red-500/30 p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-red-300 mb-1">Generation Failed</h3>
          <p className="text-sm text-slate-400 mb-4">{genError}</p>
          <Button onClick={handleRetry} className="bg-orange-600 hover:bg-orange-700 text-white">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Generation
          </Button>
        </Card>
      ) : (
        <div className="text-center py-6">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            size="lg"
            className="bg-orange-600 hover:bg-orange-700 text-white px-8"
          >
            {isGenerating ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Printer className="h-5 w-5 mr-2" />
            )}
            {isGenerating ? "Generating DOCX..." : "Generate Final Report"}
          </Button>
          {isGenerating && (
            <div className="mt-4 space-y-2">
              <Progress value={undefined} className="w-64 mx-auto h-1" />
              <p className="text-xs text-slate-500">
                Building Word document and uploading... This may take 10-30 seconds.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="ghost" onClick={onBack} className="text-slate-400">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Content
        </Button>
        {result && (
          <Button
            variant="ghost"
            onClick={handleDownload}
            className="text-slate-400"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Again
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main Report Builder ────────────────────────────────────────────────────

export default function ReportBuilder() {
  const [, navigate] = useLocation();
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId ? parseInt(params.projectId, 10) : null;
  const { user } = useAuth();

  const [draftId, setDraftId] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("structure");
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [content, setContent] = useState<Record<string, string>>({});
  const [metadata, setMetadata] = useState<ReportMetadata>({
    clientName: "",
    preparedBy: "",
    reviewedBy: "",
    approvedBy: "",
    projectNumber: "",
    revisionNumber: "Rev 00",
    documentType: "Technical Due Diligence Report",
  });
  const [dataSummary, setDataSummary] = useState("");
  const [projectType, setProjectType] = useState("default");
  const [isInitializing, setIsInitializing] = useState(true);
  const [metadataAutoPopulated, setMetadataAutoPopulated] = useState(false);

  // Fetch project details
  const { data: project } = trpc.projects.get.useQuery(
    { id: Number(projectId) },
    { enabled: !!projectId }
  );

  // Check for existing drafts
  const { data: existingDrafts } = trpc.report.listDrafts.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  // Create draft mutation
  const createDraft = trpc.report.createDraft.useMutation();
  const updateStructure = trpc.report.updateStructure.useMutation();

  // Load existing draft or create new one
  useEffect(() => {
    if (!projectId || !project || !existingDrafts) return;
    if (draftId) return; // Already loaded

    const activeDraft = existingDrafts.find(
      (d: any) => d.step !== "completed" && d.report_type === "dd_report"
    );

    if (activeDraft) {
      // Resume existing draft
      setDraftId(activeDraft.id);
      // Need to fetch full draft data
      loadDraft(activeDraft.id);
    } else {
      // Create new draft
      initNewDraft();
    }
  }, [projectId, project, existingDrafts, draftId]);

  const getDraft = trpc.report.getDraft.useQuery(
    { draftId: draftId! },
    { enabled: !!draftId && isInitializing }
  );

  useEffect(() => {
    if (getDraft.data && isInitializing) {
      const draft = getDraft.data;
      setSections(draft.sections || []);
      setContent(draft.content || {});
      setMetadata(draft.metadata || metadata);
      // Map draft step to workflow step
      let mappedStep: WorkflowStep = "structure";
      if (draft.step === "completed" || draft.step === "generating") {
        mappedStep = "generate";
      } else if (draft.step === "content" || draft.step === "generating_content" || draft.step === "content_failed") {
        mappedStep = "content";
      } else if (draft.step === "structure") {
        mappedStep = "structure";
      }
      setCurrentStep(mappedStep);
      setIsInitializing(false);
    }
  }, [getDraft.data, isInitializing]);

  // Auto-populate metadata from project data and logged-in user (only once, for new drafts)
  useEffect(() => {
    if (!project || metadataAutoPopulated) return;
    const p = project as any;
    const projectName = p.projectName || p.name || "";
    const projectCode = p.projectCode || "";
    const userName = user?.name || "";
    setMetadata(prev => ({
      ...prev,
      clientName: prev.clientName || projectName,
      projectNumber: prev.projectNumber || projectCode,
      preparedBy: prev.preparedBy || userName,
      documentType: prev.documentType || "Technical Due Diligence Report",
    }));
    setMetadataAutoPopulated(true);
  }, [project, user, metadataAutoPopulated]);

  const loadDraft = async (id: number) => {
    setDraftId(id);
    // The getDraft query will fire automatically
  };

  const initNewDraft = async () => {
    if (!projectId || !project) return;
    try {
      const projectName = (project as any).projectName || (project as any).name || `Project ${projectId}`;
      const result = await createDraft.mutateAsync({
        projectId,
        projectName,
        reportType: "dd_report",
      });
      setDraftId(result.draftId);
      setSections(result.sections);
      setDataSummary(result.dataSummary);
      setProjectType(result.projectType);
      setMetadata(result.metadata);
      setIsInitializing(false);
    } catch (err: any) {
      toast.error("Failed to initialize report builder", { description: err.message });
      setIsInitializing(false);
    }
  };

  const handleStructureNext = async () => {
    if (!draftId) return;
    try {
      await updateStructure.mutateAsync({ draftId, sections });
      setCurrentStep("content");
    } catch (err: any) {
      toast.error("Failed to save structure", { description: err.message });
    }
  };

  const projectName = (project as any)?.projectName || (project as any)?.name || `Project ${projectId}`;

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
              <h1 className="text-sm font-semibold text-slate-200">Report Builder</h1>
              <p className="text-xs text-slate-500">{projectName}</p>
            </div>
          </div>
          {draftId && (
            <Badge variant="outline" className="text-xs text-slate-500 border-slate-700">
              Draft #{draftId}
            </Badge>
          )}
        </div>
      </header>

      {/* Step Indicator */}
      <StepIndicator currentStep={currentStep} />

      {/* Main Content */}
      <div className="container mx-auto px-6 pb-12 max-w-4xl">
        {isInitializing || createDraft.isPending ? (
          <div className="text-center py-20">
            <Loader2 className="h-10 w-10 text-orange-400 animate-spin mx-auto mb-4" />
            <p className="text-slate-400">
              {createDraft.isPending
                ? "Analyzing project data and proposing report structure..."
                : "Loading report builder..."}
            </p>
          </div>
        ) : currentStep === "structure" ? (
          <StructureEditor
            sections={sections}
            onSectionsChange={setSections}
            dataSummary={dataSummary}
            projectType={projectType}
            onNext={handleStructureNext}
            isSaving={updateStructure.isPending}
          />
        ) : currentStep === "content" ? (
          <ContentEditor
            draftId={draftId!}
            projectId={projectId}
            sections={sections}
            content={content}
            metadata={metadata}
            onContentChange={setContent}
            onMetadataChange={setMetadata}
            onBack={() => setCurrentStep("structure")}
            onNext={() => setCurrentStep("generate")}
          />
        ) : (
          <GenerateStep
            draftId={draftId!}
            projectId={projectId}
            projectName={projectName}
            sections={sections}
            content={content}
            metadata={metadata}
            onBack={() => setCurrentStep("content")}
          />
        )}
      </div>
    </div>
  );
}
