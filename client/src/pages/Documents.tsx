import { useLocation, useParams } from "wouter";
import { trpc } from "../lib/trpc";
import { useAuth } from "../_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Download, Trash2, AlertCircle, CheckCircle, Clock, Edit, RefreshCw, Cloud, ExternalLink, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";

export function Documents() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const params = useParams();

  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [newDocType, setNewDocType] = useState<string>("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<any>(null);
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());
  const [batchSyncing, setBatchSyncing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  
  // Get projectId from URL path params
  const projectId = params.id as string;

  // Fetch project details
  const { data: project, isLoading: projectLoading } = trpc.projects.get.useQuery(
    { projectId: String(projectId || 0) },
    { enabled: !!projectId && isAuthenticated }
  );

  // Fetch documents list
  const { data: documents, isLoading: docsLoading, refetch } = trpc.documents.list.useQuery(
    { projectId: String(projectId || 0) },
    { enabled: !!projectId && isAuthenticated }
  );

  // Fetch sync status for all documents
  const documentIds = documents?.map((d: any) => d.id) || [];
  const { data: syncStatuses } = (trpc.acc as any).getSyncStatus.useQuery(
    { projectId: parseInt(projectId || "0"), documentIds },
    { enabled: !!projectId && documentIds.length > 0 && isAuthenticated }
  );

  // Batch sync mutation
  const batchSyncMutation = (trpc.acc as any).batchSync.useMutation({
    onSuccess: (result: any) => {
      setBatchSyncing(false);
      alert(`Batch sync complete!\nSucceeded: ${result.succeeded}\nFailed: ${result.failed}`);
      setSelectedDocs(new Set());
      refetch();
    },
    onError: (error: any) => {
      setBatchSyncing(false);
      alert(`Batch sync failed: ${error.message}`);
    },
  });

  // Update document type mutation
  const updateDocTypeMutation = trpc.documents.updateDocumentType.useMutation({
    onSuccess: () => {
      alert("Document type updated successfully");
      setEditingDoc(null);
      refetch();
    },
    onError: (error) => {
      alert(`Error: ${error.message || "Failed to update document type"}`);
    },
  });

  // Sync to ACC mutation
  const syncToACCMutation = trpc.documents.syncToACC.useMutation({
    onSuccess: (result: any) => {
      if (result?.success) {
        alert(`Successfully synced to ACC!\nACC File: ${result.accFileName || 'Unknown'}\nFolder: ${result.accFolderPath || 'Unknown'}`);
        refetch();
      } else {
        alert(`Sync failed: ${result?.error || "Unknown error"}`);
      }
    },
    onError: (error: any) => {
      alert(`Sync failed: ${error.message || "Failed to sync to ACC"}`);
    },
  });

  // Retry processing mutation
  const retryProcessingMutation = trpc.documents.retryProcessing.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        refetch();
      } else {
        alert(`Error: ${result.error || "Failed to retry processing"}`);
      }
    },
    onError: (error) => {
      alert(`Error: ${error.message || "Failed to retry processing"}`);
    },
  });

  // NOTE: Processing is now triggered ONLY from ProcessingStatus page
  // This page just displays document status - no processing triggers here
  // This prevents duplicate processing race conditions
  
  // Auto-refresh documents list to show updated status
  useEffect(() => {
    if (!documents || !projectId || !isAuthenticated) return;

    // Check if there are any documents being processed
    const hasProcessing = documents.some(
      (doc: any) => doc.status === 'processing' || doc.status === 'queued' || 
                    doc.status === 'Processing' || doc.status === 'Queued'
    );

    if (!hasProcessing) return;

    // Poll for status updates every 3 seconds (display only, no processing trigger)
    const interval = setInterval(() => {
      refetch();
    }, 3000);

    return () => clearInterval(interval);
  }, [documents, projectId, isAuthenticated, refetch]);

  // Delete document mutation
  const deleteMutation = trpc.documents.delete.useMutation({
    onSuccess: () => {
      alert("Document deleted successfully");
      setDeleteConfirmOpen(false);
      setDocToDelete(null);
      refetch();
    },
    onError: (error) => {
      alert(`Error: ${error.message || "Failed to delete document"}`);
    },
  });

  const handleEditDocType = (doc: any) => {
    setEditingDoc(doc);
    setNewDocType(doc.documentType);
  };

  const handleSaveDocType = async () => {
    if (!editingDoc || !newDocType) return;
    await updateDocTypeMutation.mutateAsync({
      projectId: projectId || "0",
      documentId: editingDoc.id,
      documentType: newDocType as any,
    });
  };

  const DOCUMENT_TYPES = [
    { value: "IM", label: "Information Memorandum" },
    { value: "DD_PACK", label: "Due Diligence Pack" },
    { value: "CONTRACT", label: "Contract" },
    { value: "GRID_STUDY", label: "Grid Study" },
    { value: "PLANNING", label: "Planning Document" },
    { value: "CONCEPT_DESIGN", label: "Concept Design" },
    { value: "OTHER", label: "Other" },
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <h2 className="text-2xl font-bold mb-4">Authentication Required</h2>
          <p className="text-muted-foreground mb-6">Please log in to view documents.</p>
          <Button onClick={() => setLocation("/")}>Go to Home</Button>
        </Card>
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <Card className="p-8 max-w-md">
          <h2 className="text-2xl font-bold mb-4">No Project Selected</h2>
          <p className="text-muted-foreground mb-6">Please select a project to view documents.</p>
          <Button onClick={() => setLocation("/projects")}>Go to Projects</Button>
        </Card>
      </div>
    );
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Uploaded":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "Processing":
        return <Clock className="h-4 w-4 text-blue-500 animate-spin" />;
      case "Error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      Uploaded: "default",
      Processing: "secondary",
      Error: "destructive",
    };
    return (
      <Badge variant={variants[status] || "outline"} className="flex items-center gap-1">
        {getStatusIcon(status)}
        {status}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto py-4 flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => setLocation(`/project-dashboard?projectId=${projectId}`)} className="mb-2">
              ← Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold text-white">Documents</h1>
            {project && (
              <p className="text-muted-foreground">Project: {project.projectName}</p>
            )}
          </div>
          <Button onClick={() => setLocation(`/project/${projectId}/upload`)}>
            Upload New Document
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto py-8">
        {projectLoading || docsLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
            <p className="text-muted-foreground mt-4">Loading documents...</p>
          </div>
        ) : !documents || documents.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">No Documents Yet</h2>
            <p className="text-muted-foreground mb-6">
              Upload your first document to get started.
            </p>
            <Button onClick={() => setLocation(`/project/${projectId}/upload`)}>
              Upload Document
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">
                {documents.length} Document{documents.length !== 1 ? "s" : ""}
              </h2>
              {selectedDocs.size > 0 && (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground">
                    {selectedDocs.size} selected
                  </span>
                  <Button
                    onClick={() => {
                      setBatchSyncing(true);
                      setBatchProgress({ current: 0, total: selectedDocs.size });
                      batchSyncMutation.mutate({
                        projectId: parseInt(projectId),
                        documentIds: Array.from(selectedDocs),
                        documentType: 'AUTO',
                      });
                    }}
                    disabled={batchSyncing}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {batchSyncing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Syncing {batchProgress.current}/{batchProgress.total}...
                      </>
                    ) : (
                      <>
                        <Cloud className="h-4 w-4 mr-2" />
                        Sync Selected to ACC
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedDocs(new Set())}
                    disabled={batchSyncing}
                  >
                    Clear Selection
                  </Button>
                </div>
              )}
            </div>

            {documents.map((doc: any) => (
              <Card key={doc.id} className="p-6 hover:border-orange-500/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {/* Checkbox for batch selection */}
                    <input
                      type="checkbox"
                      checked={selectedDocs.has(doc.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedDocs);
                        if (e.target.checked) {
                          newSelected.add(doc.id);
                        } else {
                          newSelected.delete(doc.id);
                        }
                        setSelectedDocs(newSelected);
                      }}
                      disabled={batchSyncing}
                      className="mt-4 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="p-3 bg-orange-500/10 rounded-lg">
                      <FileText className="h-6 w-6 text-orange-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-white mb-1">
                        {doc.fileName}
                      </h3>
                      <div className="flex flex-wrap gap-2 mb-2">
                        <Badge variant="outline">{doc.documentType}</Badge>
                        {getStatusBadge(doc.status)}
                        {/* Sync status badge */}
                        {(() => {
                          const syncStatus = syncStatuses?.find((s: any) => s.document_id === doc.id);
                          if (syncStatus && syncStatus.upload_status === 'completed') {
                            return (
                              <Badge
                                variant="outline"
                                className="bg-green-500/10 text-green-500 border-green-500/50 cursor-pointer hover:bg-green-500/20"
                                onClick={() => {
                                  if (syncStatus.acc_web_view_url) {
                                    window.open(syncStatus.acc_web_view_url, '_blank');
                                  }
                                }}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Synced to ACC
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </Badge>
                            );
                          }
                          return null;
                        })()}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>Size: {formatFileSize(doc.fileSizeBytes)}</p>
                        <p>Uploaded: {formatDate(doc.uploadDate)}</p>
                        {doc.pageCount && <p>Pages: {doc.pageCount}</p>}
                        {doc.processingError && (
                          <p className="text-red-500">Error: {doc.processingError}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {/* Sync to ACC button for completed documents */}
                    {(doc.status === 'completed' || doc.status === 'Completed') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (projectId) {
                            syncToACCMutation.mutate({
                              projectId: projectId,
                              documentId: doc.id,
                            });
                          }
                        }}
                        disabled={syncToACCMutation.isPending}
                        title="Sync to ACC"
                        className="text-blue-500 border-blue-500/50 hover:bg-blue-500/10"
                      >
                        <Cloud className={`h-4 w-4 ${syncToACCMutation.isPending ? 'animate-pulse' : ''}`} />
                      </Button>
                    )}
                    {/* Show retry button for failed, stuck, or completed documents */}
                    {(doc.status === 'failed' || doc.status === 'Failed' || 
                      doc.status === 'completed' || doc.status === 'Completed' ||
                      doc.status === 'uploaded' || doc.status === 'Uploaded') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (projectId) {
                            retryProcessingMutation.mutate({
                              projectId: projectId,
                              documentId: doc.id,
                            });
                          }
                        }}
                        disabled={retryProcessingMutation.isPending}
                        title="Retry processing"
                        className="text-orange-500 border-orange-500/50 hover:bg-orange-500/10"
                      >
                        <RefreshCw className={`h-4 w-4 ${retryProcessingMutation.isPending ? 'animate-spin' : ''}`} />
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditDocType(doc)}
                      title="Edit document type"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // TODO: Implement download
                        console.log("Download", doc.id);
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDocToDelete(doc);
                        setDeleteConfirmOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Document Type Dialog */}
      <Dialog open={!!editingDoc} onOpenChange={(open) => !open && setEditingDoc(null)}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Document Type</DialogTitle>
            <DialogDescription className="text-slate-400">
              Change the document type for: {editingDoc?.fileName}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Document Type
            </label>
            <Select value={newDocType} onValueChange={setNewDocType}>
              <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700">
                {DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value} className="text-white focus:bg-slate-800">
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDoc(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveDocType} 
              disabled={updateDocTypeMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {updateDocTypeMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              Delete Document?
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              This will permanently delete "{docToDelete?.fileName}" and all associated insights. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteConfirmOpen(false);
                setDocToDelete(null);
              }}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (docToDelete && projectId) {
                  deleteMutation.mutate({
                    projectId: projectId,
                    documentId: docToDelete.id
                  });
                }
              }}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
