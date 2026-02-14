import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BookOpen,
  Plus,
  Search,
  Trash2,
  Edit,
  ArrowLeft,
  Loader2,
  Database,
  Filter,
  RefreshCw,
} from "lucide-react";
import { agentTrpc } from "@/lib/agent-trpc";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const CATEGORIES = [
  "domain_knowledge",
  "best_practice",
  "pattern",
  "standard",
  "regulation",
  "methodology",
];

const CONFIDENCE_LEVELS = ["low", "medium", "high"];

const confidenceColor: Record<string, string> = {
  low: "bg-red-500/20 text-red-300 border-red-500/30",
  medium: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  high: "bg-green-500/20 text-green-300 border-green-500/30",
};

const categoryColor: Record<string, string> = {
  domain_knowledge: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  best_practice: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  pattern: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  standard: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  regulation: "bg-red-500/20 text-red-300 border-red-500/30",
  methodology: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
};

export default function KnowledgeBase() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [confidenceFilter, setConfidenceFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editingEntry, setEditingEntry] = useState<any>(null);

  // Form state
  const [formCategory, setFormCategory] = useState("domain_knowledge");
  const [formTopic, setFormTopic] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formConfidence, setFormConfidence] = useState("medium");

  const { data: knowledgeData, isLoading, refetch } = agentTrpc.listKnowledge.useQuery({
    category: categoryFilter !== "all" ? categoryFilter : undefined,
    search: searchTerm || undefined,
    limit: 100,
  });

  const createKnowledge = agentTrpc.createKnowledge.useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: () => {
      toast.success("Knowledge entry created");
      refetch();
      resetForm();
      setIsCreateOpen(false);
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(`Failed to create: ${error.message}`);
    },
  });

  const updateKnowledge = agentTrpc.updateKnowledge.useMutation({
    onSuccess: () => {
      toast.success("Knowledge entry updated");
      refetch();
      setEditingEntry(null);
      resetForm();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const deleteKnowledge = agentTrpc.deleteKnowledge.useMutation({
    onSuccess: () => {
      toast.success("Knowledge entry deleted");
      refetch();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const seedKnowledge = agentTrpc.seedKnowledge.useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (result: any) => {
      toast.success(`Knowledge base seeded: ${result.inserted} entries added, ${result.skipped} skipped`);
      refetch();
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (error: any) => {
      toast.error(`Failed to seed: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormCategory("domain_knowledge");
    setFormTopic("");
    setFormContent("");
    setFormConfidence("medium");
  };

  const handleCreate = () => {
    if (!formTopic || !formContent) {
      toast.error("Please fill in topic and content");
      return;
    }
    createKnowledge.mutate({
      category: formCategory,
      topic: formTopic,
      content: formContent,
      confidence: formConfidence,
    });
  };

  const handleUpdate = () => {
    if (!editingEntry || !formTopic || !formContent) {
      toast.error("Please fill in topic and content");
      return;
    }
    updateKnowledge.mutate({
      id: editingEntry.id,
      category: formCategory,
      topic: formTopic,
      content: formContent,
      confidence: formConfidence,
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEdit = (entry: any) => {
    setEditingEntry(entry);
    setFormCategory(entry.category);
    setFormTopic(entry.topic);
    setFormContent(entry.content);
    setFormConfidence(entry.confidence || "medium");
  };

  const handleDelete = (id: string, topic: string) => {
    if (confirm(`Delete knowledge entry "${topic}"?`)) {
      deleteKnowledge.mutate({ id });
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries: any[] = (knowledgeData as any)?.entries || [];

  const filteredEntries = useMemo(() => {
    let filtered = entries;
    if (confidenceFilter !== "all") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      filtered = filtered.filter(
        (e: any) => e.confidence === confidenceFilter
      );
    }
    return filtered;
  }, [entries, confidenceFilter]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a
                href="/"
                className="text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </a>
              <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                  <BookOpen className="h-8 w-8 text-orange-400" />
                  Knowledge Base
                </h1>
                <p className="text-slate-400 mt-1">
                  Manage shared knowledge entries for the AI agent
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700"
                onClick={() => seedKnowledge.mutate()}
                disabled={seedKnowledge.isPending}
              >
                {seedKnowledge.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Database className="h-4 w-4 mr-2" />
                )}
                Seed Knowledge
              </Button>
              <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="bg-orange-500 hover:bg-orange-600"
                    onClick={() => {
                      resetForm();
                      setEditingEntry(null);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Entry
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="text-white">
                      Add Knowledge Entry
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Add a new entry to the shared knowledge base
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-slate-300">Category</Label>
                      <Select
                        value={formCategory}
                        onValueChange={setFormCategory}
                      >
                        <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600">
                          {CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-slate-300">Topic</Label>
                      <Input
                        value={formTopic}
                        onChange={(e) => setFormTopic(e.target.value)}
                        placeholder="e.g., Solar Panel Degradation Rates"
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Content</Label>
                      <Textarea
                        value={formContent}
                        onChange={(e) => setFormContent(e.target.value)}
                        placeholder="Detailed knowledge content..."
                        rows={6}
                        className="bg-slate-800 border-slate-600 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-slate-300">Confidence</Label>
                      <Select
                        value={formConfidence}
                        onValueChange={setFormConfidence}
                      >
                        <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-600">
                          {CONFIDENCE_LEVELS.map((level) => (
                            <SelectItem key={level} value={level}>
                              {level.charAt(0).toUpperCase() + level.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateOpen(false)}
                      className="border-slate-600 text-slate-300"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreate}
                      className="bg-orange-500 hover:bg-orange-600"
                      disabled={createKnowledge.isPending}
                    >
                      {createKnowledge.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      {/* Filters */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search knowledge..."
              className="pl-10 bg-slate-800 border-slate-600 text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px] bg-slate-800 border-slate-600 text-white">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={confidenceFilter}
              onValueChange={setConfidenceFilter}
            >
              <SelectTrigger className="w-[150px] bg-slate-800 border-slate-600 text-white">
                <SelectValue placeholder="Confidence" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                <SelectItem value="all">All Levels</SelectItem>
                {CONFIDENCE_LEVELS.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            className="text-slate-400 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 pb-12">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">
              No knowledge entries found
            </h3>
            <p className="text-slate-500 mb-6">
              {searchTerm || categoryFilter !== "all"
                ? "Try adjusting your filters"
                : "Get started by seeding the knowledge base or adding entries manually"}
            </p>
            {!searchTerm && categoryFilter === "all" && (
              <Button
                className="bg-orange-500 hover:bg-orange-600"
                onClick={() => seedKnowledge.mutate()}
                disabled={seedKnowledge.isPending}
              >
                <Database className="h-4 w-4 mr-2" />
                Seed Knowledge Base
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            <p className="text-sm text-slate-400">
              {filteredEntries.length} entries found
            </p>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {filteredEntries.map((entry: any) => (
              <Card
                key={entry.id}
                className="bg-slate-900/50 border-slate-700/50 hover:border-slate-600/50 transition-colors"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-white text-lg">
                        {entry.topic}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          variant="outline"
                          className={
                            categoryColor[entry.category] ||
                            "bg-slate-500/20 text-slate-300"
                          }
                        >
                          {entry.category?.replace(/_/g, " ")}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={
                            confidenceColor[entry.confidence || "medium"]
                          }
                        >
                          {entry.confidence || "medium"}
                        </Badge>
                        {entry.sourceCount > 1 && (
                          <Badge
                            variant="outline"
                            className="bg-slate-500/20 text-slate-300 border-slate-500/30"
                          >
                            {entry.sourceCount} sources
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-white h-8 w-8"
                        onClick={() => handleEdit(entry)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-red-400 h-8 w-8"
                        onClick={() => handleDelete(entry.id, entry.topic)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-300 text-sm whitespace-pre-wrap line-clamp-4">
                    {entry.content}
                  </p>
                  {entry.updatedAt && (
                    <p className="text-xs text-slate-500 mt-3">
                      Updated:{" "}
                      {new Date(entry.updatedAt).toLocaleDateString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingEntry}
        onOpenChange={(open) => {
          if (!open) {
            setEditingEntry(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">
              Edit Knowledge Entry
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Update this knowledge base entry
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-slate-300">Category</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">Topic</Label>
              <Input
                value={formTopic}
                onChange={(e) => setFormTopic(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-300">Content</Label>
              <Textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                rows={6}
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div>
              <Label className="text-slate-300">Confidence</Label>
              <Select value={formConfidence} onValueChange={setFormConfidence}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {CONFIDENCE_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingEntry(null);
                resetForm();
              }}
              className="border-slate-600 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              className="bg-orange-500 hover:bg-orange-600"
              disabled={updateKnowledge.isPending}
            >
              {updateKnowledge.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
