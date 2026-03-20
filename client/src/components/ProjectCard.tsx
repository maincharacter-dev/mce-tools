import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Tag, Layers } from "lucide-react";

interface ProjectCardProps {
  project: {
    id: number;
    projectName: string;
    projectCode: string;
    projectType: "TA_TDD" | "OE";
    phase: string;
    status: string;
    projectDbName?: string | null;
    createdAt?: string | Date;
  };
  onClick: () => void;
}

const projectTypeLabel: Record<string, string> = {
  TA_TDD: "TA/TDD",
  OE: "OE",
};

const projectTypeColor: Record<string, string> = {
  TA_TDD: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  OE: "bg-violet-500/20 text-violet-300 border-violet-500/30",
};

const statusColor: Record<string, string> = {
  Active: "bg-green-500/90 text-white border-0",
  Archived: "bg-slate-500/90 text-white border-0",
};

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <Card
      className="group cursor-pointer overflow-hidden bg-slate-900/50 border border-slate-700/50 rounded-xl transition-all duration-300 hover:border-orange-500/50 hover:bg-slate-900/80 hover:shadow-lg hover:shadow-orange-500/10"
      onClick={onClick}
    >
      {/* Header band */}
      <div className="relative h-20 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center overflow-hidden">
        <MapPin className="h-8 w-8 text-slate-600" />
        {/* Status Badge */}
        <div className="absolute top-2 right-2">
          <Badge className={`text-xs ${statusColor[project.status] ?? "bg-slate-500/90 text-white border-0"}`}>
            {project.status}
          </Badge>
        </div>
        {/* Project type badge */}
        <div className="absolute top-2 left-2">
          <Badge
            variant="outline"
            className={`text-xs ${projectTypeColor[project.projectType] ?? "bg-slate-500/20 text-slate-300 border-slate-500/30"}`}
          >
            {projectTypeLabel[project.projectType] ?? project.projectType}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-white group-hover:text-orange-400 transition-colors truncate mb-1">
          {project.projectName}
        </h3>

        <div className="flex items-center gap-1.5 mb-1">
          <Tag className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
          <span className="text-sm text-slate-400 truncate font-mono">{project.projectCode}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
          <span className="text-sm text-slate-400 truncate">{project.phase}</span>
        </div>
      </div>
    </Card>
  );
}
