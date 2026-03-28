/**
 * Knowledge Engine Dashboard
 *
 * Displays cross-project intelligence from the MCE Knowledge Engine:
 * - Overview: health, record counts, data quality, coverage by project type
 * - Risks: query similar risks by project type / category
 * - Benchmarks: cost & schedule estimates by project type and capacity
 * - Gaps: intelligence gaps and recommendations
 */
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Brain,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Activity,
  Loader2,
  RefreshCw,
  Database,
  Zap,
  Target,
  BookOpen,
  ChevronRight,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PROJECT_TYPES = ["solar", "wind", "battery", "hybrid"];

const RISK_CATEGORIES = [
  "geotechnical",
  "environmental",
  "grid_connection",
  "permitting",
  "procurement",
  "construction",
  "financial",
  "weather",
  "design",
  "operations",
];

function confidenceBadge(level: string) {
  const map: Record<string, string> = {
    high: "bg-green-500/20 text-green-300 border-green-500/30",
    medium: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    low: "bg-red-500/20 text-red-300 border-red-500/30",
  };
  return map[level] ?? "bg-slate-500/20 text-slate-300 border-slate-500/30";
}

function impactBadge(impact: string) {
  const map: Record<string, string> = {
    critical: "bg-red-500/20 text-red-300 border-red-500/30",
    high: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    medium: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    low: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  };
  return map[impact?.toLowerCase()] ?? "bg-slate-500/20 text-slate-300 border-slate-500/30";
}

function StatCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="text-3xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

// ─── Tab: Overview ───────────────────────────────────────────────────────────

