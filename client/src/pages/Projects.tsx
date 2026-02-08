import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ExternalLink, Folder, Archive } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Projects() {
  const [, setLocation] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [projectType, setProjectType] = useState<"TA_TDD" | "OE">("TA_TDD");

  const utils = trpc.useUtils();
  const { data: projects, isLoading } = trpc.projects.list.useQuery();
  
  const createProject = trpc.projects.create.useMutation({
    onSuccess: () => {
      toast.success("Project created successfully");
      utils.projects.list.invalidate();
      setIsCreateDialogOpen(false);
      setProjectName("");
      setProjectCode("");
      setProjectType("TA_TDD");
    },
    onError: (error) => {
      toast.error(`Failed to create project: ${error.message}`);
    },
  });

  const archiveProject = trpc.projects.archive.useMutation({
    onSuccess: () => {
      toast.success("Project archived successfully");
      utils.projects.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to archive project: ${error.message}`);
    },
  });

  const handleArchiveProject = (e: React.MouseEvent, projectId: number, projectName: string) => {
    e.stopPropagation(); // Prevent card click
    if (confirm(`Are you sure you want to archive "${projectName}"? This will:\n\n1. Rename the ACC project to add "[Archived]"\n2. Set ACC project status to inactive\n3. Mark the project as archived in OE Toolkit and TA/TDD\n\nYou can still view archived projects, but they will be marked as inactive.`)) {
      archiveProject.mutate({ id: projectId });
    }
  };

  const handleCreateProject = () => {
    if (!projectName || !projectCode) {
      toast.error("Please fill in all fields");
      return;
    }

    createProject.mutate({
      projectName,
      projectCode,
      projectType,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Projects</h1>
              <p className="text-slate-400 mt-1">Manage your OE Toolkit projects</p>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-orange-500 hover:bg-orange-600">
                  <Plus className="mr-2 h-4 w-4" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-slate-900 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Create New Project</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Create a new project in OE Toolkit. This will set up the project structure and prepare it for ACC integration.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="projectName" className="text-white">Project Name</Label>
                    <Input
                      id="projectName"
                      placeholder="e.g., Solar Farm Project Alpha"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="projectCode" className="text-white">Project Code</Label>
                    <Input
                      id="projectCode"
                      placeholder="e.g., SFP-001"
                      value={projectCode}
                      onChange={(e) => setProjectCode(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="projectType" className="text-white">Project Type</Label>
                    <Select value={projectType} onValueChange={(value) => setProjectType(value as "TA_TDD" | "OE")}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="TA_TDD">TA/TDD (Technical Advisory / Due Diligence)</SelectItem>
                        <SelectItem value="OE">OE (Owner's Engineer)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    className="border-slate-700 text-white hover:bg-slate-800"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateProject}
                    disabled={createProject.isPending}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    {createProject.isPending ? "Creating..." : "Create Project"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Projects Grid */}
      <main className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="text-center text-slate-400 py-12">Loading projects...</div>
        ) : !projects || projects.length === 0 ? (
          <Card className="bg-slate-900/50 border-slate-700/50">
            <CardContent className="py-12 text-center">
              <Folder className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No projects yet</h3>
              <p className="text-slate-400 mb-6">Create your first project to get started</p>
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create First Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="bg-slate-900/50 border-slate-700/50 hover:border-orange-500/50 transition-all duration-300 cursor-pointer group"
                onClick={() => setLocation(`/projects/${project.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-white group-hover:text-orange-400 transition-colors">
                        {project.projectName}
                      </CardTitle>
                      <CardDescription className="text-slate-400 mt-1">
                        {project.projectCode}
                      </CardDescription>
                    </div>
                    <ExternalLink className="h-4 w-4 text-slate-500 group-hover:text-orange-400 transition-colors" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Type:</span>
                      <span className="text-white font-medium">
                        {project.projectType === "TA_TDD" ? "TA/TDD" : "OE"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Phase:</span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {project.phase}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Status:</span>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                        project.status === 'Archived' 
                          ? 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                          : 'bg-green-500/20 text-green-300 border border-green-500/30'
                      }`}>
                        {project.status}
                      </span>
                    </div>
                    {project.accProjectId && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">ACC:</span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-300 border border-green-500/30">
                          Connected
                        </span>
                      </div>
                    )}
                  </div>
                  {project.status !== 'Archived' && (
                    <div className="mt-4 pt-4 border-t border-slate-700/50">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => handleArchiveProject(e, project.id, project.projectName)}
                        disabled={archiveProject.isPending}
                        className="w-full border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        {archiveProject.isPending ? "Archiving..." : "Archive Project"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
