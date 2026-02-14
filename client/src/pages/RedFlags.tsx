import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, AlertCircle, Info, CheckCircle2, XCircle, Search, FileText, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { normalizeSection, CANONICAL_SECTIONS } from "../../../shared/section-normalizer";

interface Fact {
  id: number;
  category: string;
  key: string;
  value: string;
  confidence: string;
  source_document_id: string;
  source_location: string | null;
  extraction_method: string;
  verification_status: string;
  created_at: string;
}

interface RiskFact extends Fact {
  severity: "critical" | "high" | "medium" | "low";
  riskCategory: string;
}

// Risk severity classification based on confidence and keywords
function classifyRiskSeverity(fact: Fact): "critical" | "high" | "medium" | "low" {
  const value = fact.value.toLowerCase();
  const confidence = parseFloat(fact.confidence || "0");
  
  // Critical keywords
  const criticalKeywords = ["must", "critical", "fatal", "failure", "impossible", "cannot", "blocked", "showstopper"];
  // High keywords
  const highKeywords = ["significant", "major", "substantial", "severe", "serious", "urgent", "delay"];
  // Medium keywords
  const mediumKeywords = ["moderate", "potential", "possible", "may", "could", "risk", "issue", "concern"];
  
  // Check for critical keywords
  if (criticalKeywords.some(kw => value.includes(kw))) {
    return "critical";
  }
  
  // Check for high keywords
  if (highKeywords.some(kw => value.includes(kw))) {
    return "high";
  }
  
  // Check for medium keywords
  if (mediumKeywords.some(kw => value.includes(kw))) {
    return "medium";
  }
  
  // Low confidence facts are lower severity
  if (confidence < 0.8) {
    return "low";
  }
  
  // Default to medium
  return "medium";
}

// Extract risk category from fact key
function extractRiskCategory(fact: Fact): string {
  const key = fact.key.toLowerCase();
  
  if (key.includes("planning") || key.includes("schedule") || key.includes("timeline")) {
    return "Planning & Timeline";
  }
  if (key.includes("grid") || key.includes("connection") || key.includes("infrastructure")) {
    return "Grid Integration";
  }
  if (key.includes("geotech") || key.includes("site") || key.includes("soil")) {
    return "Geotechnical";
  }
  if (key.includes("regulatory") || key.includes("permit") || key.includes("compliance")) {
    return "Regulatory";
  }
  if (key.includes("financial") || key.includes("cost") || key.includes("budget")) {
    return "Financial";
  }
  if (key.includes("technical") || key.includes("design") || key.includes("engineering")) {
    return "Technical";
  }
  if (key.includes("environmental") || key.includes("esia") || key.includes("social")) {
    return "Environmental/Social";
  }
  
  return "Other";
}