function OverviewTab() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statusQuery = (trpc as any).knowledgeEngine.status.useQuery(undefined, {
    retry: false,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const healthQuery = (trpc as any).knowledgeEngine.health.useQuery(undefined, {
    retry: false,
  });

  const status = statusQuery.data;
  const health = healthQuery.data;
  const isLoading = statusQuery.isLoading || healthQuery.isLoading;
  const isError = statusQuery.isError || healthQuery.isError;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Connecting to Knowledge Engine…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-slate-400">
        <AlertTriangle className="h-10 w-10 text-orange-400" />
        <p className="text-lg font-medium text-white">Knowledge Engine Unreachable</p>
        <p className="text-sm text-slate-400 max-w-md text-center">
          The Knowledge Engine service is not responding. Make sure the{" "}
          <code className="text-orange-400">knowledge-engine</code> container is running and healthy.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="border-slate-600 text-slate-300 hover:bg-slate-700"
          onClick={() => { statusQuery.refetch(); healthQuery.refetch(); }}
        >
          <RefreshCw className="h-3 w-3 mr-1" /> Retry
        </Button>
      </div>
    );
  }

  const qualityPct = status ? Math.round(status.data_quality_score * 100) : 0;
  const coverageEntries = status ? Object.entries(status.coverage_by_type) : [];

  return (
    <div className="space-y-8">
      {/* Health banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
        <div className={`h-2.5 w-2.5 rounded-full ${health?.status === "healthy" ? "bg-green-400" : "bg-red-400"}`} />
        <span className="text-sm text-slate-300">
          Knowledge Engine is{" "}
          <span className={health?.status === "healthy" ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
            {health?.status ?? "unknown"}
          </span>
          {health?.environment && (
            <span className="text-slate-500 ml-2">({health.environment})</span>
          )}
        </span>
        <span className="ml-auto text-xs text-slate-500">
          Last updated: {status?.last_updated ? new Date(status.last_updated).toLocaleString() : "—"}
        </span>
      </div>

      {/* Record counts */}
      <div>
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
          Intelligence Records
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Projects" value={status?.total_projects ?? 0} icon={<Database className="h-3.5 w-3.5" />} />
          <StatCard label="Risks" value={status?.total_risks ?? 0} icon={<AlertTriangle className="h-3.5 w-3.5" />} />
          <StatCard label="Site Conditions" value={status?.total_site_conditions ?? 0} icon={<Target className="h-3.5 w-3.5" />} />
          <StatCard label="Outcomes" value={status?.total_outcomes ?? 0} icon={<TrendingUp className="h-3.5 w-3.5" />} />
          <StatCard label="Design Standards" value={status?.total_design_standards ?? 0} icon={<BookOpen className="h-3.5 w-3.5" />} />
          <StatCard label="Equipment" value={status?.total_equipment_records ?? 0} icon={<Zap className="h-3.5 w-3.5" />} />
        </div>
      </div>

      {/* Data quality */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-orange-400" />
              Data Quality Score
            </CardTitle>
            <CardDescription className="text-slate-400">
              Based on record count and completeness
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 mb-3">
              <span className="text-5xl font-bold text-white">{qualityPct}%</span>
              <Badge
                className={
                  qualityPct >= 70
                    ? "bg-green-500/20 text-green-300 border-green-500/30"
                    : qualityPct >= 40
                    ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                    : "bg-red-500/20 text-red-300 border-red-500/30"
                }
              >
                {qualityPct >= 70 ? "Good" : qualityPct >= 40 ? "Building" : "Early stage"}
              </Badge>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-orange-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${qualityPct}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-orange-400" />
              Coverage by Project Type
            </CardTitle>
            <CardDescription className="text-slate-400">
              Number of de-identified projects per type
            </CardDescription>
          </CardHeader>
          <CardContent>
            {coverageEntries.length === 0 ? (
              <p className="text-slate-500 text-sm">No projects ingested yet.</p>
            ) : (
              <div className="space-y-2">
                {coverageEntries.map(([type, count]) => (
                  <div key={type} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-24 capitalize">{type}</span>
                    <div className="flex-1 bg-slate-700 rounded-full h-1.5">
                      <div
                        className="bg-orange-500 h-1.5 rounded-full"
                        style={{
                          width: `${Math.min(100, (count / Math.max(...coverageEntries.map(([, c]) => c as number))) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-slate-300 w-6 text-right">{count as number}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Tab: Risks ───────────────────────────────────────────────────────────────

function RisksTab() {
  const [projectType, setProjectType] = useState("solar");
  const [category, setCategory] = useState<string>("all");
  const [submitted, setSubmitted] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const risksQuery = (trpc as any).knowledgeEngine.similarRisks.useQuery(
    {
      project_type: projectType,
      category: category === "all" ? undefined : category,
      limit: 30,
    },
    { enabled: submitted, retry: false },
  );

  const risks = risksQuery.data?.risks ?? [];
  const confidence = risksQuery.data?.confidence;

  return (
    <div className="space-y-6">
      {/* Query form */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">Query Risk Intelligence</CardTitle>
          <CardDescription className="text-slate-400">
            Find historical risks from de-identified projects matching your criteria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Project Type</Label>
              <Select value={projectType} onValueChange={setProjectType}>
                <SelectTrigger className="w-36 h-8 text-xs bg-slate-700 border-slate-600 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {PROJECT_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-slate-300 text-xs capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Category (optional)</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-44 h-8 text-xs bg-slate-700 border-slate-600 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  <SelectItem value="all" className="text-slate-300 text-xs">All categories</SelectItem>
                  {RISK_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="text-slate-300 text-xs capitalize">
                      {c.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white h-8"
              onClick={() => { setSubmitted(true); risksQuery.refetch(); }}
            >
              {risksQuery.isFetching ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Query
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {submitted && (
        <div>
          {risksQuery.isFetching ? (
            <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading risks…
            </div>
          ) : risksQuery.isError ? (
            <div className="text-red-400 text-sm py-8 text-center">
              Failed to load risks. The Knowledge Engine may not have data yet.
            </div>
          ) : risks.length === 0 ? (
            <div className="text-slate-500 text-sm py-8 text-center">
              No risks found for the selected criteria. Ingest project data to build the knowledge base.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  {risksQuery.data?.total_count ?? risks.length} risks found
                </p>
                {confidence && (
                  <Badge className={confidenceBadge(confidence.level)}>
                    {confidence.level} confidence · {confidence.projects_count} projects
                  </Badge>
                )}
              </div>
              {risks.map((risk: any) => (
                <div
                  key={risk.id}
                  className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-slate-200 flex-1">{risk.description}</p>
                    <div className="flex gap-1.5 shrink-0">
                      <Badge className={impactBadge(risk.impact)} variant="outline">
                        {risk.impact}
                      </Badge>
                      <Badge className="bg-slate-700/50 text-slate-400 border-slate-600 text-xs" variant="outline">
                        {risk.category?.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </div>
                  {risk.occurred && risk.outcome_description && (
                    <p className="text-xs text-slate-500 border-t border-slate-700 pt-2">
                      <span className="text-orange-400 font-medium">Outcome: </span>
                      {risk.outcome_description}
                    </p>
                  )}
                  {risk.mitigation_used && (
                    <p className="text-xs text-slate-500">
                      <span className="text-blue-400 font-medium">Mitigation: </span>
                      {risk.mitigation_used}
                      {risk.mitigation_effective === true && (
                        <span className="text-green-400 ml-1">(effective)</span>
                      )}
                      {risk.mitigation_effective === false && (
                        <span className="text-red-400 ml-1">(ineffective)</span>
                      )}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Benchmarks ─────────────────────────────────────────────────────────

function BenchmarksTab() {
  const [projectType, setProjectType] = useState("solar");
  const [capacityMw, setCapacityMw] = useState("10");
  const [region, setRegion] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const benchmarkQuery = (trpc as any).knowledgeEngine.benchmarkEstimate.useQuery(
    {
      project_type: projectType,
      capacity_mw: parseFloat(capacityMw) || 10,
      region: region || undefined,
    },
    { enabled: submitted, retry: false },
  );

  const data = benchmarkQuery.data;

  return (
    <div className="space-y-6">
      {/* Query form */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">Benchmark Estimate</CardTitle>
          <CardDescription className="text-slate-400">
            Get cost and schedule benchmarks based on historical project data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Project Type</Label>
              <Select value={projectType} onValueChange={setProjectType}>
                <SelectTrigger className="w-36 h-8 text-xs bg-slate-700 border-slate-600 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {PROJECT_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-slate-300 text-xs capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Capacity (MW)</Label>
              <Input
                value={capacityMw}
                onChange={(e) => setCapacityMw(e.target.value)}
                className="w-28 h-8 text-xs bg-slate-700 border-slate-600 text-slate-200"
                type="number"
                min="0.1"
                step="0.1"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Region (optional)</Label>
              <Input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. QLD, NSW"
                className="w-36 h-8 text-xs bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-600"
              />
            </div>
            <Button
              size="sm"
              className="bg-orange-500 hover:bg-orange-600 text-white h-8"
              onClick={() => { setSubmitted(true); benchmarkQuery.refetch(); }}
            >
              {benchmarkQuery.isFetching ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Estimate
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {submitted && (
        <div>
          {benchmarkQuery.isFetching ? (
            <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> Calculating benchmarks…
            </div>
          ) : benchmarkQuery.isError ? (
            <div className="text-red-400 text-sm py-8 text-center">
              Failed to load benchmarks. The Knowledge Engine may not have data yet.
            </div>
          ) : !data ? null : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Cost estimate */}
              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-orange-400" />
                    Cost Estimate
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {["low", "mid", "high"].map((k) => (
                      <div key={k} className="bg-slate-700/50 rounded-lg p-3">
                        <div className="text-xs text-slate-500 uppercase mb-1">{k}</div>
                        <div className="text-lg font-bold text-white">
                          {data.cost_estimate[k] != null
                            ? `$${Number(data.cost_estimate[k]).toLocaleString()}`
                            : "—"}
                        </div>
                        {data.cost_estimate.unit && (
                          <div className="text-xs text-slate-500">{data.cost_estimate.unit}</div>
                        )}
                      </div>
                    ))}
                  </div>
                  {data.cost_drivers?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1.5">Key cost drivers:</p>
                      <div className="space-y-1">
                        {data.cost_drivers.map((d: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <ChevronRight className="h-3 w-3 text-orange-400 shrink-0" />
                            <span className="text-slate-300">{d.factor}</span>
                            {d.impact && <Badge className="bg-slate-700/50 text-slate-400 border-slate-600 ml-auto">{d.impact}</Badge>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Schedule estimate */}
              <Card className="bg-slate-800/50 border-slate-700/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-orange-400" />
                    Schedule Estimate
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {["low", "mid", "high"].map((k) => (
                      <div key={k} className="bg-slate-700/50 rounded-lg p-3">
                        <div className="text-xs text-slate-500 uppercase mb-1">{k}</div>
                        <div className="text-lg font-bold text-white">
                          {data.schedule_estimate[k] != null
                            ? `${data.schedule_estimate[k]}`
                            : "—"}
                        </div>
                        {data.schedule_estimate.unit && (
                          <div className="text-xs text-slate-500">{data.schedule_estimate.unit}</div>
                        )}
                      </div>
                    ))}
                  </div>
                  {data.schedule_drivers?.length > 0 && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1.5">Key schedule drivers:</p>
                      <div className="space-y-1">
                        {data.schedule_drivers.map((d: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <ChevronRight className="h-3 w-3 text-orange-400 shrink-0" />
                            <span className="text-slate-300">{d.factor}</span>
                            {d.impact && <Badge className="bg-slate-700/50 text-slate-400 border-slate-600 ml-auto">{d.impact}</Badge>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Confidence + similar projects */}
              {data.confidence && (
                <div className="md:col-span-2 flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
                  <Badge className={confidenceBadge(data.confidence.level)}>
                    {data.confidence.level} confidence
                  </Badge>
                  <span className="text-xs text-slate-400">{data.confidence.explanation}</span>
                  <span className="ml-auto text-xs text-slate-500">
                    Based on {data.similar_projects_count} similar project{data.similar_projects_count !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Gaps ────────────────────────────────────────────────────────────────

function GapsTab() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const gapsQuery = (trpc as any).knowledgeEngine.gaps.useQuery(undefined, {
    retry: false,
  });

  const data = gapsQuery.data;

  if (gapsQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 py-8 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading gap analysis…
      </div>
    );
  }

  if (gapsQuery.isError) {
    return (
      <div className="text-red-400 text-sm py-8 text-center">
        Failed to load gap analysis. The Knowledge Engine may not be running.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gaps */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-400" />
            Intelligence Gaps
          </CardTitle>
          <CardDescription className="text-slate-400">
            Areas where the knowledge base needs more data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!data?.gaps?.length ? (
            <p className="text-slate-500 text-sm">No gaps identified.</p>
          ) : (
            <div className="space-y-3">
              {data.gaps.map((gap: any, i: number) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 bg-slate-700/30 rounded-lg border border-slate-700/50"
                >
                  <div className="h-5 w-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{gap.area}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{gap.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      {data?.recommendations?.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-orange-400" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.recommendations.map((rec: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <ChevronRight className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />
                  {rec}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Priority areas */}
      {data?.priority_areas?.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-orange-400" />
              Priority Areas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.priority_areas.map((area: string, i: number) => (
                <Badge
                  key={i}
                  className="bg-orange-500/20 text-orange-300 border-orange-500/30"
                  variant="outline"
                >
                  {area}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "overview" | "risks" | "benchmarks" | "gaps";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <Activity className="h-3.5 w-3.5" /> },
  { id: "risks", label: "Risk Intelligence", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  { id: "benchmarks", label: "Benchmarks", icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { id: "gaps", label: "Gaps", icon: <Target className="h-3.5 w-3.5" /> },
];

export default function KnowledgeEngine() {
  useAuth({ redirectOnUnauthenticated: true });
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 h-14 flex items-center gap-4">
          <Link href="/">
            <button className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm">
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          </Link>
          <div className="h-5 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-gradient-to-br from-purple-500 to-indigo-600">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <div>
              <span className="font-semibold text-white text-sm">Knowledge Engine</span>
              <span className="text-slate-500 text-xs ml-2">Cross-project intelligence</span>
            </div>
          </div>
        </div>
      </header>

      {/* Tab bar */}
      <div className="border-b border-slate-700/50 bg-slate-900/60">
        <div className="container mx-auto px-4">
          <div className="flex gap-1 py-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "risks" && <RisksTab />}
        {activeTab === "benchmarks" && <BenchmarksTab />}
        {activeTab === "gaps" && <GapsTab />}
      </main>
    </div>
  );
}
