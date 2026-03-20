import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Plus, Loader2, AlertCircle, FolderOpen, Upload, ArrowLeft, Linkedin, Menu, FileText, Settings, AlertTriangle, Trash2, Zap, DollarSign } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ProjectCard } from "@/components/ProjectCard";

export default function ProjectDashboard() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "" });
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<number | null>(null);

  // Fetch projects
  const { data: projects, isLoading, error } = trpc.projects.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const utils = trpc.useUtils();

  // Create project mutation
  const createMutation = trpc.projects.create.useMutation({
    onSuccess: () => {
      setFormData({ name: "", description: "" });
      setIsCreateOpen(false);
      // Invalidate projects list to refetch
      utils.projects.list.invalidate();
      toast.success("Project created successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to create project: ${error.message}`);
    },
  });

  const demoMutation = trpc.demo.simulateWorkflow.useMutation({
    onSuccess: (data) => {
      utils.projects.list.invalidate();
      toast.success(`Demo data loaded! ${data.stats.documents} documents, ${data.stats.facts} insights, ${data.stats.redFlags} red flags`);
    },
    onError: (error) => {
      toast.error(`Failed to load demo data: ${error.message}`);
    },
  });

  const deleteMutation = trpc.projects.delete.useMutation({
    onSuccess: () => {
      utils.projects.list.invalidate();
      toast.success("Project deleted successfully!");
      setDeleteConfirmOpen(false);
      setProjectToDelete(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete project: ${error.message}`);
    },
  });



  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    await createMutation.mutateAsync({
      name: formData.name,
      description: formData.description || undefined,
    });
  };

  const handleLoadDemoData = async (projectId: number) => {
    await demoMutation.mutateAsync({ projectId });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <Card className="w-full max-w-md bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white">Authentication Required</CardTitle>
            <CardDescription className="text-slate-400">Please log in to access the Project Dashboard.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header - Matching OE Toolkit Style */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 md:py-6 flex items-center justify-between">
          {/* Logo Section */}
          <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img 
              src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663183448316/ajFrkysEfsqfkiXJ.png" 
              alt="Main Character Energy" 
              className="h-10 w-10 md:h-12 md:w-12" 
            />
            <div>
              <div className="text-lg md:text-2xl font-bold text-white tracking-tight">
                MAIN CHARACTER ENERGY
              </div>
              <div className="text-xs md:text-sm text-slate-400 font-medium">
                MCE Workspace
              </div>
            </div>
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <button
              onClick={() => setLocation("/")}
              className="text-slate-300 hover:text-orange-400 transition-colors font-medium"
            >
              Home
            </button>
            <button
              onClick={() => setLocation("/ollama-config")}
              className="text-slate-300 hover:text-orange-400 transition-colors font-medium flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Ollama Settings
            </button>
            <a 
              href="https://www.linkedin.com/company/main-character-energy-consulting/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-[#0077b5] transition-colors"
              aria-label="Follow us on LinkedIn"
            >
              <Linkedin className="h-5 w-5" />
            </a>
          </div>

          {/* Mobile Menu */}
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <button className="md:hidden text-slate-300 hover:text-white transition-colors p-2">
                <Menu className="h-6 w-6" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] bg-slate-900 border-slate-700">
              <div className="flex flex-col gap-8 mt-8">
                <button
                  onClick={() => {
                    setLocation("/");
                    setIsMenuOpen(false);
                  }}
                  className="text-xl font-semibold text-slate-300 hover:text-white transition-colors py-2 text-left"
                >
                  Home
                </button>
                <a 
                  href="https://www.linkedin.com/company/main-character-energy-consulting/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xl font-semibold text-slate-300 hover:text-orange-400 transition-colors py-2 flex items-center gap-2"
                >
                  <Linkedin className="h-5 w-5" />
                  LinkedIn
                </a>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 md:py-20">
        {/* Page Header */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Your Projects
          </h1>
          <p className="text-lg text-slate-300 max-w-3xl">
            Manage renewable energy projects with isolated databases for data sovereignty. 
            Create new projects or access existing ones to begin document ingestion and analysis.
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-8 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-red-400">Error Loading Projects</h3>
              <p className="text-red-300/80 text-sm mt-1">{error.message}</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-orange-400 mx-auto mb-3" />
              <p className="text-slate-400">Loading your projects...</p>
            </div>
          </div>
        ) : projects && projects.length > 0 ? (
          <div>
            {/* Action Bar */}
            <div className="flex items-center justify-between mb-8">
              <p className="text-slate-400">
                {projects.length} project{projects.length !== 1 ? "s" : ""} total
              </p>
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                    <Plus className="mr-2 h-4 w-4" />
                    New Project
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-700">
                  <DialogHeader>
                    <DialogTitle className="text-white">Create New Project</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Start a new project for document ingestion and analysis.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateProject} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-slate-300">Project Name</Label>
                      <Input
                        id="name"
                        placeholder="e.g., Clare Solar Farm Phase 2"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description" className="text-slate-300">Description (Optional)</Label>
                      <Textarea
                        id="description"
                        placeholder="Brief description of the project..."
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 resize-none"
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-3 justify-end">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateOpen(false)}
                        className="border-slate-700 text-slate-300 hover:bg-slate-800"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                        disabled={createMutation.isPending || !formData.name.trim()}
                      >
                        {createMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          "Create Project"
                        )}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Projects Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {projects.map((project: any) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => setLocation(`/project-dashboard?projectId=${project.id}`)}
                  onDelete={() => {
                    setProjectToDelete(project.id);
                    setDeleteConfirmOpen(true);
                  }}
                  isDeleting={deleteMutation.isPending && projectToDelete === project.id}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-24">
            <div className="flex justify-center mb-6">
              <div className="p-6 bg-orange-500/10 rounded-full">
                <FolderOpen className="h-16 w-16 text-orange-400" />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-white mb-4">No Projects Yet</h3>
            <p className="text-slate-300 mb-8 max-w-md mx-auto text-lg">
              Create your first project to start ingesting and analyzing renewable energy project documents.
            </p>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold" size="lg">
                  <Plus className="mr-2 h-5 w-5" />
                  Create Your First Project
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Create New Project</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Start a new project for document ingestion and analysis.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateProject} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-slate-300">Project Name</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Clare Solar Farm Phase 2"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-slate-300">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Brief description of the project..."
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 resize-none"
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-3 justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateOpen(false)}
                      className="border-slate-700 text-slate-300 hover:bg-slate-800"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                      disabled={createMutation.isPending || !formData.name.trim()}
                    >
                      {createMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Project"
                      )}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[425px] bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              Delete Project?
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              This action cannot be undone. This will permanently delete the project, all documents, insights, and associated data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setProjectToDelete(null);
              }}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (projectToDelete) {
                  deleteMutation.mutate({ projectId: String(projectToDelete) });
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Project
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
