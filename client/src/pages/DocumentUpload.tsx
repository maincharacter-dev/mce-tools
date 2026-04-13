import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ACCProjectBrowser } from "@/components/ACCProjectBrowser";
import { trpc } from "@/lib/trpc";
import { Upload, File, AlertCircle, CheckCircle, Loader2, X, ArrowLeft, Linkedin, Menu } from "lucide-react";
import { ExtractionProgressBar } from "@/components/ExtractionProgressBar";
import { useState, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import pako from "pako";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  suggestedType?: string; // AI-suggested type based on filename
  confidence?: 'high' | 'medium' | 'low';
  progress: number;
  status: "pending" | "uploading" | "completed" | "error" | "extracting";
  error?: string;
  documentId?: string;
}

// Quick filename-based classification for immediate feedback
function quickClassifyFilename(filename: string): { type: string; confidence: 'high' | 'medium' | 'low' } {
  const lowerName = filename.toLowerCase();
  
  // High confidence patterns
  if (/\bim\b|investment[_\s-]*memo|information[_\s-]*memo|teaser/i.test(lowerName)) {
    return { type: 'IM', confidence: 'high' };
  }
  if (/\bdd\b|due[_\s-]*diligence|diligence[_\s-]*pack|data[_\s-]*room/i.test(lowerName)) {
    return { type: 'DD_PACK', confidence: 'high' };
  }
  if (/contract|agreement|\bppa\b|\bepc\b|\bo&m\b|lease/i.test(lowerName)) {
    return { type: 'CONTRACT', confidence: 'high' };
  }
  if (/grid[_\s-]*study|grid[_\s-]*connection|connection[_\s-]*study|\bgca\b|load[_\s-]*flow|fault[_\s-]*level/i.test(lowerName)) {
    return { type: 'GRID_STUDY', confidence: 'high' };
  }
  if (/feasib|energy[_\s-]*yield|yield[_\s-]*assessment|bankab|independent[_\s-]*engineer/i.test(lowerName)) {
    return { type: 'FEASIBILITY_STUDY', confidence: 'high' };
  }
  if (/concept[_\s-]*design|preliminary[_\s-]*design|layout|site[_\s-]*plan/i.test(lowerName)) {
    return { type: 'CONCEPT_DESIGN', confidence: 'high' };
  }
  if (/weather|\btmy\b|\bepw\b|solar[_\s-]*resource|irradiance|meteo|\bghi\b|\bdni\b/i.test(lowerName)) {
    return { type: 'WEATHER_FILE', confidence: 'high' };
  }
  // CSV files are almost always weather/data files in this context — let AI decide
  if (/\.csv$/i.test(lowerName)) {
    return { type: 'AUTO', confidence: 'low' };
  }
  
  // Medium confidence — let AI refine
  if (/report|study|analysis|assessment/i.test(lowerName)) {
    return { type: 'AUTO', confidence: 'medium' };
  }
  
  // Unknown — always defer to AI
  return { type: 'AUTO', confidence: 'low' };
}

const DOCUMENT_TYPES = [
  { value: "AUTO", label: "🤖 Auto-detect (AI)" },
  { value: "IM", label: "Investment Memorandum" },
  { value: "DD_PACK", label: "Due Diligence Pack" },
  { value: "CONTRACT", label: "Contract" },
  { value: "FEASIBILITY_STUDY", label: "Feasibility Study" },
  { value: "GRID_STUDY", label: "Grid Study" },
  { value: "CONCEPT_DESIGN", label: "Concept Design" },
  { value: "WEATHER_FILE", label: "Weather File" },
  { value: "OTHER", label: "Other" },
];

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".doc", ".xls", ".txt", ".pptx", ".csv"];

