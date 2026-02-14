import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Sun, Cloud, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MonthlyData {
  month: string;
  ghi: number;
  dni: number;
  dhi?: number; // Diffuse Horizontal Irradiance (optional for backward compatibility)
}

interface MonthlyIrradianceChartProps {
  data: MonthlyData[];
}

type ViewMode = 'ghi-dhi' | 'dni';

export function MonthlyIrradianceChart({ data }: MonthlyIrradianceChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('ghi-dhi');

  if (!data || data.length === 0) {
    return (
      <Card className="bg-slate-900 border-slate-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <Sun className="h-5 w-5 text-yellow-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">Monthly Irradiance</h3>
        </div>
        <div className="text-center py-8 text-slate-400">
          <Cloud className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No weather data available</p>
          <p className="text-sm mt-2">Upload a TMY weather file to see irradiance data</p>
        </div>
      </Card>
    );
  }

  // Check if DHI data is available
  const hasDHI = data.some(d => d.dhi !== undefined && d.dhi > 0);

  // Calculate max values for scaling based on view mode
  const maxGHI = Math.max(...data.map(d => d.ghi));
  const maxDHI = hasDHI ? Math.max(...data.map(d => d.dhi || 0)) : 0;
  const maxDNI = Math.max(...data.map(d => d.dni));
  
  const maxValue = viewMode === 'ghi-dhi' 
    ? Math.max(maxGHI, maxDHI) 
    : maxDNI;
  const yAxisMax = Math.ceil(maxValue / 100) * 100 || 300; // Round up to nearest 100, default 300

  // Generate Y-axis labels (5 ticks)
  const yTicks = [0, yAxisMax * 0.25, yAxisMax * 0.5, yAxisMax * 0.75, yAxisMax];

  // Calculate annual totals
  const annualGHI = data.reduce((sum, m) => sum + m.ghi, 0);
  const annualDNI = data.reduce((sum, m) => sum + m.dni, 0);
  const annualDHI = data.reduce((sum, m) => sum + (m.dhi || 0), 0);

  return (
    <Card className="bg-slate-900 border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <Sun className="h-5 w-5 text-yellow-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">Monthly Irradiance</h3>
        </div>
        
        {/* View Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800 rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              className={`px-3 py-1 text-xs rounded ${
                viewMode === 'ghi-dhi' 
                  ? 'bg-yellow-500/20 text-yellow-400' 
                  : 'text-slate-400 hover:text-slate-300'
              }`}
              onClick={() => setViewMode('ghi-dhi')}
            >
              GHI {hasDHI && '/ DHI'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`px-3 py-1 text-xs rounded ${
                viewMode === 'dni' 
                  ? 'bg-orange-500/20 text-orange-400' 
                  : 'text-slate-400 hover:text-slate-300'
              }`}
              onClick={() => setViewMode('dni')}
            >
              DNI
            </Button>
          </div>
          
          {/* Legend */}
          <div className="flex gap-3 text-sm">
            {viewMode === 'ghi-dhi' ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                  <span className="text-slate-300">GHI</span>
                </div>
                {hasDHI && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span className="text-slate-300">DHI</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded"></div>
                <span className="text-slate-300">DNI</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="relative">
        {/* Y-axis */}
        <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-slate-400 text-right pr-2">
          {[...yTicks].reverse().map((tick, i) => (
            <div key={i}>{Math.round(tick)}</div>
          ))}
        </div>

        {/* Chart area */}
        <div className="ml-14 mr-2">
          {/* Grid lines */}
          <div className="relative h-64">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="absolute left-0 right-0 border-t border-slate-800"
                style={{ top: `${i * 25}%` }}
              />
            ))}

            {/* Bars */}
            <div className="absolute inset-0 flex items-end justify-around gap-2">
              {data.map((month, idx) => (
                <div key={idx} className="flex-1 flex gap-0.5 items-end justify-center h-full">
                  {viewMode === 'ghi-dhi' ? (
                    <>
                      {/* GHI bar */}
                      <div
                        className="flex-1 bg-gradient-to-t from-yellow-600 to-yellow-400 rounded-t transition-all hover:opacity-80 cursor-pointer group relative"
                        style={{
                          height: `${(month.ghi / yAxisMax) * 100}%`,
                          minHeight: month.ghi > 0 ? "2px" : "0",
                        }}
                        title={`GHI: ${month.ghi.toFixed(1)} kWh/m²`}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                          GHI: {month.ghi.toFixed(1)} kWh/m²
                        </div>
                      </div>
                      {/* DHI bar (if available) */}
                      {hasDHI && (
                        <div
                          className="flex-1 bg-gradient-to-t from-blue-600 to-blue-400 rounded-t transition-all hover:opacity-80 cursor-pointer group relative"
                          style={{
                            height: `${((month.dhi || 0) / yAxisMax) * 100}%`,
                            minHeight: (month.dhi || 0) > 0 ? "2px" : "0",
                          }}
                          title={`DHI: ${(month.dhi || 0).toFixed(1)} kWh/m²`}
                        >
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                            DHI: {(month.dhi || 0).toFixed(1)} kWh/m²
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    /* DNI bar */
                    <div
                      className="flex-1 max-w-8 bg-gradient-to-t from-orange-600 to-orange-400 rounded-t transition-all hover:opacity-80 cursor-pointer group relative"
                      style={{
                        height: `${(month.dni / yAxisMax) * 100}%`,
                        minHeight: month.dni > 0 ? "2px" : "0",
                      }}
                      title={`DNI: ${month.dni.toFixed(1)} kWh/m²`}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                        DNI: {month.dni.toFixed(1)} kWh/m²
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* X-axis labels */}
          <div className="flex justify-around mt-2 text-xs text-slate-400">
            {data.map((month, idx) => (
              <div key={idx} className="flex-1 text-center">
                {month.month}
              </div>
            ))}
          </div>
        </div>

        {/* Y-axis label */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-slate-400 whitespace-nowrap origin-center">
          Irradiance (kWh/m²)
        </div>
      </div>

      {/* Summary stats */}
      <div className="mt-6 pt-4 border-t border-slate-700 grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-slate-400">Annual GHI</div>
          <div className="text-white font-semibold">
            {annualGHI.toFixed(0)} kWh/m²
          </div>
        </div>
        <div>
          <div className="text-slate-400">Annual DNI</div>
          <div className="text-white font-semibold">
            {annualDNI.toFixed(0)} kWh/m²
          </div>
        </div>
        {hasDHI && (
          <div>
            <div className="text-slate-400">Annual DHI</div>
            <div className="text-white font-semibold">
              {annualDHI.toFixed(0)} kWh/m²
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