export default function RedFlags() {
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const projectIdStr = searchParams.get("projectId");
  const projectId = projectIdStr ? parseInt(projectIdStr, 10) : null;

  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  const isLoading = isLoadingProject || isLoadingFacts;

  const updateFactMutation = trpc.facts.update.useMutation({
    onSuccess: () => {
      toast.success("Risk status updated successfully");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to update risk: ${error.message}`);
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

  // Filter facts to only show risks (from Risks_And_Issues section)
  const riskFacts: RiskFact[] = facts
    ? facts
        .filter(fact => normalizeSection(fact.category) === CANONICAL_SECTIONS.RISKS_AND_ISSUES)
        .map(fact => ({
          ...fact,
          severity: classifyRiskSeverity(fact),
          riskCategory: extractRiskCategory(fact),
        }))
    : [];

  // Apply filters
  const filteredRisks = riskFacts.filter(risk => {
    // Severity filter
    if (filterSeverity !== "all" && risk.severity !== filterSeverity) {
      return false;
    }
    
    // Category filter
    if (filterCategory !== "all" && risk.riskCategory !== filterCategory) {
      return false;
    }
    
    // Search filter
    if (searchQuery && !risk.value.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  // Calculate statistics
  const stats = {
    total: riskFacts.length,
    critical: riskFacts.filter(r => r.severity === "critical").length,
    high: riskFacts.filter(r => r.severity === "high").length,
    medium: riskFacts.filter(r => r.severity === "medium").length,
    low: riskFacts.filter(r => r.severity === "low").length,
    pending: riskFacts.filter(r => r.verification_status === "pending").length,
    acknowledged: riskFacts.filter(r => r.verification_status === "approved").length,
  };

  // Get unique risk categories
  const riskCategories = Array.from(new Set(riskFacts.map(r => r.riskCategory))).sort();

  // Severity badge styling
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Critical</Badge>;
      case "high":
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">High</Badge>;
      case "medium":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Medium</Badge>;
      case "low":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Low</Badge>;
      default:
        return <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">{severity}</Badge>;
    }
  };

  // Severity icon
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <AlertCircle className="h-5 w-5 text-red-400" />;
      case "high":
        return <AlertTriangle className="h-5 w-5 text-orange-400" />;
      case "medium":
        return <Info className="h-5 w-5 text-yellow-400" />;
      case "low":
        return <TrendingDown className="h-5 w-5 text-blue-400" />;
      default:
        return <Info className="h-5 w-5 text-slate-400" />;
    }
  };

  const handleAcknowledge = (riskId: number) => {
    updateFactMutation.mutate({
      projectId: project?.dbName || "",
      factId: riskId,
      status: "approved",
    });
  };

  const handleDismiss = (riskId: number) => {
    updateFactMutation.mutate({
      projectId: project?.dbName || "",
      factId: riskId,
      status: "rejected",
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Red Flags Dashboard</h1>
              <p className="text-slate-400">Identified risks and issues requiring attention</p>
            </div>
            <Button
              onClick={() => navigate(`/project-dashboard?projectId=${projectId}`)}
              variant="outline"
              className="border-slate-700 hover:bg-slate-800"
            >
              Back to Dashboard
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-slate-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-sm text-slate-400">Total Risks</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-slate-900/50 border-red-900/30">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.critical}</p>
                <p className="text-sm text-slate-400">Critical</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-slate-900/50 border-orange-900/30">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-orange-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.high}</p>
                <p className="text-sm text-slate-400">High</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-slate-900/50 border-yellow-900/30">
            <div className="flex items-center gap-3">
              <Info className="h-8 w-8 text-yellow-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.medium}</p>
                <p className="text-sm text-slate-400">Medium</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-slate-900/50 border-blue-900/30">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-white">{stats.low}</p>
                <p className="text-sm text-slate-400">Low</p>
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
                <p className="text-2xl font-bold text-white">{stats.acknowledged}</p>
                <p className="text-sm text-slate-400">Acknowledged</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4 bg-slate-900/50 border-slate-800 mb-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm text-slate-400 mb-2 block">Search Risks</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search in risk statements..."
                  className="pl-10 bg-slate-800 border-slate-700 text-white"
                />
              </div>
            </div>

            <div className="w-48">
              <label className="text-sm text-slate-400 mb-2 block">Severity</label>
              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-56">
              <label className="text-sm text-slate-400 mb-2 block">Category</label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {riskCategories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Risk List */}
        {isLoading ? (
          <Card className="p-8 bg-slate-900/50 border-slate-800 text-center">
            <p className="text-slate-400">Loading risks...</p>
          </Card>
        ) : filteredRisks.length === 0 ? (
          <Card className="p-8 bg-slate-900/50 border-slate-800 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <p className="text-slate-400">
              {riskFacts.length === 0 
                ? "No risks identified in this project" 
                : "No risks found matching your filters"}
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredRisks.map((risk) => (
              <Card key={risk.id} className="bg-slate-900/50 border-slate-800 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Severity Icon */}
                    <div className="mt-1">
                      {getSeverityIcon(risk.severity)}
                    </div>

                    {/* Risk Content */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getSeverityBadge(risk.severity)}
                            <Badge variant="outline" className="border-slate-700 text-slate-400">
                              {risk.riskCategory}
                            </Badge>
                            {risk.verification_status === "pending" && (
                              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                                Pending Review
                              </Badge>
                            )}
                            {risk.verification_status === "approved" && (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                Acknowledged
                              </Badge>
                            )}
                            {risk.verification_status === "rejected" && (
                              <Badge className="bg-slate-500/20 text-slate-400 border-slate-500/30">
                                Dismissed
                              </Badge>
                            )}
                          </div>
                          <p className="text-white text-base leading-relaxed">{risk.value}</p>
                        </div>
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Confidence: {(parseFloat(risk.confidence) * 100).toFixed(0)}%</span>
                        <span>Method: {risk.extraction_method}</span>
                        <span>Key: {risk.key}</span>
                      </div>

                      {/* Actions */}
                      {risk.verification_status === "pending" && (
                        <div className="flex gap-2 mt-4">
                          <Button
                            onClick={() => handleAcknowledge(risk.id)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Acknowledge
                          </Button>
                          <Button
                            onClick={() => handleDismiss(risk.id)}
                            size="sm"
                            variant="outline"
                            className="border-slate-700 hover:bg-slate-800"
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Dismiss
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
