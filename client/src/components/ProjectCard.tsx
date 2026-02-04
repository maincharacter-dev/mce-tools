import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, MapPin, Zap, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface ProjectCardProps {
  project: {
    id: number;
    name: string;
    description?: string;
    status: string;
    createdAt: string;
  };
  onClick: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

export function ProjectCard({ project, onClick, onDelete, isDeleting }: ProjectCardProps) {
  const [mapImageUrl, setMapImageUrl] = useState<string | null>(null);

  // Fetch performance parameters to get location and capacity
  const { data: perfParams } = trpc.performanceParams.getByProject.useQuery(
    { projectId: String(project.id) },
    { enabled: !!project.id }
  );

  // Get first performance param for capacity and location
  const firstParam = perfParams && Array.isArray(perfParams) && perfParams.length > 0 
    ? perfParams[0] as any 
    : null;

  const capacity = firstParam?.capacity_mw 
    ? `${parseFloat(firstParam.capacity_mw).toFixed(0)} MW`
    : null;

  const latitude = firstParam?.latitude ? parseFloat(firstParam.latitude) : null;
  const longitude = firstParam?.longitude ? parseFloat(firstParam.longitude) : null;

  // Generate static map image URL using Mapbox
  useEffect(() => {
    if (latitude && longitude) {
      const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
      if (mapboxToken) {
        // Mapbox static image API
        const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${longitude},${latitude},12,0/300x150@2x?access_token=${mapboxToken}`;
        setMapImageUrl(url);
      }
    }
  }, [latitude, longitude]);

  return (
    <Card
      className="group cursor-pointer overflow-hidden bg-slate-900/50 border border-slate-700/50 rounded-xl transition-all duration-300 hover:border-orange-500/50 hover:bg-slate-900/80 hover:shadow-lg hover:shadow-orange-500/10"
      onClick={onClick}
    >
      {/* Map Thumbnail */}
      <div className="relative h-32 bg-slate-800 overflow-hidden">
        {mapImageUrl ? (
          <img
            src={mapImageUrl}
            alt={`${project.name} location`}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
            <MapPin className="h-8 w-8 text-slate-600" />
          </div>
        )}
        {/* Status Badge Overlay */}
        <div className="absolute top-2 right-2">
          <Badge className="bg-green-500/90 text-white border-0 text-xs">
            {project.status}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-white group-hover:text-orange-400 transition-colors truncate">
              {project.name}
            </h3>
            {capacity && (
              <div className="flex items-center gap-1.5 mt-1">
                <Zap className="h-3.5 w-3.5 text-yellow-400" />
                <span className="text-sm text-slate-300">{capacity}</span>
              </div>
            )}
            {!capacity && project.description && (
              <p className="text-sm text-slate-400 truncate mt-1">
                {project.description}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-950/50 shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
