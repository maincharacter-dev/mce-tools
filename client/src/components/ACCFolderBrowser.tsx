import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Folder, File, ChevronRight, ChevronDown, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ACCFolderBrowserProps {
  onFilesSelected: (files: Array<{ id: string; name: string; size: number }>) => void;
}

interface FolderNode {
  id: string;
  name: string;
  isExpanded: boolean;
  isLoading?: boolean;
  children?: FolderNode[];
  files?: Array<{ id: string; name: string; size: number; checked: boolean }>;
}

export function ACCFolderBrowser({ onFilesSelected }: ACCFolderBrowserProps) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [selectedHub, setSelectedHub] = useState<string>("");
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [folderTree, setFolderTree] = useState<FolderNode[]>([]);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Get OAuth URL
  const { data: authData } = trpc.acc.getAuthUrl.useQuery(
    { redirectUri: `${window.location.origin}/api/acc/oauth/callback` },
    { enabled: !accessToken }
  );

  // Exchange code mutation
  const exchangeCodeMutation = trpc.acc.exchangeCode.useMutation({
    onSuccess: (tokens) => {
      setAccessToken(tokens.access_token);
      setIsAuthenticating(false);
      toast.success("Successfully authenticated with ACC!");
    },
    onError: (error) => {
      setIsAuthenticating(false);
      toast.error(`Authentication failed: ${error.message}`);
    },
  });

  // Fetch hubs
  const { data: hubsData, isLoading: hubsLoading } = trpc.acc.listHubs.useQuery(
    { accessToken: accessToken! },
    { enabled: !!accessToken }
  );

  // Fetch projects
  const { data: projectsData, isLoading: projectsLoading } = trpc.acc.listProjects.useQuery(
    { accessToken: accessToken!, hubId: selectedHub },
    { enabled: !!accessToken && !!selectedHub }
  );

  // Fetch top-level folders
  const { data: foldersData, isLoading: foldersLoading } = trpc.acc.listProjectFolders.useQuery(
    { accessToken: accessToken!, hubId: selectedHub, projectId: selectedProject },
    { enabled: !!accessToken && !!selectedHub && !!selectedProject }
  );

  // Initialize folder tree when top-level folders are fetched
  useEffect(() => {
    if (foldersData?.folders) {
      setFolderTree(
        foldersData.folders.map((folder: any) => ({
          id: folder.id,
          name: folder.attributes?.name || folder.name || "Unnamed Folder",
          isExpanded: false,
        }))
      );
    }
  }, [foldersData]);

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

    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "ACC_AUTH_SUCCESS" && event.data.code) {
        exchangeCodeMutation.mutate({
          code: event.data.code,
          redirectUri: `${window.location.origin}/acc/callback`,
        });
        window.removeEventListener("message", handleMessage);
      } else if (event.data.type === "ACC_AUTH_ERROR") {
        setIsAuthenticating(false);
        toast.error(`Authentication error: ${event.data.error}`);
        window.removeEventListener("message", handleMessage);
      }
    };

    window.addEventListener("message", handleMessage);

    const checkClosed = setInterval(() => {
      if (authWindow?.closed) {
        clearInterval(checkClosed);
        setIsAuthenticating(false);
        window.removeEventListener("message", handleMessage);
      }
    }, 500);
  };

  // Expand/collapse folder
  const handleFolderClick = async (folderId: string) => {
    const isExpanded = expandedFolders.has(folderId);
    
    if (isExpanded) {
      // Collapse
      const newExpanded = new Set(expandedFolders);
      newExpanded.delete(folderId);
      setExpandedFolders(newExpanded);
      
      const updateFolder = (nodes: FolderNode[]): FolderNode[] => {
        return nodes.map((node) => {
          if (node.id === folderId) {
            return { ...node, isExpanded: false };
          }
          if (node.children) {
            return { ...node, children: updateFolder(node.children) };
          }
          return node;
        });
      };
      setFolderTree((prev) => updateFolder(prev));
    } else {
      // Expand and load contents
      const newExpanded = new Set(expandedFolders);
      newExpanded.add(folderId);
      setExpandedFolders(newExpanded);
      
      // Mark as loading
      const updateFolder = (nodes: FolderNode[]): FolderNode[] => {
        return nodes.map((node) => {
          if (node.id === folderId) {
            return { ...node, isExpanded: true, isLoading: true };
          }
          if (node.children) {
            return { ...node, children: updateFolder(node.children) };
          }
          return node;
        });
      };
      setFolderTree((prev) => updateFolder(prev));
      
      // Load contents
      try {
        const response = await fetch(
          `/api/trpc/acc.listFolderContents?input=${encodeURIComponent(
            JSON.stringify({
              accessToken,
              projectId: selectedProject,
              folderId,
            })
          )}`
        );
        const data = await response.json();
        const contents = data.result.data;
        
        const updateWithContents = (nodes: FolderNode[]): FolderNode[] => {
          return nodes.map((node) => {
            if (node.id === folderId) {
              return {
                ...node,
                isLoading: false,
                children: contents.folders?.map((folder: any) => ({
                  id: folder.id,
                  name: folder.attributes?.name || folder.name || "Unnamed Folder",
                  isExpanded: false,
                })) || [],
                files: contents.files?.map((file: any) => ({
                  id: file.id,
                  name: file.attributes?.displayName || file.name || "Unnamed File",
                  size: file.attributes?.storageSize || 0,
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
        setFolderTree((prev) => updateWithContents(prev));
      } catch (error) {
        console.error("Failed to load folder contents:", error);
        toast.error("Failed to load folder contents");
        
        // Mark as not loading
        const updateFolder = (nodes: FolderNode[]): FolderNode[] => {
          return nodes.map((node) => {
            if (node.id === folderId) {
              return { ...node, isLoading: false };
            }
            if (node.children) {
              return { ...node, children: updateFolder(node.children) };
            }
            return node;
          });
        };
        setFolderTree((prev) => updateFolder(prev));
      }
    }
  };

  // Toggle file checkbox
  const handleFileCheck = (fileId: string, checked: boolean) => {
    const updateFiles = (nodes: FolderNode[]): FolderNode[] => {
      return nodes.map((node) => {
        if (node.files) {
          return {
            ...node,
            files: node.files.map((file) =>
              file.id === fileId ? { ...file, checked } : file
            ),
          };
        }
        if (node.children) {
          return { ...node, children: updateFiles(node.children) };
        }
        return node;
      });
    };

    setFolderTree((prev) => updateFiles(prev));
  };

  // Get all selected files
  const getSelectedFiles = (nodes: FolderNode[]): Array<{ id: string; name: string; size: number }> => {
    let selected: Array<{ id: string; name: string; size: number }> = [];
    for (const node of nodes) {
      if (node.files) {
        selected.push(...node.files.filter((f) => f.checked).map(({ checked, ...file }) => file));
      }
      if (node.children) {
        selected.push(...getSelectedFiles(node.children));
      }
    }
    return selected;
  };

  // Render folder tree
  const renderFolderTree = (nodes: FolderNode[], depth = 0) => {
    return nodes.map((node) => (
      <div key={node.id} style={{ marginLeft: `${depth * 20}px` }}>
        <div
          className="flex items-center gap-2 py-2 px-2 hover:bg-slate-800/50 rounded cursor-pointer"
          onClick={() => handleFolderClick(node.id)}
        >
          {node.isLoading ? (
            <Loader2 className="h-4 w-4 text-slate-400 animate-spin" />
          ) : node.isExpanded ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-400" />
          )}
          <Folder className="h-4 w-4 text-orange-400" />
          <span className="text-sm text-slate-200">{node.name}</span>
        </div>
        {node.isExpanded && node.files && (
          <div style={{ marginLeft: `${(depth + 1) * 20}px` }}>
            {node.files.map((file) => (
              <div key={file.id} className="flex items-center gap-2 py-2 px-2 hover:bg-slate-800/50 rounded">
                <Checkbox
                  checked={file.checked}
                  onCheckedChange={(checked) => handleFileCheck(file.id, checked as boolean)}
                />
                <File className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-slate-300">{file.name}</span>
                <span className="text-xs text-slate-500 ml-auto">
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

  const selectedFiles = getSelectedFiles(folderTree);

  if (!accessToken) {
    return (
      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white">Connect to ACC</CardTitle>
          <CardDescription className="text-slate-400">
            Authenticate with Autodesk to browse your ACC projects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleAuthenticate} 
            className="w-full"
            disabled={isAuthenticating || !authData?.authUrl}
          >
            {isAuthenticating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Authenticating...
              </>
            ) : (
              "Authenticate with Autodesk"
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hub Selection */}
      <Card className="bg-slate-900/50 border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-white text-sm">Select Hub</CardTitle>
        </CardHeader>
        <CardContent>
          {hubsLoading ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading hubs...</span>
            </div>
          ) : (
            <Select value={selectedHub} onValueChange={setSelectedHub}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue placeholder="Select a hub" />
              </SelectTrigger>
              <SelectContent>
                {hubsData?.hubs?.map((hub: any) => (
                  <SelectItem key={hub.id} value={hub.id}>
                    {hub.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* Project Selection */}
      {selectedHub && (
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white text-sm">Select Project</CardTitle>
          </CardHeader>
          <CardContent>
            {projectsLoading ? (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading projects...</span>
              </div>
            ) : (
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projectsData?.projects?.map((project: any) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>
      )}

      {/* Folder Browser */}
      {selectedProject && (
        <Card className="bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white text-sm">Browse Folders</CardTitle>
            <CardDescription className="text-slate-400">
              Select files to sync ({selectedFiles.length} selected)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {foldersLoading ? (
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading folders...</span>
              </div>
            ) : folderTree.length > 0 ? (
              <div className="max-h-96 overflow-y-auto">{renderFolderTree(folderTree)}</div>
            ) : (
              <p className="text-sm text-slate-400">No folders found in this project</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sync Button */}
      {selectedFiles.length > 0 && (
        <Button
          onClick={() => onFilesSelected(selectedFiles)}
          className="w-full bg-orange-600 hover:bg-orange-700"
        >
          Sync {selectedFiles.length} Selected File{selectedFiles.length !== 1 ? "s" : ""}
        </Button>
      )}
    </div>
  );
}
