import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

/**
 * ACC Projects Management Page
 * 
 * Lists all ACC projects in the selected hub and allows deletion of orphaned/zombie projects.
 */
export default function ACCProjects() {
  const { user, loading: authLoading } = useAuth();
  const [selectedHub, setSelectedHub] = useState<string>("");
  const [projectToDelete, setProjectToDelete] = useState<any>(null);

  // Fetch ACC credentials status
  const { data: credentials, isLoading: credsLoading } = trpc.acc.getStoredCredentials.useQuery();

  // Fetch hubs
  const { data: hubs, isLoading: hubsLoading } = trpc.acc.listHubs.useQuery(undefined, {
    enabled: credentials?.hasCredentials === true,
  });

  // Fetch ACC projects for selected hub
  const { data: accProjects, isLoading: projectsLoading, refetch } = trpc.acc.listACCProjects.useQuery(
    { hubId: selectedHub },
    { enabled: !!selectedHub }
  );
  
  // Debug logging
  console.log('[ACCProjects] selectedHub:', selectedHub, 'accProjects:', accProjects);

  // Delete project mutation
  const deleteProject = trpc.acc.deleteACCProject.useMutation({
    onSuccess: () => {
      toast.success("Project deleted successfully");
      setProjectToDelete(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to delete project: ${error.message}`);
    },
  });

  if (authLoading || credsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <p className="text-center mb-4">Please log in to manage ACC projects</p>
          <Button asChild className="w-full">
            <a href={`/login`}>Log In</a>
          </Button>
        </Card>
      </div>
    );
  }

  if (!credentials?.hasCredentials) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
          <p className="text-center mb-4">You need to connect to ACC first</p>
          <Button asChild className="w-full">
            <Link href="/projects">Go to Projects</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link href="/projects">
            <Button variant="ghost" className="mb-4 text-slate-300 hover:text-white">
              ← Back to Projects
            </Button>
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">ACC Projects Management</h1>
          <p className="text-slate-300">
            View and manage all ACC projects in your account. Clean up orphaned or test projects.
          </p>
        </div>

        {/* Hub Selection */}
        <Card className="p-6 mb-6 bg-slate-800/50 border-slate-700">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Select ACC Hub
          </label>
          <Select value={selectedHub} onValueChange={setSelectedHub}>
            <SelectTrigger className="w-full bg-slate-900 border-slate-700 text-white">
              <SelectValue placeholder="Choose a hub..." />
            </SelectTrigger>
            <SelectContent>
              {hubsLoading ? (
                <div className="p-4 text-center">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                </div>
              ) : (
                hubs?.map((hub) => (
                  <SelectItem key={hub.id} value={hub.id}>
                    {hub.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </Card>

        {/* Projects List */}
        {selectedHub && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-4">
              Projects in {hubs?.find((h) => h.id === selectedHub)?.name}
            </h2>

            {projectsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              </div>
            ) : accProjects && accProjects.length > 0 ? (
              <div className="grid gap-4">
                {accProjects.map((project: any) => (
                  <Card
                    key={project.id}
                    className="p-6 bg-slate-800/50 border-slate-700 flex items-center justify-between"
                  >
                    <div>
                      <h3 className="text-lg font-semibold text-white">{project.name}</h3>
                      <p className="text-sm text-slate-400">ID: {project.id}</p>
                      {project.type && (
                        <p className="text-sm text-slate-400">Type: {project.type}</p>
                      )}
                      {project.status && (
                        <span
                          className={`inline-block mt-2 px-2 py-1 text-xs rounded ${
                            project.status === "active"
                              ? "bg-green-500/20 text-green-300"
                              : "bg-slate-600 text-slate-300"
                          }`}
                        >
                          {project.status}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setProjectToDelete(project)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 bg-slate-800/50 border-slate-700 text-center">
                <p className="text-slate-300">No projects found in this hub</p>
              </Card>
            )}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!projectToDelete} onOpenChange={() => setProjectToDelete(null)}>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Delete ACC Project</DialogTitle>
              <DialogDescription className="text-slate-300">
                Are you sure you want to delete "{projectToDelete?.name}"? This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setProjectToDelete(null)}
                className="border-slate-600 text-white hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (projectToDelete) {
                    deleteProject.mutate({
                      hubId: selectedHub,
                      projectId: projectToDelete.id,
                    });
                  }
                }}
                disabled={deleteProject.isPending}
              >
                {deleteProject.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Delete Project
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