export default function DocumentUpload() {
  const { user, isAuthenticated } = useAuth();
  const [, params] = useRoute("/project/:id/upload");
  const [, setLocation] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const projectId = params?.id ? parseInt(params.id) : null;
  const [selectedType, setSelectedType] = useState("AUTO");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileObjectsRef = useRef<Map<string, File>>(new Map());
  
  // Upload mutation
  const uploadMutation = trpc.documents.upload.useMutation({
    onSuccess: (data, variables) => {
      // Mark file as extracting and store document ID
      setUploadedFiles(prev => prev.map(f => 
        f.name === variables.fileName ? { ...f, status: 'extracting', progress: 100, documentId: data.documentId } : f
      ));
    },
    onError: (error, variables) => {
      // Mark file as error
      setUploadedFiles(prev => prev.map(f => 
        f.name === variables.fileName ? { ...f, status: 'error', error: error.message } : f
      ));
    },
  });

  // Fetch project details
  const { data: project, isLoading: projectLoading } = trpc.projects.get.useQuery(
    { id: projectId || 0 },
    { enabled: !!projectId && isAuthenticated }
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <Card className="w-full max-w-md bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white">Authentication Required</CardTitle>
            <CardDescription className="text-slate-400">Please log in to upload documents.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
        <Card className="w-full max-w-md bg-slate-900/50 border-slate-700/50">
          <CardHeader>
            <CardTitle className="text-white">Project Not Found</CardTitle>
            <CardDescription className="text-slate-400">Please select a project first.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = e.dataTransfer.files;
    handleFiles(files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (files: FileList) => {
    const newFiles: UploadedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      const fileId = `${Date.now()}-${i}`;

      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        newFiles.push({
          id: fileId,
          name: file.name,
          size: file.size,
          type: selectedType,
          progress: 0,
          status: "error",
          error: `File type not supported. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
        });
      } else {
        // Quick classify by filename for immediate suggestion
        const classification = quickClassifyFilename(file.name);
        const suggestedType = classification.type;
        const confidence = classification.confidence;
        
        // Use suggested type if global is AUTO, otherwise use global selection
        const fileType = selectedType === 'AUTO' ? suggestedType : selectedType;
        
        newFiles.push({
          id: fileId,
          name: file.name,
          size: file.size,
          type: fileType,
          suggestedType,
          confidence,
          progress: 0,
          status: "pending",
        });
        // Store file object for later upload
        fileObjectsRef.current.set(fileId, file);
      }
    }

    setUploadedFiles([...uploadedFiles, ...newFiles]);
  };

  // Update individual file type
  const updateFileType = (fileId: string, newType: string) => {
    setUploadedFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, type: newType } : f
    ));
  };

  const removeFile = (id: string) => {
    setUploadedFiles(uploadedFiles.filter((f) => f.id !== id));
    fileObjectsRef.current.delete(id);
  };
  
  // Chunked upload mutations
  const initChunkedUploadMutation = trpc.documents.initChunkedUpload.useMutation();
  const uploadChunkMutation = trpc.documents.uploadChunk.useMutation();
  const finalizeChunkedUploadMutation = trpc.documents.finalizeChunkedUpload.useMutation();

  const CHUNK_SIZE = 512 * 1024; // 512KB chunks — keeps each request well within Cloudflare limits
  // Always use chunked upload to avoid Cloudflare 100s timeout on large base64 payloads

  const uploadFileChunked = async (fileInfo: UploadedFile, fileObj: File) => {
    const totalChunks = Math.ceil(fileObj.size / CHUNK_SIZE);
    
    try {
      // Initialize chunked upload
      const { uploadId } = await initChunkedUploadMutation.mutateAsync({
        projectId: String(projectId),
        fileName: fileObj.name,
        fileType: fileObj.type,
        fileSize: fileObj.size,
        documentType: fileInfo.type as any,
        totalChunks,
      });
      
      // Upload chunks in parallel batches of 3
      const PARALLEL_UPLOADS = 3;
      let completedChunks = 0;
      
      for (let batchStart = 0; batchStart < totalChunks; batchStart += PARALLEL_UPLOADS) {
        const batchEnd = Math.min(batchStart + PARALLEL_UPLOADS, totalChunks);
        const batchPromises = [];
        
        // Create batch of chunk uploads
        for (let chunkIndex = batchStart; chunkIndex < batchEnd; chunkIndex++) {
          const start = chunkIndex * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, fileObj.size);
          const chunk = fileObj.slice(start, end);
          
          // Convert chunk to base64, compress, and upload
          const uploadPromise = (async () => {
            // Read chunk as ArrayBuffer
            const arrayBuffer = await chunk.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Compress chunk
            const compressed = pako.deflate(uint8Array);
            
            // Convert compressed data to base64 in batches to avoid call stack overflow
            let binary = '';
            const chunkSize = 8192; // Process 8KB at a time
            for (let i = 0; i < compressed.length; i += chunkSize) {
              const slice = compressed.subarray(i, i + chunkSize);
              binary += String.fromCharCode.apply(null, Array.from(slice));
            }
            const base64 = btoa(binary);
            
            await uploadChunkMutation.mutateAsync({
              uploadId,
              chunkIndex,
              chunkData: base64,
            });
            
            completedChunks++;
            // Update progress
            const progress = Math.round((completedChunks / totalChunks) * 90); // Reserve 10% for finalization
            setUploadedFiles(prev => prev.map(f => 
              f.id === fileInfo.id ? { ...f, progress } : f
            ));
          })();
          
          batchPromises.push(uploadPromise);
        }
        
        // Wait for all chunks in this batch to complete
        await Promise.all(batchPromises);
      }
      
      // Finalize upload
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileInfo.id ? { ...f, progress: 95 } : f
      ));
      
      const result = await finalizeChunkedUploadMutation.mutateAsync({ uploadId });
      
      // Mark as completed
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileInfo.id ? { ...f, status: 'extracting', progress: 100, documentId: result.documentId } : f
      ));
      
      console.log('Chunked upload completed:', fileObj.name);
    } catch (error: any) {
      console.error('Chunked upload failed:', error);
      throw error;
    }
  };

  const uploadFileNormal = async (fileInfo: UploadedFile, fileObj: File) => {
    // Read file as base64
    const fileData = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(fileObj);
    });
    
    // Upload via tRPC with base64 data
    await uploadMutation.mutateAsync({
      projectId: String(projectId),
      fileName: fileObj.name,
      fileType: fileObj.type,
      fileSize: fileObj.size,
      documentType: fileInfo.type as any,
      fileData,
    });
  };

  const handleUploadAll = async () => {
    const filesToUpload = uploadedFiles.filter(f => f.status === 'pending');
    
    for (const fileInfo of filesToUpload) {
      const fileObj = fileObjectsRef.current.get(fileInfo.id);
      if (!fileObj) continue;
      
      // Mark as uploading
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileInfo.id ? { ...f, status: 'uploading', progress: 5 } : f
      ));
      
      try {
        // Always use chunked upload — avoids Cloudflare timeout on large base64 payloads
        console.log(`Uploading file in chunks: ${fileObj.name} (${fileObj.size} bytes)`);
        await uploadFileChunked(fileInfo, fileObj);
        
        console.log('Upload completed:', fileObj.name);
      } catch (error: any) {
        console.error('Upload failed:', error);
        setUploadedFiles(prev => prev.map(f => 
          f.id === fileInfo.id ? { ...f, status: 'error', error: error.message || 'Upload failed' } : f
        ));
      }
    }
    
    // Redirect to Processing Status page after all uploads complete
    // This allows users to watch the live processing console
    setTimeout(() => {
      setLocation(`/processing-status?projectId=${projectId}`);
    }, 1500);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

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
              onClick={() => setLocation("/projects")}
              className="text-slate-300 hover:text-orange-400 transition-colors font-medium"
            >
              My Projects
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
                    setLocation("/projects");
                    setIsMenuOpen(false);
                  }}
                  className="text-xl font-semibold text-slate-300 hover:text-white transition-colors py-2 text-left"
                >
                  My Projects
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
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation(`/project-dashboard?projectId=${projectId}`)}
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Upload Documents
          </h1>
          <p className="text-lg text-slate-300">
            {project ? `Project: ${project.projectName}` : "Loading project..."}
          </p>
        </div>

        <Tabs defaultValue="local" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-slate-800/50 mb-8 mx-auto">
            <TabsTrigger value="local" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
              Local Files
            </TabsTrigger>
            <TabsTrigger value="acc" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
              Sync from ACC
            </TabsTrigger>
          </TabsList>

          <TabsContent value="local">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Area */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-900/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white">Select Documents</CardTitle>
                <CardDescription className="text-slate-400">
                  Upload project documents (IMs, DD packs, contracts, grid studies, etc.)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Drag and Drop Area */}
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-lg p-12 text-center transition-all duration-300 ${
                    isDragActive
                      ? "border-orange-500 bg-orange-500/5"
                      : "border-slate-700 bg-slate-800/30 hover:border-orange-500/50"
                  }`}
                >
                  <Upload className="h-12 w-12 text-slate-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Drag and drop files here
                  </h3>
                  <p className="text-slate-400 mb-4">or click to browse</p>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileInput}
                    className="hidden"
                    id="file-input"
                    accept={ALLOWED_EXTENSIONS.join(",")}
                  />
                  <label htmlFor="file-input">
                    <Button asChild className="bg-orange-500 hover:bg-orange-600 text-white cursor-pointer">
                      <span>Select Files</span>
                    </Button>
                  </label>
                  <p className="text-xs text-slate-500 mt-4">
                    Supported: {ALLOWED_EXTENSIONS.join(", ")}
                  </p>
                </div>

                {/* Document Type Selector */}
                <div className="mt-8">
                  <label className="block text-sm font-medium text-slate-300 mb-3">
                    Document Type (applies to all uploads)
                  </label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
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
              </CardContent>
            </Card>
          </div>

          {/* Upload Queue */}
          <div className="lg:col-span-1">
            <Card className="bg-slate-900/50 border-slate-700/50 sticky top-24">
              <CardHeader>
                <CardTitle className="text-white">Upload Queue</CardTitle>
                <CardDescription className="text-slate-400">
                  {uploadedFiles.length} file{uploadedFiles.length !== 1 ? "s" : ""} selected
                </CardDescription>
              </CardHeader>
              <CardContent>
                {uploadedFiles.length === 0 ? (
                  <p className="text-slate-500 text-sm">No files selected yet</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {uploadedFiles.map((file) => (
                      <div
                        key={file.id}
                        className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <File className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-white truncate">
                                {file.name}
                              </p>
                              <p className="text-xs text-slate-400">
                                {formatFileSize(file.size)}
                              </p>
                            </div>
                          </div>
                          {file.status !== "uploading" && (
                            <button
                              onClick={() => removeFile(file.id)}
                              className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        {/* Per-file document type selector */}
                        {file.status === "pending" && (
                          <div className="mt-2 mb-2">
                            <Select 
                              value={file.type} 
                              onValueChange={(value) => updateFileType(file.id, value)}
                            >
                              <SelectTrigger className="h-8 text-xs bg-slate-800 border-slate-700 text-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-slate-900 border-slate-700">
                                {DOCUMENT_TYPES.filter(t => t.value !== 'AUTO').map((type) => (
                                  <SelectItem 
                                    key={type.value} 
                                    value={type.value} 
                                    className="text-white text-xs focus:bg-slate-800"
                                  >
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {file.confidence && file.confidence !== 'low' && (
                              <p className="text-xs text-slate-500 mt-1">
                                {file.confidence === 'high' ? '✓ Auto-detected' : '? Suggested'} from filename
                              </p>
                            )}
                          </div>
                        )}

                        {/* Status Indicator */}
                        <div className="flex items-center gap-2">
                          {file.status === "pending" && (
                            <div className="w-full h-1 bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full bg-orange-500 w-0"></div>
                            </div>
                          )}
                          {file.status === "uploading" && (
                            <div className="flex items-center gap-2 w-full">
                              <Loader2 className="h-3 w-3 text-orange-400 animate-spin flex-shrink-0" />
                              <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-orange-500 transition-all"
                                  style={{ width: `${file.progress}%` }}
                                ></div>
                              </div>
                            </div>
                          )}
                          {file.status === "completed" && (
                            <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                          )}
                          {file.status === "extracting" && (
                            <Loader2 className="h-3 w-3 text-blue-400 animate-spin flex-shrink-0" />
                          )}
                          {file.status === "error" && (
                            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
                          )}
                        </div>

                        {file.error && (
                          <p className="text-xs text-red-400 mt-2">{file.error}</p>
                        )}
                        
                        {/* Extraction progress */}
                        {file.status === "extracting" && file.documentId && project?.id && (
                          <div className="mt-3">
                            <ExtractionProgressBar
                              documentId={file.documentId}
                              projectId={project.id}
                              onComplete={() => {
                                setUploadedFiles(prev => prev.map(f => 
                                  f.id === file.id ? { ...f, status: 'completed' } : f
                                ));
                              }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {uploadedFiles.length > 0 && (
                  <Button
                    className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white"
                    disabled={uploadedFiles.some((f) => f.status === "error") || uploadedFiles.every((f) => f.status !== "pending")}
                    onClick={handleUploadAll}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload All Files
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
            </div>
          </TabsContent>

          <TabsContent value="acc">
            <div className="max-w-4xl mx-auto">
              <ACCProjectBrowser />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
