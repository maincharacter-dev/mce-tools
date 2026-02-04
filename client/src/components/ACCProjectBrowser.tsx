import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Copy, Check, Folder, File, ChevronRight, ChevronDown, Download, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface FolderNode {
  id: string;
  name: string;
  isExpanded: boolean;
  isLoading?: boolean;
  children?: FolderNode[];
  files?: Array<{ id: string; name: string; size: number; checked: boolean }>;
}

interface ACCProjectBrowserProps {
  projectId?: number;
}

export function ACCProjectBrowser({ projectId: propProjectId }: ACCProjectBrowserProps = {}) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [selectedHub, setSelectedHub] = useState<string>("");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [folderTree, setFolderTree] = useState<FolderNode[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFileDetails, setSelectedFileDetails] = useState<Map<string, { name: string }>>(new Map());
  const params = useParams();
  // Use prop projectId first, then URL path param, then query string
  const searchParams = new URLSearchParams(window.location.search);
  const queryProjectId = searchParams.get("projectId");
  const projectId = propProjectId ?? (params.id ? parseInt(params.id) : null) ?? (queryProjectId ? parseInt(queryProjectId) : null);
  const [, navigate] = useLocation();
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [syncResult, setSyncResult] = useState<{ successCount: number; failCount: number; skippedCount: number; skippedFiles: string[] } | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Check for stored credentials on mount
  const { data: storedCreds } = trpc.acc.getStoredCredentials.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  // Check for stored project mapping
  const { data: storedMapping } = trpc.acc.getProjectMapping.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  // Auto-load stored credentials
  useEffect(() => {
    if (storedCreds?.hasCredentials && !storedCreds.isExpired && storedCreds.accessToken) {
      console.log("[ACC] Loading stored credentials");
      setAccessToken(storedCreds.accessToken);
      setIsConnected(true);
    } else if (storedCreds?.isExpired) {
      // Clear state if credentials are expired
      console.log("[ACC] Credentials expired, clearing state");
      setAccessToken(null);
      setIsConnected(false);
    }
  }, [storedCreds]);

  // Auto-load stored project mapping
  useEffect(() => {
    if (storedMapping?.hasMapping) {
      console.log("[ACC] Loading stored project mapping");
      setSelectedHub(storedMapping.accHubId);
      setSelectedProject(storedMapping.accProjectId);
    }
  }, [storedMapping]);

  // Get OAuth URL with client-side callback
  const { data: authData } = trpc.acc.getAuthUrl.useQuery(
    { redirectUri: window.location.origin + "/api/acc/oauth/callback", projectId: projectId! },
    { enabled: !accessToken && !!projectId }
  );

  // Exchange code mutation
  const exchangeCodeMutation = trpc.acc.exchangeCode.useMutation({
    onSuccess: (tokens) => {
      console.log("[ACC Auth] Token received:", tokens.access_token?.substring(0, 20) + "...");
      setAccessToken(tokens.access_token);
      setIsAuthenticating(false);
      setIsConnected(true);
      toast.success("Successfully authenticated with ACC!");
    },
    onError: (error) => {
      setIsAuthenticating(false);
      toast.error(`Authentication failed: ${error.message}`);
    },
  });

  // Save project mapping mutation
  const saveProjectMappingMutation = trpc.acc.saveProjectMapping.useMutation({
    onSuccess: () => {
      console.log("[ACC] Project mapping saved");
    },
    onError: (error) => {
      console.error("[ACC] Failed to save project mapping:", error);
    },
  });

  // Disconnect mutation
  const disconnectMutation = trpc.acc.disconnect.useMutation({
    onSuccess: () => {
      setAccessToken(null);
      setSelectedHub("");
      setSelectedProject("");
      setIsConnected(false);
      setFolderTree([]);
      toast.success("Disconnected from ACC");
    },
    onError: (error) => {
      toast.error(`Failed to disconnect: ${error.message}`);
    },
  });

  // Debug: Get raw API response
  const { data: debugData } = trpc.acc.debugHubsRaw.useQuery(
    { accessToken: accessToken! },
    { enabled: !!accessToken }
  );
  console.log("[ACC Debug] Raw API response:", debugData);

  // List hubs
  console.log("[ACC Dialog] Access token state:", accessToken ? "SET" : "NOT SET");
  const { data: hubs, isLoading: isLoadingHubs } = trpc.acc.listHubs.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId && isConnected }
  );
  console.log("[ACC Dialog] Hubs data:", hubs);

  // List projects
  const { data: projects, isLoading: isLoadingProjects } = trpc.acc.listProjects.useQuery(
    { accessToken: accessToken!, hubId: selectedHub },
    { enabled: !!accessToken && !!selectedHub }
  );

  // List top-level folders
  const { data: foldersData, isLoading: isLoadingFolders } = trpc.acc.listProjectFolders.useQuery(
    { accessToken: accessToken!, hubId: selectedHub, projectId: selectedProject },
    { enabled: !!accessToken && !!selectedHub && !!selectedProject }
  );

  // Initialize folder tree when project is selected
  useEffect(() => {
    if (foldersData?.folders) {
      setFolderTree(
        foldersData.folders.map((folder: any) => ({
          id: folder.id,
          name: folder.attributes?.name || folder.name || "Unnamed Folder",
          isExpanded: false,
        }))
      );
      setSelectedFiles(new Set());
      
      // Save project mapping when project is selected (if we have all required data)
      if (projectId && selectedHub && selectedProject && isConnected) {
        const hubName = hubs?.hubs?.find((h: any) => h.id === selectedHub)?.name || "";
        const projectName = projects?.projects?.find((p: any) => p.id === selectedProject)?.name || "";
        
        if (hubName && projectName) {
          saveProjectMappingMutation.mutate({
            projectId,
            accHubId: selectedHub,
            accHubName: hubName,
            accProjectId: selectedProject,
            accProjectName: projectName,
          });
        }
      }
    }
  }, [foldersData, projectId, selectedHub, selectedProject, isConnected, hubs, projects]);

  // Handle OAuth
  const handleAuthenticate = () => {
    if (!authData?.authUrl) return;

    setIsAuthenticating(true);
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const authWindow = window.open(
      authData.authUrl,
      "ACC Authorization",
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // Listen for OAuth callback with authorization code
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "ACC_AUTH_SUCCESS" && event.data.code) {
        // Exchange the authorization code for an access token
        exchangeCodeMutation.mutate({
          code: event.data.code,
          redirectUri: window.location.origin + "/api/acc/oauth/callback",
          projectId: projectId || undefined,
        });
        window.removeEventListener("message", handleMessage);
      } else if (event.data.type === "ACC_AUTH_ERROR") {
        setIsAuthenticating(false);
        toast.error(`Authentication error: ${event.data.error}`);
        window.removeEventListener("message", handleMessage);
      }
    };

    window.addEventListener("message", handleMessage);

    // Check if window was closed
    const checkClosed = setInterval(() => {
      if (authWindow?.closed) {
        clearInterval(checkClosed);
        setIsAuthenticating(false);
        window.removeEventListener("message", handleMessage);
      }
    }, 500);
  };

  // Get tRPC utils for manual queries
  const utils = trpc.useUtils();

  // Toggle folder expansion and load contents
  const toggleFolder = async (folderId: string) => {
    const updateTree = (nodes: FolderNode[]): FolderNode[] => {
      return nodes.map((node) => {
        if (node.id === folderId) {
          return { ...node, isExpanded: !node.isExpanded, isLoading: !node.isExpanded && !node.children };
        }
        if (node.children) {
          return { ...node, children: updateTree(node.children) };
        }
        return node;
      });
    };

    setFolderTree(updateTree(folderTree));

    // Load folder contents if not already loaded
    const folder = findFolder(folderTree, folderId);
    if (folder && !folder.children && !folder.isExpanded) {
      try {
        const data = await utils.client.acc.listFolderContents.query({
          accessToken: accessToken!,
          projectId: selectedProject,
          folderId: folderId,
        });
        
        if (data) {
          const { folders, files } = data;
          
          const updateWithContents = (nodes: FolderNode[]): FolderNode[] => {
            return nodes.map((node) => {
              if (node.id === folderId) {
                return {
                  ...node,
                  isLoading: false,
                  children: folders?.map((f: any) => ({
                    id: f.id,
                    name: f.attributes?.name || f.name || "Unnamed Folder",
                    isExpanded: false,
                  })) || [],
                  files: files?.map((f: any) => ({
                    id: f.id,
                    name: f.attributes?.displayName || f.attributes?.name || f.name || "Unnamed File",
                    size: f.attributes?.storageSize || 0,
                    checked: false,
                  })) || [],
                };
              }
              if (node.children) {
                return { ...node, children: updateWithContents(node.children) };
              }
              return node;
            });
          };

          setFolderTree(updateWithContents(folderTree));
        }
      } catch (error) {
        console.error("Failed to load folder contents:", error);
        toast.error("Failed to load folder contents");
        
        // Remove loading state on error
        const removeLoading = (nodes: FolderNode[]): FolderNode[] => {
          return nodes.map((node) => {
            if (node.id === folderId) {
              return { ...node, isLoading: false };
            }
            if (node.children) {
              return { ...node, children: removeLoading(node.children) };
            }
            return node;
          });
        };
        setFolderTree(removeLoading(folderTree));
      }
    }
  };

  // Helper to find folder in tree
  const findFolder = (nodes: FolderNode[], id: string): FolderNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findFolder(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Load project folders when project is selected
  const { data: projectFolders } = trpc.acc.listProjectFolders.useQuery(
    {
      accessToken: accessToken!,
      hubId: selectedHub,
      projectId: selectedProject,
    },
    {
      enabled: !!selectedProject && !!selectedHub && !!accessToken,
    }
  );

  // Update folder tree when folders are loaded
  useEffect(() => {
    if (projectFolders) {
      const rootFolders: FolderNode[] = projectFolders.folders.map((folder: any) => ({
        id: folder.id,
        name: folder.name,
        isExpanded: false,
        children: undefined,
        files: [],
      }));
      setFolderTree(rootFolders);
    } else if (!selectedProject) {
      setFolderTree([]);
      setSelectedFiles(new Set());
      setSelectedFileDetails(new Map());
    }
  }, [projectFolders, selectedProject]);

  // Sync files mutation
  const syncFilesMutation = trpc.acc.syncFiles.useMutation({
    onSuccess: (data) => {
      const successCount = data.results.filter((r: any) => r.success).length;
      const skippedResults = data.results.filter((r: any) => !r.success && r.skipped);
      const skippedCount = skippedResults.length;
      const skippedFiles = skippedResults.map((r: any) => r.fileName);
      const failCount = data.results.filter((r: any) => !r.success && !r.skipped).length;
      
      // Show success dialog
      setSyncResult({ successCount, failCount, skippedCount, skippedFiles });
      setShowSuccessDialog(true);
      
      // Clear selection
      setSelectedFiles(new Set());
      setSelectedFileDetails(new Map());
    },
    onError: (error) => {
      toast.error(`Failed to sync files: ${error.message}`);
    },
  });

  // Toggle file selection
  const toggleFileSelection = (fileId: string, fileName: string) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
    
    setSelectedFileDetails((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(fileId)) {
        newMap.delete(fileId);
      } else {
        newMap.set(fileId, { name: fileName });
      }
      return newMap;
    });
  };

  // Render folder tree
  const renderFolderTree = (nodes: FolderNode[], depth = 0) => {
    return nodes.map((node) => (
      <div key={node.id} style={{ marginLeft: `${depth * 20}px` }}>
        <div
          className="flex items-center gap-2 py-2 px-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
          onClick={() => toggleFolder(node.id)}
        >
          {node.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : node.isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Folder className="h-4 w-4 text-blue-500" />
          <span className="text-sm">{node.name}</span>
        </div>

        {node.isExpanded && node.files && node.files.length > 0 && (
          <div style={{ marginLeft: `${(depth + 1) * 20}px` }}>
            {node.files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-2 py-2 px-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
              >
                <Checkbox
                  checked={selectedFiles.has(file.id)}
                  onCheckedChange={() => toggleFileSelection(file.id, file.name)}
                />
                <File className="h-4 w-4 text-gray-500" />
                <span className="text-sm flex-1">{file.name}</span>
                <span className="text-xs text-gray-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            ))}
          </div>
        )}

        {node.isExpanded && node.children && renderFolderTree(node.children, depth + 1)}
      </div>
    ));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>ACC Project Browser</CardTitle>
        <CardDescription>
          Browse and select files from Autodesk Construction Cloud
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!accessToken ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              {storedCreds?.isExpired
                ? "Your ACC session has expired. Please reconnect."
                : "You need to authenticate with Autodesk to access your ACC projects"}
            </p>
            <Button
              onClick={handleAuthenticate}
              disabled={isAuthenticating || !authData}
              className="w-full"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : storedCreds?.isExpired ? (
                "Reconnect to ACC"
              ) : (
                "Connect to ACC"
              )}
            </Button>
          </div>
        ) : (
          <>
            {/* Always show disconnect button when we have an access token */}
            <div className="mb-4 p-3 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {storedMapping?.hasMapping ? "Connected to ACC" : "ACC Authentication Active"}
                  </p>
                  {storedMapping?.hasMapping && (
                    <p className="text-xs text-muted-foreground">
                      {storedMapping.accProjectName} ({storedMapping.accHubName})
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm("Are you sure you want to disconnect from ACC? You'll need to reconnect to sync files.")) {
                      disconnectMutation.mutate({ projectId: projectId! });
                    }
                  }}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
                </Button>
              </div>
            </div>

            {/* Show error state if hubs failed to load or are empty */}
            {!isLoadingHubs && (!hubs?.hubs || hubs.hubs.length === 0) && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
                <p className="text-sm text-amber-900 dark:text-amber-100">
                  No ACC hubs found. This may be due to:
                </p>
                <ul className="text-xs text-amber-700 dark:text-amber-300 list-disc ml-4 mt-1">
                  <li>Expired or invalid authentication token</li>
                  <li>No ACC projects assigned to your account</li>
                  <li>Insufficient permissions</li>
                </ul>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    disconnectMutation.mutate({ projectId: projectId! });
                  }}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect & Reconnect"}
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="hub">Select Hub</Label>
              <Select value={selectedHub} onValueChange={setSelectedHub} disabled={isLoadingHubs}>
                <SelectTrigger id="hub">
                  <SelectValue placeholder={isLoadingHubs ? "Loading hubs..." : hubs?.hubs?.length ? "Select a hub" : "No hubs available"} />
                </SelectTrigger>
                <SelectContent>
                  {hubs?.hubs?.map((hub: any) => (
                    <SelectItem key={hub.id} value={hub.id}>
                      {hub.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedHub && (
              <div className="space-y-2">
                <Label htmlFor="project">Select Project</Label>
                <Select value={selectedProject} onValueChange={setSelectedProject} disabled={isLoadingProjects}>
                  <SelectTrigger id="project">
                    <SelectValue placeholder={isLoadingProjects ? "Loading projects..." : "Select a project"} />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.projects?.map((project: any) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedProject && folderTree.length > 0 && (
              <div className="space-y-4">
                <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                  <div className="text-sm font-medium mb-2">Project Files</div>
                  {isLoadingFolders ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    renderFolderTree(folderTree)
                  )}
                </div>

                {selectedFiles.size > 0 && (
                  <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                        {selectedFiles.size} file(s) selected
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                        Ready to sync to project
                      </p>
                    </div>
                    <Button 
                      className="bg-orange-500 hover:bg-orange-600"
                      onClick={() => {
                        if (!projectId) {
                          toast.error("No project selected");
                          return;
                        }
                        
                        const files = Array.from(selectedFiles).map((id) => ({
                          id,
                          name: selectedFileDetails.get(id)?.name || "unknown",
                        }));
                        
                        syncFilesMutation.mutate({
                          accessToken: accessToken!,
                          projectId: selectedProject,
                          files,
                          targetProjectId: projectId,
                        });
                      }}
                      disabled={syncFilesMutation.isPending}
                    >
                      {syncFilesMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <Download className="mr-2 h-4 w-4" />
                          Sync Selected Files
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <DialogTitle>
                  {syncResult?.failCount === 0 ? "Sync Successful!" : "Sync Complete"}
                </DialogTitle>
                <DialogDescription>
                  {syncResult?.failCount === 0 && syncResult?.skippedCount === 0
                    ? `Successfully synced ${syncResult?.successCount} file(s) from ACC.`
                    : syncResult?.skippedCount && syncResult.skippedCount > 0
                    ? `Synced ${syncResult?.successCount} file(s). ${syncResult?.skippedCount} skipped (already exist): ${syncResult?.skippedFiles?.join(", ")}`
                    : `Synced ${syncResult?.successCount} file(s), ${syncResult?.failCount} failed.`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowSuccessDialog(false);
              }}
            >
              Upload More Files
            </Button>
            <Button
              onClick={() => {
                setShowSuccessDialog(false);
                navigate(`/processing-status?projectId=${projectId}`);
              }}
            >
              Process Documents
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
