import React from 'react';
import { useParams, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle2, DollarSign, TrendingUp, PieChart, ArrowLeft, AlertTriangle, FileText, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

export function FinancialData() {
  const params = useParams();
  const projectId = params.projectId;
  const [, navigate] = useLocation();

  // Fetch project to get dbName
  const { data: projects } = trpc.projects.list.useQuery();
  const project = projects?.find((p: any) => p.id === parseInt(projectId || '0'));
  const projectDbName = project?.dbName;

  // Fetch financial data
  const { data: financialData, isLoading } = trpc.financial.getByProject.useQuery(
    { projectDbName: projectDbName || '' },
    { enabled: !!projectDbName }
  );

  const dataArray = Array.isArray(financialData) ? financialData : [];
  const latestData: any = dataArray.length > 0 ? dataArray[0] : null;

  if (isLoading || !projectDbName) {
    return (
      <div className="container py-8">
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!latestData) {
    return (
      <div className="container py-8 space-y-6">
        {/* Header with back navigation */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Financial Data</h1>
            <p className="text-muted-foreground">CapEx and OpEx breakdown for benchmarking</p>
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
              Data Required for Financial Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
                <FileText className="h-5 w-5 mt-0.5 text-orange-500" />
                <div>
                  <p className="font-medium">Financial Documents Required</p>
                  <p className="text-sm text-muted-foreground">
                    Upload an IM, DD Pack, or Financial Model containing cost breakdowns (CapEx, OpEx, development costs, etc.)
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-background/50">
                <Settings className="h-5 w-5 mt-0.5 text-orange-500" />
                <div>
                  <p className="font-medium">Run Consolidation</p>
                  <p className="text-sm text-muted-foreground">
                    After uploading documents, click "Process & Consolidate" on the Insights page to extract financial data
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No financial data extracted yet. Upload financial documents and run consolidation to populate this data.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const confidencePercent = (parseFloat(latestData.confidence || '0') * 100).toFixed(1);
  const confidenceLevel = parseFloat(confidencePercent) >= 70 ? 'HIGH' : parseFloat(confidencePercent) >= 40 ? 'MEDIUM' : 'LOW';
  const confidenceColor = confidenceLevel === 'HIGH' ? 'bg-green-500' : confidenceLevel === 'MEDIUM' ? 'bg-yellow-500' : 'bg-red-500';

  // Prepare CapEx chart data
  const capexData = [
    { name: 'Modules', value: parseFloat(latestData.modules_usd || '0') },
    { name: 'Inverters', value: parseFloat(latestData.inverters_usd || '0') },
    { name: 'Trackers', value: parseFloat(latestData.trackers_usd || '0') },
    { name: 'Civil Works', value: parseFloat(latestData.civil_works_usd || '0') },
    { name: 'Grid Connection', value: parseFloat(latestData.grid_connection_usd || '0') },
    { name: 'Development', value: parseFloat(latestData.development_costs_usd || '0') },
    { name: 'Other', value: parseFloat(latestData.other_capex_usd || '0') },
  ].filter(item => item.value > 0);

  // Prepare OpEx chart data
  const opexData = [
    { name: 'O&M', value: parseFloat(latestData.om_usd || '0') },
    { name: 'Insurance', value: parseFloat(latestData.insurance_usd || '0') },
    { name: 'Land Lease', value: parseFloat(latestData.land_lease_usd || '0') },
    { name: 'Asset Mgmt', value: parseFloat(latestData.asset_management_usd || '0') },
    { name: 'Other', value: parseFloat(latestData.other_opex_usd || '0') },
  ].filter(item => item.value > 0);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280'];

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  return (
    <div className="container py-8 space-y-6">
      {/* Header with back navigation */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Financial Data</h1>
          <p className="text-muted-foreground">CapEx and OpEx breakdown for benchmarking</p>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total CapEx</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestData.total_capex_usd ? formatCurrency(parseFloat(latestData.total_capex_usd)) : 'N/A'}
            </div>
            {latestData.original_currency && latestData.original_currency !== 'USD' && (
              <p className="text-xs text-muted-foreground mt-1">
                Original: {latestData.original_currency}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Annual OpEx</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestData.total_opex_annual_usd ? formatCurrency(parseFloat(latestData.total_opex_annual_usd)) : 'N/A'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">CapEx per Watt</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestData.capex_per_watt_usd ? `$${parseFloat(latestData.capex_per_watt_usd).toFixed(2)}/W` : 'N/A'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">OpEx per MWh</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {latestData.opex_per_mwh_usd ? `$${parseFloat(latestData.opex_per_mwh_usd).toFixed(2)}/MWh` : 'N/A'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CapEx Breakdown */}
      {capexData.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              CapEx Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={capexData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="value" name="Cost (USD)">
                    {capexData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <DataField label="Modules" value={latestData.modules_usd} format="currency" />
              <DataField label="Inverters" value={latestData.inverters_usd} format="currency" />
              <DataField label="Trackers" value={latestData.trackers_usd} format="currency" />
              <DataField label="Civil Works" value={latestData.civil_works_usd} format="currency" />
              <DataField label="Grid Connection" value={latestData.grid_connection_usd} format="currency" />
              <DataField label="Development" value={latestData.development_costs_usd} format="currency" />
              <DataField label="Other CapEx" value={latestData.other_capex_usd} format="currency" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* OpEx Breakdown */}
      {opexData.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Annual OpEx Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={opexData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => formatCurrency(value)} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="value" name="Annual Cost (USD)">
                    {opexData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
              <DataField label="O&M" value={latestData.om_usd} format="currency" />
              <DataField label="Insurance" value={latestData.insurance_usd} format="currency" />
              <DataField label="Land Lease" value={latestData.land_lease_usd} format="currency" />
              <DataField label="Asset Management" value={latestData.asset_management_usd} format="currency" />
              <DataField label="Other OpEx" value={latestData.other_opex_usd} format="currency" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Cost Metadata
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <DataField label="Cost Year" value={latestData.cost_year} />
            <DataField label="Original Currency" value={latestData.original_currency} />
            <DataField label="Exchange Rate to USD" value={latestData.exchange_rate_to_usd} />
            <DataField label="Escalation Rate" value={latestData.escalation_rate_percent} unit="%/year" />
            <DataField label="Source Document" value={latestData.source_document_id} />
            <DataField label="Extraction Method" value={latestData.extraction_method} />
            <DataField label="Extracted At" value={new Date(latestData.created_at).toLocaleString()} />
            {latestData.notes && <DataField label="Notes" value={latestData.notes} className="md:col-span-3" />}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DataField({ label, value, unit, format, className }: { label: string; value: any; unit?: string; format?: 'currency'; className?: string }) {
  const hasValue = value !== null && value !== undefined && value !== '';
  
  let displayValue = value;
  if (hasValue && format === 'currency') {
    const numValue = parseFloat(value);
    if (numValue >= 1000000) {
      displayValue = `$${(numValue / 1000000).toFixed(1)}M`;
    } else if (numValue >= 1000) {
      displayValue = `$${(numValue / 1000).toFixed(0)}K`;
    } else {
      displayValue = `$${numValue.toFixed(0)}`;
    }
  }
  
  return (
    <div className={className}>
      <div className="text-sm text-muted-foreground mb-1">{label}</div>
      {hasValue ? (
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
          <span className="font-medium">
            {displayValue}{unit && ` ${unit}`}
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
