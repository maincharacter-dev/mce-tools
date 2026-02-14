import React from 'react';
import { useParams, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle2, FileText, MapPin, Zap, Settings, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function PerformanceParameters() {
  const params = useParams();
  const projectId = params.projectId;
  const [, navigate] = useLocation();

  // Fetch project to get dbName
  const { data: projects } = trpc.projects.list.useQuery();
  const project = projects?.find((p: any) => p.id === parseInt(projectId || '0'));
  const projectDbName = project?.dbName;

  // Fetch performance parameters
  const { data: parameters, isLoading } = trpc.performanceParams.getByProject.useQuery(
    { projectDbName: projectDbName || '' },
    { enabled: !!projectDbName }
  );

  const paramsArray = Array.isArray(parameters) ? parameters : [];
  const latestParams: any = paramsArray.length > 0 ? paramsArray[0] : null;

  if (isLoading || !projectDbName) {
    return (
      <div className="container py-8">
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!latestParams) {
    return (
      <div className="container py-8 space-y-6">
        {/* Header with back navigation */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Performance Parameters</h1>
            <p className="text-muted-foreground">Technical specifications extracted from project documents</p>
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

        {/* Missing Data Guidance */}
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Data Required for Performance Parameters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
                <FileText className="h-5 w-5 mt-0.5 text-orange-500" />
                <div>
                  <p className="font-medium">Technical Documents Required</p>
                  <p className="text-sm text-muted-foreground">
                    Upload an IM, DD Pack, or Concept Design document containing system specifications (DC/AC capacity, module type, inverter specs, etc.)
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
                <Settings className="h-5 w-5 mt-0.5 text-orange-500" />
                <div>
                  <p className="font-medium">Run Consolidation</p>
                  <p className="text-sm text-muted-foreground">
                    After uploading documents, click "Process & Consolidate" on the Insights page to extract performance parameters
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No performance parameters extracted yet. Upload technical documents and run consolidation to populate this data.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const confidencePercent = (parseFloat(latestParams.confidence || '0') * 100).toFixed(1);
  const confidenceLevel = parseFloat(confidencePercent) >= 70 ? 'HIGH' : parseFloat(confidencePercent) >= 40 ? 'MEDIUM' : 'LOW';
  const confidenceColor = confidenceLevel === 'HIGH' ? 'bg-green-500' : confidenceLevel === 'MEDIUM' ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="container py-8 space-y-6">
      {/* Header with back navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Parameters</h1>
          <p className="text-muted-foreground">Technical specifications for performance validation</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge className={`${confidenceColor} text-white`}>
            {confidenceLevel} CONFIDENCE ({confidencePercent}%)
          </Badge>
          <Button
            onClick={() => navigate(`/project-dashboard?projectId=${projectId}`)}
            variant="outline"
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* System Design */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            System Design
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <DataField label="DC Capacity" value={latestParams.dc_capacity_mw} unit="MW" />
            <DataField label="AC Capacity" value={latestParams.ac_capacity_mw} unit="MW" />
            <DataField label="DC/AC Ratio" value={latestParams.dc_capacity_mw && latestParams.ac_capacity_mw ? (parseFloat(latestParams.dc_capacity_mw) / parseFloat(latestParams.ac_capacity_mw)).toFixed(2) : null} />
            <DataField label="Module Model" value={latestParams.module_model} />
            <DataField label="Module Power" value={latestParams.module_power_watts} unit="W" />
            <DataField label="Module Count" value={latestParams.module_count} />
            <DataField label="Inverter Model" value={latestParams.inverter_model} />
            <DataField label="Inverter Power" value={latestParams.inverter_power_kw} unit="kW" />
            <DataField label="Inverter Count" value={latestParams.inverter_count} />
            <DataField label="Tracking Type" value={latestParams.tracking_type} />
            <DataField label="Tilt Angle" value={latestParams.tilt_angle_degrees} unit="°" />
            <DataField label="Azimuth" value={latestParams.azimuth_degrees} unit="°" />
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location & Site
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <DataField label="Site Name" value={latestParams.site_name} />
            <DataField label="Latitude" value={latestParams.latitude} />
            <DataField label="Longitude" value={latestParams.longitude} />
            <DataField label="Elevation" value={latestParams.elevation_m} unit="m" />
            <DataField label="Timezone" value={latestParams.timezone} />
          </div>
        </CardContent>
      </Card>

      {/* Performance Assumptions */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Performance Assumptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <DataField label="System Losses" value={latestParams.system_losses_percent} unit="%" />
            <DataField label="Degradation Rate" value={latestParams.degradation_rate_percent} unit="%/year" />
            <DataField label="Availability" value={latestParams.availability_percent} unit="%" />
            <DataField label="Soiling Loss" value={latestParams.soiling_loss_percent} unit="%" />
          </div>
        </CardContent>
      </Card>

      {/* Weather Data */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Weather Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <DataField label="GHI Annual" value={latestParams.ghi_annual_kwh_m2} unit="kWh/m²" />
            <DataField label="DNI Annual" value={latestParams.dni_annual_kwh_m2} unit="kWh/m²" />
            <DataField label="Ambient Temp" value={latestParams.temperature_ambient_c} unit="°C" />
            <DataField label="Weather File" value={latestParams.weather_file_url} />
          </div>
        </CardContent>
      </Card>

      {/* Contractor Claims */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Contractor Performance Claims</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <DataField label="P50 Generation" value={latestParams.p50_generation_gwh} unit="GWh/year" />
            <DataField label="P90 Generation" value={latestParams.p90_generation_gwh} unit="GWh/year" />
            <DataField label="Capacity Factor" value={latestParams.capacity_factor_percent} unit="%" />
            <DataField label="Specific Yield" value={latestParams.specific_yield_kwh_kwp} unit="kWh/kWp" />
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Extraction Metadata
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DataField label="Source Document" value={latestParams.source_document_id} />
            <DataField label="Extraction Method" value={latestParams.extraction_method} />
            <DataField label="Extracted At" value={new Date(latestParams.created_at).toLocaleString()} />
            {latestParams.notes && <DataField label="Notes" value={latestParams.notes} className="md:col-span-2" />}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DataField({ label, value, unit, className }: { label: string; value: any; unit?: string; className?: string }) {
  const hasValue = value !== null && value !== undefined && value !== '';
  
  return (
    <div className={className}>
      <div className="text-sm text-muted-foreground mb-1">{label}</div>
      {hasValue ? (
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
          <span className="font-medium">
            {value}{unit && ` ${unit}`}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground italic">Not extracted</span>
        </div>
      )}
    </div>
  );
}
