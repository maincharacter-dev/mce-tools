import React from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Zap, Sun, Gauge, ArrowLeft, CloudSun, FileText, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation, useParams } from "wouter";
import { WeatherFileUpload } from "@/components/WeatherFileUpload";
import { MonthlyIrradianceChart } from "@/components/MonthlyIrradianceChart";

export default function PerformanceValidation() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [, navigate] = useLocation();

  // Get project to extract dbName
  const { data: projects } = trpc.projects.list.useQuery();
  const project = projects?.find((p: any) => p.id.toString() === projectId);
  const projectDbName = project?.dbName;

  // Fetch performance validations
  const { data: validations, isLoading } = trpc.performance.getByProject.useQuery(
    { projectDbName: projectDbName || "" },
    { enabled: !!projectDbName }
  );

  // Fetch weather files for this project
  const { data: weatherFiles } = trpc.weatherFiles.getByProject.useQuery(
    { projectDbName: projectDbName || "" },
    { enabled: !!projectDbName }
  );

  // Fetch weather data (uploaded or free fallback)
  // TODO: Extract location from project data - for now using hardcoded test location
  const { data: weatherData } = trpc.weatherFiles.getWeatherData.useQuery(
    { 
      projectDbName: projectDbName || "",
      latitude: 19.638,  // TODO: Get from project location
      longitude: 56.884, // TODO: Get from project location
    },
    { enabled: !!projectDbName }
  );

  // Fetch performance parameters to check what data is available
  const { data: perfParams } = trpc.performanceParams.getByProject.useQuery(
    { projectDbName: projectDbName || "" },
    { enabled: !!projectDbName }
  );

  const latestValidation = validations?.[0];
  const weatherFilesArray = weatherFiles as any[] | undefined;
  const perfParamsArray = perfParams as any[] | undefined;
  const hasWeatherFile = weatherFilesArray && weatherFilesArray.length > 0;
  const hasPerfParams = perfParamsArray && perfParamsArray.length > 0;
  const hasWeatherData = !!weatherData;
  
  // Refetch validations when weather file is uploaded
  const utils = trpc.useUtils();
  const handleWeatherUpload = () => {
    utils.performance.getByProject.invalidate({ projectDbName: projectDbName || "" });
    utils.weatherFiles.getByProject.invalidate({ projectDbName: projectDbName || "" });
  };
  
  // Run validation mutation
  const runValidation = trpc.performance.runValidation.useMutation({
    onSuccess: () => {
      utils.performance.getByProject.invalidate({ projectDbName: projectDbName || "" });
    },
  });

  if (isLoading || !projectDbName) {
    return (
      <div className="container py-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!latestValidation) {
    return (
      <div className="container py-8 space-y-6">
        {/* Header with back navigation */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Performance Validation</h1>
            <p className="text-muted-foreground mt-2">
              Independent solar farm performance analysis using NREL PySAM
            </p>
          </div>
          <Button
            onClick={() => navigate(`/project-dashboard?projectId=${projectId}`)}
            variant="outline"
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        {/* Run Validation Button */}
        {hasPerfParams && (
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-blue-500" />
                Ready to Run Validation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Performance parameters have been extracted. Click below to run an independent PVWatts-style validation calculation.
              </p>
              <Button
                onClick={() => {
                  if (projectDbName && projectId) {
                    runValidation.mutate({
                      projectId: parseInt(projectId),
                      projectDbName
                    });
                  }
                }}
                disabled={runValidation.isPending}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                {runValidation.isPending ? 'Running Validation...' : 'Run Performance Validation'}
              </Button>
              {runValidation.error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {runValidation.error.message}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        )}

        {/* Missing Data Guidance */}
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Data Required for Performance Validation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Weather File Status */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
                <CloudSun className={`h-5 w-5 mt-0.5 ${hasWeatherFile ? 'text-green-500' : 'text-orange-500'}`} />
                <div>
                  <p className="font-medium">
                    {hasWeatherFile ? '✓ Weather File Uploaded' : 'Weather File Required'}
                  </p>
                  {hasWeatherFile ? (
                    <p className="text-sm text-muted-foreground">
                      {weatherFilesArray[0].file_name} ({(weatherFilesArray[0].file_size_bytes / 1024).toFixed(1)} KB)
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Upload a TMY weather file (CSV format) for accurate energy yield simulation
                    </p>
                  )}
                </div>
              </div>

              {/* Performance Parameters Status */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
                <Zap className={`h-5 w-5 mt-0.5 ${hasPerfParams ? 'text-green-500' : 'text-orange-500'}`} />
                <div>
                  <p className="font-medium">
                    {hasPerfParams ? '✓ Performance Parameters Extracted' : 'Performance Parameters Required'}
                  </p>
                  {hasPerfParams ? (
                    <p className="text-sm text-muted-foreground">
                      DC: {perfParamsArray[0].dc_capacity_mw} MW, AC: {perfParamsArray[0].ac_capacity_mw} MW
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Upload an IM or feasibility study to extract system specifications
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No performance validation results available yet. Upload the required data above, then click "Process & Consolidate" on the Insights page to run validation.
          </AlertDescription>
        </Alert>
        
        {/* Monthly Irradiance Chart */}
        {hasWeatherData && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CloudSun className="h-5 w-5 text-yellow-500" />
                  <CardTitle>Monthly Irradiance</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {weatherData.source === 'free' ? (
                    <>
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                        Free Data Source
                      </Badge>
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                        Open-Meteo API
                      </Badge>
                    </>
                  ) : (
                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
                      Project-Specific Data
                    </Badge>
                  )}
                </div>
              </div>
              {weatherData.source === 'free' && (
                <CardDescription className="flex items-start gap-2 mt-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span>
                    Using free weather data from Open-Meteo. For higher accuracy, upload a TMY file or{' '}
                    <span className="text-blue-400 font-medium">purchase premium data</span> (PVGIS license coming soon).
                  </span>
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <MonthlyIrradianceChart 
                data={weatherData.monthlyData.map((m: any) => ({
                  month: m.monthName || m.month,
                  ghi: m.ghi_kwh_m2 || m.ghi || 0,
                  dni: m.dni_kwh_m2 || m.dni || 0,
                  dhi: m.dhi_kwh_m2 || m.dhi || 0,
                }))}
              />
            </CardContent>
          </Card>
        )}
        
        {/* Weather file upload */}
        <WeatherFileUpload
          projectId={parseInt(projectId)}
          projectDbName={projectDbName}
          onUploadComplete={handleWeatherUpload}
        />
      </div>
    );
  }

  // Parse data (use snake_case as returned from MySQL)
  const monthlyProfile = latestValidation.monthly_profile
    ? JSON.parse(latestValidation.monthly_profile)
    : [];
  const warnings = latestValidation.warnings ? JSON.parse(latestValidation.warnings) : [];

  // Calculate variance status
  const variancePercent = parseFloat(latestValidation.variance_percent || "0");
  const isOverestimated = variancePercent > 0;
  const varianceColor = Math.abs(variancePercent) > 10 ? "text-red-600" : "text-green-600";
  const varianceIcon = isOverestimated ? TrendingDown : TrendingUp;

  // Confidence level colors
  const confidenceBadgeColor =
    latestValidation.confidence_level === "high"
      ? "bg-green-100 text-green-800"
      : latestValidation.confidence_level === "medium"
      ? "bg-yellow-100 text-yellow-800"
      : "bg-red-100 text-red-800";

  return (
    <div className="container py-8 space-y-6">
      {/* Header with back navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Performance Validation</h1>
          <p className="text-muted-foreground mt-2">
            Independent solar farm performance analysis using NREL PySAM
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => navigate(`/project-dashboard?projectId=${projectId}`)}
            variant="outline"
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <Button
            onClick={() => {
              if (projectDbName && projectId) {
                runValidation.mutate({
                  projectId: parseInt(projectId),
                  projectDbName
                });
              }
            }}
            disabled={runValidation.isPending}
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            {runValidation.isPending ? 'Running Validation...' : 'Run Performance Validation'}
          </Button>
        </div>
      </div>

      {/* Monthly Irradiance Chart - Always show if weather data exists */}
      {hasWeatherData && weatherData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CloudSun className="h-5 w-5 text-yellow-500" />
                <CardTitle>Monthly Irradiance</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {weatherData.source === 'free' ? (
                  <>
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                      Free Data Source
                    </Badge>
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                      Open-Meteo API
                    </Badge>
                  </>
                ) : (
                  <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
                    Project-Specific Data
                  </Badge>
                )}
              </div>
            </div>
            {weatherData.source === 'free' && (
              <CardDescription className="flex items-start gap-2 mt-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <span>
                  Using free weather data from Open-Meteo. For higher accuracy, upload a TMY file or{' '}
                  <span className="text-blue-400 font-medium">purchase premium data</span> (PVGIS license coming soon).
                </span>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <MonthlyIrradianceChart 
              data={weatherData.monthlyData.map((m: any) => ({
                month: m.monthName || m.month,
                ghi: m.ghi_kwh_m2 || m.ghi || 0,
                dni: m.dni_kwh_m2 || m.dni || 0,
                dhi: m.dhi_kwh_m2 || m.dhi || 0,
              }))}
            />
          </CardContent>
        </Card>
      )}

      {/* Red Flag Alert */}
      {latestValidation.flag_triggered === 1 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Performance Discrepancy Detected:</strong> Contractor's generation estimate differs from
            independent calculation by {Math.abs(variancePercent).toFixed(1)}%. This exceeds the 10% threshold
            and requires review.
          </AlertDescription>
        </Alert>
      )}

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Annual Generation */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Annual Generation</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {parseFloat(latestValidation.annual_generation_gwh || "0").toFixed(1)} GWh
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Independent estimate using PySAM
            </p>
          </CardContent>
        </Card>

        {/* Capacity Factor */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Capacity Factor</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {parseFloat(latestValidation.capacity_factor_percent || "0").toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {latestValidation.tracking_type === "single_axis" ? "Single-axis tracking" : "Fixed tilt"}
            </p>
          </CardContent>
        </Card>

        {/* Performance Ratio */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance Ratio</CardTitle>
            <Sun className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {parseFloat(latestValidation.performance_ratio_percent || "0").toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              System efficiency vs. ideal
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Contractor Claims Comparison */}
      {latestValidation.contractor_claim_gwh && (
        <Card>
          <CardHeader>
            <CardTitle>Contractor Claims Comparison</CardTitle>
            <CardDescription>
              Independent validation vs. contractor's performance estimates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Contractor Claim */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Contractor Estimate</div>
                <div className="text-3xl font-bold">
                  {parseFloat(latestValidation.contractor_claim_gwh).toFixed(1)} GWh
                </div>
              </div>

              {/* Independent Estimate */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Independent Estimate</div>
                <div className="text-3xl font-bold">
                  {parseFloat(latestValidation.annual_generation_gwh || "0").toFixed(1)} GWh
                </div>
              </div>
            </div>

            {/* Variance */}
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <div className="flex-1">
                <div className="text-sm font-medium text-muted-foreground">Variance</div>
                <div className={`text-2xl font-bold ${varianceColor} flex items-center gap-2`}>
                  {variancePercent > 0 ? <TrendingDown className="h-6 w-6" /> : <TrendingUp className="h-6 w-6" />}
                  {Math.abs(variancePercent).toFixed(1)}%
                  <span className="text-base font-normal">
                    ({isOverestimated ? "Overestimated" : "Underestimated"})
                  </span>
                </div>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-muted-foreground">Difference</div>
                <div className="text-2xl font-bold">
                  {Math.abs(parseFloat(latestValidation.variance_gwh || "0")).toFixed(1)} GWh
                </div>
              </div>
            </div>

            {/* Confidence Level */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Confidence Level</div>
                <div className="text-lg font-semibold mt-1">
                  <Badge className={confidenceBadgeColor}>
                    {latestValidation.confidence_level?.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Confidence Score</div>
                <div className="text-lg font-semibold mt-1">
                  {(parseFloat(latestValidation.confidence_score || "0") * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Input Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Input Summary</CardTitle>
          <CardDescription>
            Parameters used in performance calculation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <div className="text-sm font-medium text-muted-foreground">DC Capacity</div>
              <div className="text-lg font-semibold">{latestValidation.dc_capacity_mw} MW</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">AC Capacity</div>
              <div className="text-lg font-semibold">{latestValidation.ac_capacity_mw} MW</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Module Model</div>
              <div className="text-lg font-semibold">{latestValidation.module_model}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Inverter Model</div>
              <div className="text-lg font-semibold">{latestValidation.inverter_model}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Tracking Type</div>
              <div className="text-lg font-semibold capitalize">{latestValidation.tracking_type?.replace("_", " ")}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">System Losses</div>
              <div className="text-lg font-semibold">{latestValidation.total_system_losses_percent}%</div>
            </div>
          </div>

          {/* Parameter Extraction Stats */}
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Parameters Extracted</div>
                <div className="text-2xl font-bold text-green-600">
                  {latestValidation.parameters_extracted_count}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium">Parameters Assumed</div>
                <div className="text-2xl font-bold text-yellow-600">
                  {latestValidation.parameters_assumed_count}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium">Weather Data</div>
                <div className="text-sm font-semibold mt-1">
                  {latestValidation.weather_data_source?.split(" ")[0] || "PVGIS"}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Generation Profile */}
      {monthlyProfile.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Generation Profile</CardTitle>
            <CardDescription>
              Expected monthly generation and capacity factor throughout the year
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyProfile}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tickFormatter={(month) => {
                    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                    return months[month - 1];
                  }}
                />
                <YAxis yAxisId="left" label={{ value: "Generation (GWh)", angle: -90, position: "insideLeft" }} />
                <YAxis yAxisId="right" orientation="right" label={{ value: "Capacity Factor (%)", angle: 90, position: "insideRight" }} />
                <Tooltip
                  labelFormatter={(month) => {
                    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                    return months[month - 1];
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="generation_gwh" fill="#f97316" name="Generation (GWh)" />
                <Line yAxisId="right" type="monotone" dataKey="capacity_factor_percent" stroke="#3b82f6" name="Capacity Factor (%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Warnings & Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {warnings.map((warning: any, index: number) => (
              <Alert key={index} variant={warning.severity === "error" ? "destructive" : "default"}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{warning.message}</AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Weather Data Section */}
      {hasWeatherData && weatherData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudSun className="h-5 w-5" />
              Weather Data
            </CardTitle>
            {weatherData.source && (
              <CardDescription>
                Data source: {weatherData.source}
                {weatherData.monthlyData?.[0]?.year && (
                  <span className="ml-2">
                    (Year: {weatherData.monthlyData[0].year})
                  </span>
                )}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <MonthlyIrradianceChart 
              data={weatherData.monthlyData.map((m: any) => ({
                month: m.monthName || m.month,
                ghi: m.ghi_kwh_m2 || m.ghi || 0,
                dni: m.dni_kwh_m2 || m.dni || 0,
                dhi: m.dhi_kwh_m2 || m.dhi || 0,
              }))}
            />
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle>Calculation Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <div className="text-muted-foreground">Model Used</div>
              <div className="font-semibold">{latestValidation.model_used?.toUpperCase()}</div>
            </div>
            <div>
              <div className="text-muted-foreground">PySAM Version</div>
              <div className="font-semibold">{latestValidation.pysam_version}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Calculation Time</div>
              <div className="font-semibold">{latestValidation.calculation_time_seconds}s</div>
            </div>
            <div>
              <div className="text-muted-foreground">Calculated At</div>
              <div className="font-semibold">
                {new Date(latestValidation.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
