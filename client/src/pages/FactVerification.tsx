import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Edit, FileText, TrendingUp, AlertTriangle, ChevronDown, ChevronRight, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { normalizeSection, getSectionDisplayName, getSectionDescription, getCanonicalSections, getSectionPresentationMode } from "../../../shared/section-normalizer";

interface Fact {
  id: number;
  category: string;
  key: string;
  value: string;
  confidence: string;
  source_document_id: string;
  source_documents?: string[];  // Array of document IDs
  source_location: string | null;
  extraction_method: string;
  verification_status: string;
  enrichment_count?: number;
  conflict_with?: string | null;
  last_enriched_at?: string | null;
  created_at: string;
}

interface FactSection {
  name: string;
  displayName: string;
  description: string;
  presentationMode: 'narrative' | 'itemized';
  narrative?: string;
  facts: Fact[];
  totalFacts: number;
  pendingFacts: number;
  approvedFacts: number;
  avgConfidence: number;
}

export default function FactVerification() {
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const projectIdStr = searchParams.get("projectId");
  const projectId = projectIdStr ? parseInt(projectIdStr, 10) : null;

  const [selectedFact, setSelectedFact] = useState<Fact | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editedValue, setEditedValue] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [narratives, setNarratives] = useState<Record<string, string>>({});
  const [showIndividualInsights, setShowIndividualInsights] = useState<Set<string>>(new Set());
  const [consolidationProgress, setConsolidationProgress] = useState<{
    isOpen: boolean;
    stage: string;
    message: string;
    progress: number;
  }>({ isOpen: false, stage: '', message: '', progress: 0 });

  // Fetch project details to get dbName
  const { data: project, isLoading: isLoadingProject } = trpc.projects.get.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  // Fetch facts using dbName from project
  const { data: facts, isLoading: isLoadingFacts, refetch } = trpc.facts.list.useQuery(
    { projectId: project?.dbName || "" },
    { enabled: !!project?.dbName }
  );

  // Fetch pre-generated narratives
  const { data: preGeneratedNarratives } = trpc.facts.getNarratives.useQuery(
    { projectId: project?.dbName || "" },
    { enabled: !!project?.dbName }
  );

  // Update narratives state when pre-generated narratives load
  useEffect(() => {
    if (preGeneratedNarratives) {
      setNarratives(preGeneratedNarratives);
    }
  }, [preGeneratedNarratives]);

  const isLoading = isLoadingProject || isLoadingFacts;

  const consolidateMutation = trpc.projects.consolidate.useMutation({
    onMutate: () => {
      // Open progress modal when consolidation starts
      setConsolidationProgress({
        isOpen: true,
        stage: 'starting',
        message: 'Initializing consolidation...',
        progress: 0
      });
      
      // Simulate progress updates (since we can't stream from tRPC mutation)
      const stages = [
        { stage: 'reconciling', message: 'Reconciling insights from multiple documents...', progress: 15 },
        { stage: 'narratives', message: 'Generating section narratives...', progress: 40 },
        { stage: 'performance', message: 'Extracting performance parameters...', progress: 60 },
        { stage: 'financial', message: 'Extracting financial data...', progress: 75 },
        { stage: 'weather', message: 'Processing weather files...', progress: 90 },
      ];
      
      let i = 0;
      const interval = setInterval(() => {
        if (i < stages.length) {
          setConsolidationProgress(prev => ({
            ...prev,
            ...stages[i]
          }));
          i++;
        } else {
          clearInterval(interval);
        }
      }, 3000);
      
      return { interval };
    },
    onSuccess: (_, __, context) => {
      if (context?.interval) clearInterval(context.interval);
      setConsolidationProgress({
        isOpen: true,
        stage: 'complete',
        message: 'Consolidation complete!',
        progress: 100
      });
      setTimeout(() => {
        setConsolidationProgress(prev => ({ ...prev, isOpen: false }));
        toast.success("Consolidation complete! Narratives and analysis updated.");
        refetch();
      }, 1500);
    },
    onError: (error, _, context) => {
      if (context?.interval) clearInterval(context.interval);
      setConsolidationProgress(prev => ({
        ...prev,
        isOpen: false
      }));
      toast.error(`Consolidation failed: ${error.message}`);
    },
  });

  const updateFactMutation = trpc.facts.update.useMutation({
    onSuccess: () => {
      toast.success("Insight updated successfully");
      refetch();
      setEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to update insight: ${error.message}`);
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

  const handleApprove = (factId: number) => {
    if (!project?.dbName) return;
    updateFactMutation.mutate({
      projectId: project.dbName,
      factId,
      status: "approved",
    });
  };

  const handleReject = (factId: number) => {
    if (!project?.dbName) return;
    updateFactMutation.mutate({
      projectId: project.dbName,
      factId,
      status: "rejected",
    });
  };

  const handleEdit = (fact: Fact) => {
    setSelectedFact(fact);
    setEditedValue(fact.value);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedFact || !project?.dbName) return;
    
    updateFactMutation.mutate({
      projectId: project.dbName,
      factId: selectedFact.id,
      status: "approved",
      value: editedValue,
    });
  };

  const toggleSection = (sectionName: string) => {
    const newExpanded = new Set(expandedSections);
    const isExpanding = !newExpanded.has(sectionName);
    
    if (newExpanded.has(sectionName)) {
      newExpanded.delete(sectionName);
    } else {
      newExpanded.add(sectionName);
    }
    setExpandedSections(newExpanded);
  };

  const expandAll = () => {
    const allSections = new Set(sections.map(s => s.name));
    setExpandedSections(allSections);
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  // Group facts by category (section) with normalization
  const sections: FactSection[] = facts ? Object.entries(
    facts.reduce((acc, fact) => {
      // Normalize section name
      const normalizedSection = normalizeSection(fact.category);
      if (!acc[normalizedSection]) acc[normalizedSection] = [];
      acc[normalizedSection].push(fact);
      return acc;
    }, {} as Record<string, Fact[]>)
  ).map(([canonicalName, sectionFacts]) => {
    const typedFacts = sectionFacts as Fact[];
    return {
      name: canonicalName,
      displayName: getSectionDisplayName(canonicalName),
      description: getSectionDescription(canonicalName),
      presentationMode: getSectionPresentationMode(canonicalName),
      narrative: narratives[canonicalName],
      facts: typedFacts,
      totalFacts: typedFacts.length,
      pendingFacts: typedFacts.filter(f => f.verification_status === "pending").length,
      approvedFacts: typedFacts.filter(f => f.verification_status === "approved").length,
      avgConfidence: typedFacts.reduce((sum: number, f: Fact) => sum + parseFloat(f.confidence || "0"), 0) / typedFacts.length,
    };
  }).sort((a, b) => {
    // Sort by canonical section order
    const order = getCanonicalSections();
    return order.indexOf(a.name) - order.indexOf(b.name);
  }) : [];

  // Filter sections based on search and status
  const filteredSections = sections.map(section => ({
    ...section,
    facts: section.facts.filter(fact => {
      if (filterStatus !== "all" && fact.verification_status !== filterStatus) return false;
      if (searchQuery && !fact.value.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !fact.key.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    }),
  })).filter(section => section.facts.length > 0);

  const stats = {
    total: facts?.length || 0,
    pending: facts?.filter((f) => f.verification_status === "pending").length || 0,
    approved: facts?.filter((f) => f.verification_status === "approved").length || 0,
    rejected: facts?.filter((f) => f.verification_status === "rejected").length || 0,
    avgConfidence: facts?.length
      ? (facts.reduce((sum, f) => sum + parseFloat(f.confidence || "0"), 0) / facts.length * 100).toFixed(0)
      : "0",
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 0.8) return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{(score * 100).toFixed(0)}%</Badge>;
    if (score >= 0.6) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">{(score * 100).toFixed(0)}%</Badge>;
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{(score * 100).toFixed(0)}%</Badge>;
  };

  const getStatusBadge = (status: string) => {
    if (status === "approved") return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Approved</Badge>;
    if (status === "rejected") return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Rejected</Badge>;
    return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">Pending</Badge>;
  };

  const getMethodBadge = (method: string) => {
    if (method === "deterministic") return <Badge variant="outline" className="border-blue-500/30 text-blue-400">Deterministic</Badge>;
    if (method === "llm") return <Badge variant="outline" className="border-purple-500/30 text-purple-400">LLM</Badge>;
    return <Badge variant="outline" className="border-slate-500/30 text-slate-400">{method}</Badge>;
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Consolidation Progress Modal */}
      <Dialog open={consolidationProgress.isOpen} onOpenChange={() => {}}>
        <DialogContent className="bg-slate-900 border-slate-700 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {consolidationProgress.stage === 'complete' ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
              )}
              Processing Project Data
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {consolidationProgress.message}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-500 ease-out"
                style={{ width: `${consolidationProgress.progress}%` }}
              />
            </div>
            <p className="text-sm text-slate-500 mt-2 text-center">
              {consolidationProgress.progress}% complete
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <div className={`flex items-center gap-2 ${consolidationProgress.progress >= 15 ? 'text-green-400' : 'text-slate-500'}`}>
              {consolidationProgress.progress >= 15 ? <CheckCircle2 className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border border-slate-600" />}
              Reconciling insights
            </div>
            <div className={`flex items-center gap-2 ${consolidationProgress.progress >= 40 ? 'text-green-400' : 'text-slate-500'}`}>
              {consolidationProgress.progress >= 40 ? <CheckCircle2 className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border border-slate-600" />}
              Generating narratives
            </div>
            <div className={`flex items-center gap-2 ${consolidationProgress.progress >= 60 ? 'text-green-400' : 'text-slate-500'}`}>
              {consolidationProgress.progress >= 60 ? <CheckCircle2 className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border border-slate-600" />}
              Extracting performance parameters
            </div>
            <div className={`flex items-center gap-2 ${consolidationProgress.progress >= 75 ? 'text-green-400' : 'text-slate-500'}`}>
              {consolidationProgress.progress >= 75 ? <CheckCircle2 className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border border-slate-600" />}
              Extracting financial data
            </div>
            <div className={`flex items-center gap-2 ${consolidationProgress.progress >= 90 ? 'text-green-400' : 'text-slate-500'}`}>
              {consolidationProgress.progress >= 90 ? <CheckCircle2 className="h-4 w-4" /> : <div className="h-4 w-4 rounded-full border border-slate-600" />}
              Processing weather files
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800/50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Project Insights</h1>
              <p className="text-sm text-slate-400 mt-1">Review and approve extracted insights organized by section</p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => navigate(`/project-dashboard?projectId=${projectId}`)}
                variant="outline"
                className="border-slate-700 hover:bg-slate-800"
              >
                Back to Dashboard
              </Button>
              <Button
                onClick={() => {
                  if (!projectId) return;
                  toast.info("Starting consolidation...");
                  consolidateMutation.mutate({ projectId });
                }}
                disabled={consolidateMutation.isPending}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white disabled:opacity-50"
              >
                {consolidateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Loader2 className="h-4 w-4 mr-2" />
                )}
                Process & Consolidate
              </Button>
            </div>
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
                <p className="text-sm text-slate-400">Total Insights</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-yellow-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.pending}</p>
                <p className="text-sm text-slate-400">Pending</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.approved}</p>
                <p className="text-sm text-slate-400">Approved</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.rejected}</p>
                <p className="text-sm text-slate-400">Rejected</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-orange-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.avgConfidence}%</p>
                <p className="text-sm text-slate-400">Avg Confidence</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters and Controls */}
        <Card className="p-4 bg-slate-900/50 border-slate-800 mb-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm text-slate-400 mb-2 block">Search Insights</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in fact statements..."
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="w-48">
              <label className="text-sm text-slate-400 mb-2 block">Status</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={expandAll}
                variant="outline"
                size="sm"
                className="border-slate-700 hover:bg-slate-800"
              >
                Expand All
              </Button>
              <Button
                onClick={collapseAll}
                variant="outline"
                size="sm"
                className="border-slate-700 hover:bg-slate-800"
              >
                Collapse All
              </Button>
            </div>
          </div>
        </Card>

        {/* Sections */}
        {isLoading ? (
          <Card className="p-8 bg-slate-900/50 border-slate-800 text-center">
            <p className="text-slate-400">Loading insights...</p>
          </Card>
        ) : filteredSections.length === 0 ? (
          <Card className="p-8 bg-slate-900/50 border-slate-800 text-center">
            <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
            <p className="text-slate-400">No insights found matching your filters</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredSections.map((section) => (
              <Card key={section.name} className="bg-slate-900/50 border-slate-800 overflow-hidden">
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.name)}
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {expandedSections.has(section.name) ? (
                      <ChevronDown className="h-5 w-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    )}
                    <div>
                      <h3 className="text-lg font-semibold text-white">{section.displayName}</h3>
                      {section.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{section.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-slate-400">
                      {section.facts.length} insights
                    </div>
                    <div className="text-sm text-slate-400">
                      {section.pendingFacts} pending
                    </div>
                    <div className="text-sm text-orange-400">
                      {(section.avgConfidence * 100).toFixed(0)}% avg confidence
                    </div>
                  </div>
                </button>

                {/* Section Content */}
                {expandedSections.has(section.name) && (
                  <div className="border-t border-slate-800">
                    {/* Narrative Mode - Show narrative if exists, otherwise show raw facts */}
                    {section.presentationMode === 'narrative' ? (
                      narratives[section.name] ? (
                        <div className="p-6 space-y-4">
                          <div className="prose prose-invert max-w-none">
                            <p className="text-slate-200 text-base leading-relaxed whitespace-pre-wrap">
                              {narratives[section.name]}
                            </p>
                          </div>
                          <div className="pt-4 border-t border-slate-800/50">
                            <button
                              onClick={() => {
                                const newShowIndividual = new Set(showIndividualInsights);
                                if (newShowIndividual.has(section.name)) {
                                  newShowIndividual.delete(section.name);
                                } else {
                                  newShowIndividual.add(section.name);
                                }
                                setShowIndividualInsights(newShowIndividual);
                              }}
                              className="text-sm text-orange-400 hover:text-orange-300 transition-colors flex items-center gap-2"
                            >
                              {showIndividualInsights.has(section.name) ? (
                                <>
                                  <ChevronDown className="h-4 w-4" />
                                  Hide {section.facts.length} individual insights
                                </>
                              ) : (
                                <>
                                  <ChevronRight className="h-4 w-4" />
                                  View {section.facts.length} individual insights
                                </>
                              )}
                            </button>
                          </div>
                          {/* Show individual insights if toggled */}
                          {showIndividualInsights.has(section.name) && (
                            <div className="border-t border-slate-800/50 mt-4">
                              {section.facts.map((fact, idx) => (
                                <div
                                  key={fact.id}
                                  className={`p-4 ${idx !== section.facts.length - 1 ? "border-b border-slate-800/50" : ""} hover:bg-slate-800/30 transition-colors`}
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                      <p className="text-slate-200 text-sm mb-2">{fact.value}</p>
                                      <div className="flex gap-2 flex-wrap">
                                        {getConfidenceBadge(parseFloat(fact.confidence))}
                                        {getStatusBadge(fact.verification_status)}
                                        {getMethodBadge(fact.extraction_method)}
                                      </div>
                                    </div>
                                    <Button
                                      onClick={() => handleEdit(fact)}
                                      variant="ghost"
                                      size="sm"
                                      className="text-slate-400 hover:text-white"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        // No narrative yet - show raw facts with notice
                        <div className="p-6 space-y-4">
                          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 mb-4">
                            <p className="text-sm text-orange-400">
                              ℹ️ Narrative not yet generated. Click "Process & Consolidate" to generate a summary narrative for this section.
                            </p>
                          </div>
                          <div>
                            {section.facts.map((fact, idx) => (
                              <div
                                key={fact.id}
                                className={`p-4 ${idx !== section.facts.length - 1 ? "border-b border-slate-800/50" : ""} hover:bg-slate-800/30 transition-colors`}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <p className="text-slate-200 text-sm mb-2">{fact.value}</p>
                                    <div className="flex gap-2 flex-wrap">
                                      {getConfidenceBadge(parseFloat(fact.confidence))}
                                      {getStatusBadge(fact.verification_status)}
                                      {getMethodBadge(fact.extraction_method)}
                                    </div>
                                  </div>
                                  <Button
                                    onClick={() => handleEdit(fact)}
                                    variant="ghost"
                                    size="sm"
                                    className="text-slate-400 hover:text-white"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    ) : (
                      // Itemized Mode - always show facts
                      <div>
                        {section.facts.map((fact, idx) => (
                          <div
                            key={fact.id}
                            className={`p-4 ${idx !== section.facts.length - 1 ? "border-b border-slate-800/50" : ""} hover:bg-slate-800/30 transition-colors`}
                          >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-white text-base leading-relaxed mb-3">{fact.value}</p>
                            <div className="flex items-center gap-3 flex-wrap">
                              {getConfidenceBadge(parseFloat(fact.confidence || "0"))}
                              {getMethodBadge(fact.extraction_method)}
                              {getStatusBadge(fact.verification_status)}
                              
                              {/* Enrichment indicator */}
                              {fact.enrichment_count && fact.enrichment_count > 1 && (
                                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                                  <TrendingUp className="h-3 w-3 mr-1" />
                                  Enriched {fact.enrichment_count}x
                                </Badge>
                              )}
                              
                              {/* Conflict warning */}
                              {fact.conflict_with && (
                                <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Conflict
                                </Badge>
                              )}
                              
                              {/* Source documents count */}
                              {fact.source_documents && fact.source_documents.length > 1 && (
                                <Badge className="bg-slate-700/50 text-slate-300 border-slate-600">
                                  <FileText className="h-3 w-3 mr-1" />
                                  {fact.source_documents.length} docs
                                </Badge>
                              )}
                              
                              {fact.key && (
                                <span className="text-xs text-slate-500">Key: {fact.key}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {fact.verification_status === "pending" && (
                              <>
                                <Button
                                  onClick={() => handleApprove(fact.id)}
                                  size="sm"
                                  className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  onClick={() => handleReject(fact.id)}
                                  size="sm"
                                  className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              onClick={() => handleEdit(fact)}
                              size="sm"
                              variant="outline"
                              className="border-slate-700 hover:bg-slate-800"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Insight</DialogTitle>
            <DialogDescription className="text-slate-400">
              Modify the insight value and approve it
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Category</label>
              <p className="text-white">{selectedFact?.category}</p>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Key</label>
              <p className="text-white">{selectedFact?.key}</p>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Value</label>
              <Textarea
                value={editedValue}
                onChange={(e) => setEditedValue(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white min-h-[120px] resize-y"
                placeholder="Enter the insight statement..."
              />
              <p className="text-xs text-slate-500 mt-1">{editedValue.length} characters</p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setEditDialogOpen(false)}
              variant="outline"
              className="border-slate-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Save & Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
