import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2, Link as LinkIcon, CheckCircle, XCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { toast } from "sonner";

/**
 * Project Detail Page
 * 
 * Shows detailed information about a project including:
 * - Project metadata (name, code, type, phase)
 * - ACC connection status
 * - ACC project creation interface
 */
export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:id");
  const [, setLocation] = useLocation();
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [showHubDialog, setShowHubDialog] = useState(false);
  const [showTransitionDialog, setShowTransitionDialog] = useState(false);
  const [selectedHubId, setSelectedHubId] = useState<string>("");

  const projectId = params?.id ? parseInt(params.id) : null;

  // Fetch project data
  const { data: project, isLoading: projectLoading, refetch: refetchProject } = trpc.projects.get.useQuery(
    { id: projectId! },
    { enabled: !!projectId }
  );

  // Check ACC credentials (user-level)
  const { data: credentials, isLoading: credentialsLoading, refetch: refetchCredentials } = trpc.acc.getStoredCredentials.useQuery();

  // Get auth URL mutation
  const getAuthUrl = trpc.acc.getAuthUrl.useQuery(
    {
      redirectUri: `${window.location.origin}/callback`,
      projectId: projectId!,
    },
    { enabled: false }
  );

  // List hubs (user-level)
  const { data: hubs, isLoading: hubsLoading, refetch: refetchHubs } = trpc.acc.listHubs.useQuery(
    undefined,
    { enabled: false }
  );

  // Create ACC project mutation
  const createACCProject = trpc.acc.createProject.useMutation({
    onSuccess: () => {
      toast.success("ACC project created successfully!");
      setShowHubDialog(false);
      refetchProject();
    },
    onError: (error) => {
      toast.error(`Failed to create ACC project: ${error.message}`);
    },
  });

  // Transition to OE mutation
  const transitionToOE = trpc.projects.transitionToOE.useMutation({
    onSuccess: () => {
      toast.success("Project transitioned to OE successfully!");
      setShowTransitionDialog(false);
      refetchProject();
    },
    onError: (error) => {
      toast.error(`Failed to transition project: ${error.message}`);
    },
  });

  // Disconnect ACC mutation
  const disconnectACC = trpc.acc.disconnect.useMutation({
    onSuccess: () => {
      toast.success("ACC connection removed");
      refetchCredentials();
      refetchProject();
    },
    onError: (error) => {
      toast.error(`Failed to disconnect: ${error.message}`);
    },
  });

  const handleConnectToACC = async () => {
    try {
      const result = await getAuthUrl.refetch();
      if (result.data?.authUrl) {
        // Open OAuth in popup window (like mce-tools)
        const width = 600;
        const height = 700;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        const popup = window.open(
          result.data.authUrl,
          "ACC Authorization",
          `width=${width},height=${height},left=${left},top=${top},toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes`
        );

        // Listen for postMessage from popup
        const handleMessage = (event: MessageEvent) => {
          // Verify origin for security
          if (event.origin !== window.location.origin) return;
          
          if (event.data.type === "ACC_AUTH_SUCCESS") {
            toast.success("Successfully connected to ACC!");
            setShowConnectDialog(false);
            refetchCredentials();
            // Remove listener
            window.removeEventListener("message", handleMessage);
          } else if (event.data.type === "ACC_AUTH_ERROR") {
            toast.error(`Authorization failed: ${event.data.error}`);
            // Remove listener
            window.removeEventListener("message", handleMessage);
          }
        };

        window.addEventListener("message", handleMessage);

        // Check if popup was blocked
        if (!popup || popup.closed || typeof popup.closed === "undefined") {
          toast.error("Popup was blocked. Please allow popups for this site.");
          window.removeEventListener("message", handleMessage);
        }
      }
    } catch (error) {
      toast.error("Failed to get authorization URL");
    }
  };

  const handleCreateACCProject = async () => {
    if (!selectedHubId || !project) return;

    createACCProject.mutate({
      projectId: project.id,
      hubId: selectedHubId,
      projectName: project.projectName,
      projectType: project.projectType,
    });
  };

  const handleShowHubDialog = async () => {
    setShowConnectDialog(false);
    setShowHubDialog(true);
    await refetchHubs();
  };

  if (!projectId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Invalid Project</h2>
          <Button onClick={() => setLocation("/projects")} className="mt-4">
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  if (projectLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="h-12 w-12 text-orange-400 animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Project Not Found</h2>
          <Button onClick={() => setLocation("/projects")} className="mt-4">
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  const hasACCConnection = credentials?.hasCredentials === true;
  const hasACCProject = !!project.accProjectId;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 md:py-6">
          <Button
            variant="ghost"
            onClick={() => setLocation("/projects")}
            className="text-slate-300 hover:text-white mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl">
          {/* Project Header */}
          <div className="mb-8">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-4xl font-bold text-white mb-2">
                  {project.projectName}
                </h1>
                <p className="text-xl text-slate-400">
                  Code: {project.projectCode}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-orange-400 border-orange-400">
                  {project.projectType === "TA_TDD" ? "TA/TDD" : "OE"}
                </Badge>
                <Badge variant="outline" className="text-blue-400 border-blue-400">
                  {project.phase}
                </Badge>
              </div>
            </div>
          </div>

          {/* ACC Connection Card */}
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                  <LinkIcon className="h-6 w-6" />
                  ACC Connection
                </h2>
                <p className="text-slate-400">
                  Connect to Autodesk Construction Cloud to create project folders
                </p>
              </div>
              {hasACCConnection && (
                <CheckCircle className="h-8 w-8 text-green-400" />
              )}
            </div>

            {/* Connection Status */}
            <div className="space-y-4">
              {!hasACCConnection && (
                <div>
                  <p className="text-slate-300 mb-4">
                    No ACC connection found. Connect to ACC to create projects with ISO 19650 folder structures.
                  </p>
                  <Button
                    onClick={() => setShowConnectDialog(true)}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    Connect to ACC
                  </Button>
                </div>
              )}

              {hasACCConnection && !hasACCProject && (
                <div>
                  <p className="text-slate-300 mb-4">
                    ACC connected. Ready to create project in ACC.
                  </p>
                  <div className="flex gap-3">
                    <Button
                      onClick={handleShowHubDialog}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      Create ACC Project
                    </Button>
                    <Button
                      onClick={() => disconnectACC.mutate()}
                      variant="outline"
                      className="border-slate-600 text-white hover:bg-slate-800"
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              )}

              {hasACCConnection && hasACCProject && (
                <div>
                  <p className="text-green-400 mb-4 flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    ACC project created successfully
                  </p>
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-4 mb-4">
                    <p className="text-sm text-slate-400 mb-1">ACC Project ID</p>
                    <p className="text-white font-mono">{project.accProjectId}</p>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => window.open(`https://acc.autodesk.com/docs/files/projects/${project.accProjectId}`, "_blank")}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in ACC
                    </Button>
                    <Button
                      onClick={() => disconnectACC.mutate()}
                      variant="outline"
                      className="border-slate-600 text-white hover:bg-slate-800"
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Transition Card - Only for TA/TDD projects with ACC */}
          {project.projectType === "TA_TDD" && hasACCProject && (
            <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Project Transition</h2>
              <p className="text-slate-400 mb-4">
                This TA/TDD project can be transitioned to an OE (Owner's Engineer) project. This will extend the ACC folder structure with additional OE phases.
              </p>
              <Button
                onClick={() => setShowTransitionDialog(true)}
                className="bg-orange-500 hover:bg-orange-600"
              >
                Transition to OE
              </Button>
            </div>
          )}

          {/* Project Info Card */}
          <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-2xl font-bold text-white mb-4">Project Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-400 mb-1">Project Name</p>
                <p className="text-white">{project.projectName}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Project Code</p>
                <p className="text-white">{project.projectCode}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Project Type</p>
                <p className="text-white">{project.projectType === "TA_TDD" ? "TA/TDD" : "OE"}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Current Phase</p>
                <p className="text-white">{project.phase}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Created At</p>
                <p className="text-white">{new Date(project.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Last Updated</p>
                <p className="text-white">{new Date(project.updatedAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Connect to ACC Dialog */}
      <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Connect to ACC</DialogTitle>
            <DialogDescription className="text-slate-400">
              You will be redirected to Autodesk to authorize access to your ACC account.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end">
            <Button
              onClick={() => setShowConnectDialog(false)}
              variant="outline"
              className="border-slate-600 text-white hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConnectToACC}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Continue to Autodesk
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Select Hub Dialog */}
      <Dialog open={showHubDialog} onOpenChange={setShowHubDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Select ACC Hub</DialogTitle>
            <DialogDescription className="text-slate-400">
              Choose the ACC hub where you want to create the project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {hubsLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 text-orange-400 animate-spin" />
              </div>
            )}
            {!hubsLoading && hubs && hubs.length > 0 && (
              <Select value={selectedHubId} onValueChange={setSelectedHubId}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Select a hub" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {hubs.map((hub) => (
                    <SelectItem key={hub.id} value={hub.id} className="text-white">
                      {hub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!hubsLoading && (!hubs || hubs.length === 0) && (
              <p className="text-slate-400 text-center py-4">
                No ACC hubs found. Please check your ACC account permissions.
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <Button
                onClick={() => setShowHubDialog(false)}
                variant="outline"
                className="border-slate-600 text-white hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateACCProject}
                disabled={!selectedHubId || createACCProject.isPending}
                className="bg-orange-500 hover:bg-orange-600"
              >
                {createACCProject.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Project"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transition to OE Dialog */}
      <Dialog open={showTransitionDialog} onOpenChange={setShowTransitionDialog}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Transition to OE Project</DialogTitle>
            <DialogDescription className="text-slate-400">
              This will transition the project from TA/TDD to OE (Owner's Engineer) and extend the ACC folder structure with additional phases:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>03_Design_Review</li>
                <li>04_Construction_Monitoring</li>
                <li>05_Quality_Documentation_Review</li>
                <li>06_Project_Completion</li>
                <li>07_Deliverables</li>
              </ul>
              <p className="mt-2">
                The existing folders (01_PM, 02_Data_Incoming, 03_Deliverables) will be preserved for historical data.
              </p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 justify-end">
            <Button
              onClick={() => setShowTransitionDialog(false)}
              variant="outline"
              className="border-slate-600 text-white hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={() => transitionToOE.mutate({ id: project!.id })}
              disabled={transitionToOE.isPending}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {transitionToOE.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Transitioning...
                </>
              ) : (
                "Confirm Transition"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
