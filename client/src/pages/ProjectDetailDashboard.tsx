import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapView } from "@/components/Map";
import {
  FileText,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3,
  DollarSign,
  Upload,
  Lightbulb,
  ArrowLeft,
  MapPin,
} from "lucide-react";

export default function ProjectDetailDashboard() {
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const projectIdStr = searchParams.get("projectId");
  const projectId = projectIdStr ? parseInt(projectIdStr, 10) : null;

  const [mapReady, setMapReady] = useState(false);
  const [map, setMap] = useState<mapboxgl.Map | null>(null);
  // Marker is now handled by MapView component

  // Fetch project details
  const { data: project, isLoading: isLoadingProject } = trpc.projects.get.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  // Fetch insights count and confidence
  const { data: facts } = trpc.facts.list.useQuery(
    { projectId: project?.dbName || "" },
    { enabled: !!project?.dbName }
  );

  // Fetch documents count
  const { data: documents } = trpc.documents.list.useQuery(
    { projectId: project?.dbName || "" },
    { enabled: !!project?.dbName }
  );

  // Fetch processing jobs
  const { data: processingJobs } = trpc.processing.listJobs.useQuery(
    { projectId: project?.dbName || "" },
    { enabled: !!project?.dbName }
  );

  // Fetch project overview narrative
  const { data: narratives } = trpc.facts.getNarratives.useQuery(
    { projectId: project?.dbName || "" },
    { enabled: !!project?.dbName }
  );

  // Fetch performance parameters for location
  const { data: perfParams } = trpc.performanceParams.getByProject.useQuery(
    { projectDbName: project?.dbName || "" },
    { enabled: !!project?.dbName }
  );

  // Calculate metrics
  const insightsCount = facts?.length || 0;
  const avgConfidence = facts?.length
    ? (facts.reduce((sum, f) => sum + parseFloat(f.confidence || "0"), 0) / facts.length * 100).toFixed(0)
    : "0";
  
  const docsCount = documents?.length || 0;
  const processingCount = processingJobs?.filter((j: any) => j.status === 'processing').length || 0;
  const completedCount = processingJobs?.filter((j: any) => j.status === 'completed').length || 0;
  const failedCount = processingJobs?.filter((j: any) => j.status === 'failed').length || 0;

  // Red flags placeholder (TODO: implement red flags system)
  const redFlags = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  // Data completeness
  const hasInsights = insightsCount > 0;
  const hasDocs = docsCount > 0;
  const hasPerformanceParams = !!perfParams && Array.isArray(perfParams) && perfParams.length > 0;
  const hasNarrative = !!narratives?.Project_Overview;
  const completenessPercent = [hasInsights, hasDocs, hasPerformanceParams, hasNarrative].filter(Boolean).length * 25;

  // Map initialization
  const handleMapReady = (mapInstance: mapboxgl.Map) => {
    setMap(mapInstance);
    setMapReady(true);
    // Marker and location are now handled by MapView component
  };

  if (!projectId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Card className="bg-slate-900 border-slate-700 p-8">
          <p className="text-slate-400">No project selected</p>
          <Button
            onClick={() => navigate("/projects")}
            className="mt-4"
            variant="outline"
          >
            Go to Projects
          </Button>
        </Card>
      </div>
    );
  }

  if (isLoadingProject) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Loading project...</div>
      </div>
    );
  }

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
                Projects
              </Button>
              <div className="h-8 w-px bg-slate-700" />
              <div>
                <h1 className="text-2xl font-bold text-white">{project?.projectName}</h1>
                <p className="text-sm text-slate-400 mt-1">Project Dashboard</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                {completenessPercent}% Complete
              </Badge>
              {processingCount > 0 && (
                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                  <Clock className="h-3 w-3 mr-1" />
                  {processingCount} Processing
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Map & Overview */}
          <div className="lg:col-span-2 space-y-6">
            {/* Map */}
            <Card className="bg-slate-900 border-slate-700 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-blue-400" />
                  Project Location
                </h2>
              </div>
              <div className="h-[400px]">
                <MapView 
                  onMapReady={handleMapReady}
                  initialCenter={{
                    lat: perfParams && Array.isArray(perfParams) && perfParams.length > 0 && (perfParams[0] as any).latitude
                      ? parseFloat((perfParams[0] as any).latitude)
                      : 0,
                    lng: perfParams && Array.isArray(perfParams) && perfParams.length > 0 && (perfParams[0] as any).longitude
                      ? parseFloat((perfParams[0] as any).longitude)
                      : 0
                  }}
                  initialZoom={12}
                />
              </div>
              {perfParams && Array.isArray(perfParams) && perfParams.length > 0 && (
                <div className="p-4 border-t border-slate-700 bg-slate-800/50">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Latitude:</span>
                      <span className="ml-2 text-white">{(perfParams[0] as any).latitude ? parseFloat((perfParams[0] as any).latitude).toFixed(4) : "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Longitude:</span>
                      <span className="ml-2 text-white">{(perfParams[0] as any).longitude ? parseFloat((perfParams[0] as any).longitude).toFixed(4) : "N/A"}</span>
                    </div>
                    {(perfParams[0] as any).site_name && (
                      <div className="col-span-2">
                        <span className="text-slate-400">Site:</span>
                        <span className="ml-2 text-white">{(perfParams[0] as any).site_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Card>

            {/* Project Overview */}
            {narratives?.Project_Overview && (
              <Card className="bg-slate-900 border-slate-700">
                <div className="p-6">
                  <h2 className="text-lg font-semibold text-white mb-4">Project Overview</h2>
                  <div className="prose prose-invert prose-slate max-w-none">
                    <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {narratives.Project_Overview}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Right Column - Metrics & Quick Actions */}
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Key Metrics</h2>
              
              {/* Insights */}
              <Card className="bg-slate-900 border-slate-700 p-4 hover:border-blue-500/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/insights?projectId=${projectId}`)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Lightbulb className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{insightsCount}</p>
                      <p className="text-sm text-slate-400">Insights</p>
                    </div>
                  </div>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                    {avgConfidence}% avg
                  </Badge>
                </div>
              </Card>

              {/* Red Flags */}
              <Card className="bg-slate-900 border-slate-700 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-red-500/20 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {redFlags.critical + redFlags.high + redFlags.medium + redFlags.low}
                    </p>
                    <p className="text-sm text-slate-400">Red Flags</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="text-center">
                    <div className="text-red-400 font-semibold">{redFlags.critical}</div>
                    <div className="text-slate-500">Critical</div>
                  </div>
                  <div className="text-center">
                    <div className="text-orange-400 font-semibold">{redFlags.high}</div>
                    <div className="text-slate-500">High</div>
                  </div>
                  <div className="text-center">
                    <div className="text-yellow-400 font-semibold">{redFlags.medium}</div>
                    <div className="text-slate-500">Medium</div>
                  </div>
                  <div className="text-center">
                    <div className="text-blue-400 font-semibold">{redFlags.low}</div>
                    <div className="text-slate-500">Low</div>
                  </div>
                </div>
              </Card>

              {/* Documents */}
              <Card className="bg-slate-900 border-slate-700 p-4 hover:border-purple-500/50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/project/${projectId}/documents`)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <FileText className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">{docsCount}</p>
                      <p className="text-sm text-slate-400">Documents</p>
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-green-400">{completedCount} complete</div>
                    {processingCount > 0 && <div className="text-yellow-400">{processingCount} processing</div>}
                    {failedCount > 0 && <div className="text-red-400">{failedCount} failed</div>}
                  </div>
                </div>
              </Card>

              {/* Data Completeness */}
              <Card className="bg-slate-900 border-slate-700 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{completenessPercent}%</p>
                    <p className="text-sm text-slate-400">Data Complete</p>
                  </div>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-3">
                  <div 
                    className="h-full bg-gradient-to-r from-green-600 to-emerald-600 transition-all duration-500"
                    style={{ width: `${completenessPercent}%` }}
                  />
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Insights Extracted</span>
                    {hasInsights ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-slate-600" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Documents Uploaded</span>
                    {hasDocs ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-slate-600" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Performance Parameters</span>
                    {hasPerformanceParams ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-slate-600" />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Project Narrative</span>
                    {hasNarrative ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-slate-600" />
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
              
              <div className="grid grid-cols-1 gap-2">
                <Button
                  onClick={() => navigate(`/project/${projectId}/upload`)}
                  variant="outline"
                  className="justify-start border-slate-700 hover:bg-slate-800 hover:border-blue-500/50"
                >
                  <Upload className="h-4 w-4 mr-2 text-blue-400" />
                  Upload Documents
                </Button>
                
                <Button
                  onClick={() => navigate(`/insights?projectId=${projectId}`)}
                  variant="outline"
                  className="justify-start border-slate-700 hover:bg-slate-800 hover:border-purple-500/50"
                >
                  <Lightbulb className="h-4 w-4 mr-2 text-purple-400" />
                  View Insights
                </Button>
                
                <Button
                  onClick={() => navigate(`/project/${projectId}/performance`)}
                  variant="outline"
                  className="justify-start border-slate-700 hover:bg-slate-800 hover:border-green-500/50"
                >
                  <TrendingUp className="h-4 w-4 mr-2 text-green-400" />
                  Performance Validation
                </Button>
                
                <Button
                  onClick={() => navigate(`/project/${projectId}/performance-params`)}
                  variant="outline"
                  className="justify-start border-slate-700 hover:bg-slate-800 hover:border-cyan-500/50"
                >
                  <BarChart3 className="h-4 w-4 mr-2 text-cyan-400" />
                  Performance Parameters
                </Button>
                
                <Button
                  onClick={() => navigate(`/project/${projectId}/financial`)}
                  variant="outline"
                  className="justify-start border-slate-700 hover:bg-slate-800 hover:border-yellow-500/50"
                >
                  <DollarSign className="h-4 w-4 mr-2 text-yellow-400" />
                  Financial Data
                </Button>
                
                <Button
                  onClick={() => navigate(`/project/${projectId}/documents`)}
                  variant="outline"
                  className="justify-start border-slate-700 hover:bg-slate-800 hover:border-orange-500/50"
                >
                  <FileText className="h-4 w-4 mr-2 text-orange-400" />
                  Documents List
                </Button>
                
                <Button
                  onClick={() => navigate(`/processing-status?projectId=${projectId}`)}
                  variant="outline"
                  className="justify-start border-slate-700 hover:bg-slate-800 hover:border-slate-500/50"
                >
                  <Clock className="h-4 w-4 mr-2 text-slate-400" />
                  Processing Status
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
