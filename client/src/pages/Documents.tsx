import { useLocation, useParams } from "wouter";
import { trpc } from "../lib/trpc";
import { useAuth } from "../_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Download, Trash2, AlertCircle, CheckCircle, Clock, Edit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export function Documents() {
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const params = useParams();

  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [newDocType, setNewDocType] = useState<string>("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState<any>(null);
  
  // Get projectId from URL path params
  const projectId = params.id as string;

  // Fetch project details
  const { data: project, isLoading: projectLoading } = trpc.projects.get.useQuery(
    { projectId: parseInt(projectId || "0") },
    { enabled: !!projectId && isAuthenticated }
  );

  // Fetch documents list
  const { data: documents, isLoading: docsLoading, refetch } = trpc.documents.list.useQuery(
    { projectId: projectId || "0" },
    { enabled: !!projectId && isAuthenticated }
  );

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
              <p className="text-muted-foreground">Project: {project.name}</p>
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
            </div>

            {documents.map((doc: any) => (
              <Card key={doc.id} className="p-6 hover:border-orange-500/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
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
