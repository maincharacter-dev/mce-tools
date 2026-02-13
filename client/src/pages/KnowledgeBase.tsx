import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

// The agent router is created via a factory function from the npm package,
// so tRPC can't infer its types statically. Cast to any for runtime access.
const agentTrpc = (trpc as any).agent;
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Brain,
  Search,
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  Lightbulb,
  TrendingUp,
  Globe,
  Scale,
  Wrench,
  GraduationCap,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Database,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "domain_knowledge", label: "Domain Knowledge", icon: BookOpen, color: "text-blue-400" },
  { value: "best_practice", label: "Best Practice", icon: Lightbulb, color: "text-yellow-400" },
  { value: "pattern", label: "Pattern", icon: TrendingUp, color: "text-green-400" },
  { value: "benchmark", label: "Benchmark", icon: BarChart3, color: "text-purple-400" },
  { value: "lesson_learned", label: "Lesson Learned", icon: GraduationCap, color: "text-orange-400" },
  { value: "regional_insight", label: "Regional Insight", icon: Globe, color: "text-cyan-400" },
  { value: "regulatory", label: "Regulatory", icon: Scale, color: "text-red-400" },
  { value: "technical_standard", label: "Technical Standard", icon: Wrench, color: "text-slate-400" },
];

const CONFIDENCE_LEVELS = [
  { value: "high", label: "High", color: "bg-green-500/20 text-green-400 border-green-500/30" },
  { value: "medium", label: "Medium", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { value: "low", label: "Low", color: "bg-red-500/20 text-red-400 border-red-500/30" },
];

const PAGE_SIZE = 20;

export default function KnowledgeBase() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterConfidence, setFilterConfidence] = useState<string>("all");
  const [page, setPage] = useState(0);

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    category: "domain_knowledge",
    topic: "",
    content: "",
    confidence: "medium",
    tags: "",
    relatedTopics: "",
    applicability: "",
  });

  // Queries
  const { data, isLoading, refetch } = agentTrpc.listKnowledge.useQuery({
    category: filterCategory !== "all" ? filterCategory : undefined,
    confidence: filterConfidence !== "all" ? filterConfidence : undefined,
    search: searchQuery || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  // Mutations
  const createMutation = agentTrpc.createKnowledge.useMutation({
    onSuccess: () => {
      toast.success("Knowledge entry created successfully");
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (error: any) => toast.error(`Failed to create: ${error.message}`),
  });

  const updateMutation = agentTrpc.updateKnowledge.useMutation({
    onSuccess: () => {
      toast.success("Knowledge entry updated successfully");
      setIsEditOpen(false);
      resetForm();
      refetch();
    },
    onError: (error: any) => toast.error(`Failed to update: ${error.message}`),
  });

  const deleteMutation = agentTrpc.deleteKnowledge.useMutation({
    onSuccess: () => {
      toast.success("Knowledge entry deleted");
      setIsDeleteOpen(false);
      setSelectedEntry(null);
      refetch();
    },
    onError: (error: any) => toast.error(`Failed to delete: ${error.message}`),
  });

  const seedMutation = agentTrpc.seedKnowledge.useMutation({
    onSuccess: (result: any) => {
      toast.success(`Knowledge base seeded: ${result.added} added, ${result.skipped} skipped`);
      refetch();
    },
    onError: (error: any) => toast.error(`Failed to seed: ${error.message}`),
  });

  const resetForm = () => {
    setFormData({
      category: "domain_knowledge",
      topic: "",
      content: "",
      confidence: "medium",
      tags: "",
      relatedTopics: "",
      applicability: "",
    });
  };

  const openEdit = (entry: any) => {
    setSelectedEntry(entry);
    setFormData({
      category: entry.category,
      topic: entry.topic,
      content: entry.content,
      confidence: entry.confidence || "medium",
      tags: entry.metadata?.tags?.join(", ") || "",
      relatedTopics: entry.metadata?.relatedTopics?.join(", ") || "",
      applicability: entry.metadata?.applicability?.join(", ") || "",
    });
    setIsEditOpen(true);
  };

  const openDelete = (entry: any) => {
    setSelectedEntry(entry);
    setIsDeleteOpen(true);
  };

  const handleCreate = () => {
    createMutation.mutate({
      category: formData.category,
      topic: formData.topic,
      content: formData.content,
      confidence: formData.confidence,
      tags: formData.tags ? formData.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      relatedTopics: formData.relatedTopics ? formData.relatedTopics.split(",").map(t => t.trim()).filter(Boolean) : [],
      applicability: formData.applicability ? formData.applicability.split(",").map(t => t.trim()).filter(Boolean) : [],
    });
  };

  const handleUpdate = () => {
    if (!selectedEntry) return;
    updateMutation.mutate({
      id: selectedEntry.id,
      category: formData.category,
      topic: formData.topic,
      content: formData.content,
      confidence: formData.confidence,
      tags: formData.tags ? formData.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      relatedTopics: formData.relatedTopics ? formData.relatedTopics.split(",").map(t => t.trim()).filter(Boolean) : [],
      applicability: formData.applicability ? formData.applicability.split(",").map(t => t.trim()).filter(Boolean) : [],
    });
  };

  const handleDelete = () => {
    if (!selectedEntry) return;
    deleteMutation.mutate({ id: selectedEntry.id });
  };

  const getCategoryInfo = (category: string) => {
    return CATEGORIES.find(c => c.value === category) || CATEGORIES[0];
  };

  const getConfidenceBadge = (confidence: string) => {
    const level = CONFIDENCE_LEVELS.find(c => c.value === confidence);
    return <Badge className={level?.color || "bg-slate-500/20 text-slate-400"}>{level?.label || confidence}</Badge>;
  };

  const totalPages = Math.ceil((data?.total || 0) / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Brain className="h-8 w-8 text-purple-400" />
              <div>
                <h1 className="text-3xl font-bold text-white mb-1">Knowledge Base</h1>
                <p className="text-slate-400">
                  The agent's persistent memory — insights accumulated across all projects
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => seedMutation.mutate()}
                variant="outline"
                className="border-slate-700 hover:bg-slate-800"
                disabled={seedMutation.isPending}
              >
                {seedMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Database className="h-4 w-4 mr-2" />
                )}
                Seed Knowledge
              </Button>
              <Button
                onClick={() => {
                  resetForm();
                  setIsCreateOpen(true);
                }}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Knowledge
              </Button>
              <Button
                onClick={() => navigate("/agent-stats")}
                variant="outline"
                className="border-slate-700 hover:bg-slate-800"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Learning Stats
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 bg-slate-900/50 border-slate-800">
            <div className="flex items-center gap-3">
              <Brain className="h-8 w-8 text-purple-400" />
              <div>
                <p className="text-2xl font-bold text-white">{data?.total || 0}</p>
                <p className="text-sm text-slate-400">Total Entries</p>
              </div>
            </div>
          </Card>
          {CATEGORIES.slice(0, 3).map(cat => {
            const catCount = data?.entries?.filter((e: any) => e.category === cat.value).length || 0;
            const Icon = cat.icon;
            return (
              <Card key={cat.value} className="p-4 bg-slate-900/50 border-slate-800">
                <div className="flex items-center gap-3">
                  <Icon className={`h-8 w-8 ${cat.color}`} />
                  <div>
                    <p className="text-2xl font-bold text-white">{catCount}</p>
                    <p className="text-sm text-slate-400">{cat.label}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <Card className="p-4 bg-slate-900/50 border-slate-800 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search topics and content..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(0);
                  }}
                  className="pl-10 bg-slate-800/50 border-slate-700"
                />
              </div>
            </div>
            <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setPage(0); }}>
              <SelectTrigger className="w-[180px] bg-slate-800/50 border-slate-700">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterConfidence} onValueChange={(v) => { setFilterConfidence(v); setPage(0); }}>
              <SelectTrigger className="w-[150px] bg-slate-800/50 border-slate-700">
                <SelectValue placeholder="Confidence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {CONFIDENCE_LEVELS.map(level => (
                  <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* Knowledge Entries */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : data?.entries?.length === 0 ? (
          <Card className="p-12 bg-slate-900/50 border-slate-800 text-center">
            <Brain className="h-16 w-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No Knowledge Entries Found</h3>
            <p className="text-slate-400 mb-6">
              {searchQuery || filterCategory !== "all" || filterConfidence !== "all"
                ? "Try adjusting your filters or search query."
                : "The knowledge base is empty. Seed it with foundational knowledge or add entries manually."}
            </p>
            {!searchQuery && filterCategory === "all" && (
              <Button
                onClick={() => seedMutation.mutate()}
                className="bg-purple-600 hover:bg-purple-700"
                disabled={seedMutation.isPending}
              >
                <Database className="h-4 w-4 mr-2" />
                Seed with Solar DD Knowledge
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            {data?.entries?.map((entry: any) => {
              const catInfo = getCategoryInfo(entry.category);
              const CatIcon = catInfo.icon;
              const metadata = entry.metadata as any;

              return (
                <Card
                  key={entry.id}
                  className="p-6 bg-slate-900/50 border-slate-800 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="mt-1">
                        <CatIcon className={`h-5 w-5 ${catInfo.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-white truncate">
                            {entry.topic}
                          </h3>
                          {getConfidenceBadge(entry.confidence || "medium")}
                          <Badge variant="outline" className="border-slate-700 text-slate-400">
                            {catInfo.label}
                          </Badge>
                          {(entry.sourceCount || 1) > 1 && (
                            <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                              {entry.sourceCount} sources
                            </Badge>
                          )}
                        </div>
                        <p className="text-slate-300 text-sm leading-relaxed line-clamp-3">
                          {entry.content}
                        </p>
                        {metadata?.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {metadata.tags.map((tag: string) => (
                              <Badge
                                key={tag}
                                variant="outline"
                                className="text-xs border-slate-700 text-slate-500"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(entry)}
                        className="h-8 w-8 text-slate-400 hover:text-white"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDelete(entry)}
                        className="h-8 w-8 text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-slate-400">
                  Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, data?.total || 0)} of {data?.total || 0}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="border-slate-700"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-slate-400">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="border-slate-700"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Add Knowledge Entry</DialogTitle>
            <DialogDescription className="text-slate-400">
              Add a new insight, best practice, or benchmark to the agent's knowledge base.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-1.5 block">Category</label>
                <Select value={formData.category} onValueChange={(v) => setFormData(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="bg-slate-800/50 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1.5 block">Confidence</label>
                <Select value={formData.confidence} onValueChange={(v) => setFormData(f => ({ ...f, confidence: v }))}>
                  <SelectTrigger className="bg-slate-800/50 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONFIDENCE_LEVELS.map(level => (
                      <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1.5 block">Topic</label>
              <Input
                placeholder="e.g., Solar DC/AC Ratio Best Practice"
                value={formData.topic}
                onChange={(e) => setFormData(f => ({ ...f, topic: e.target.value }))}
                className="bg-slate-800/50 border-slate-700"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1.5 block">Content</label>
              <Textarea
                placeholder="Detailed knowledge content..."
                value={formData.content}
                onChange={(e) => setFormData(f => ({ ...f, content: e.target.value }))}
                className="bg-slate-800/50 border-slate-700 min-h-[150px]"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1.5 block">Tags (comma-separated)</label>
              <Input
                placeholder="e.g., solar, oman, grid, regulatory"
                value={formData.tags}
                onChange={(e) => setFormData(f => ({ ...f, tags: e.target.value }))}
                className="bg-slate-800/50 border-slate-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-1.5 block">Related Topics</label>
                <Input
                  placeholder="e.g., grid connection, OETC"
                  value={formData.relatedTopics}
                  onChange={(e) => setFormData(f => ({ ...f, relatedTopics: e.target.value }))}
                  className="bg-slate-800/50 border-slate-700"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1.5 block">Applicability</label>
                <Input
                  placeholder="e.g., solar, MENA, utility-scale"
                  value={formData.applicability}
                  onChange={(e) => setFormData(f => ({ ...f, applicability: e.target.value }))}
                  className="bg-slate-800/50 border-slate-700"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="border-slate-700">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.topic || !formData.content || createMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Knowledge Entry</DialogTitle>
            <DialogDescription className="text-slate-400">
              Update the knowledge entry details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-1.5 block">Category</label>
                <Select value={formData.category} onValueChange={(v) => setFormData(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="bg-slate-800/50 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1.5 block">Confidence</label>
                <Select value={formData.confidence} onValueChange={(v) => setFormData(f => ({ ...f, confidence: v }))}>
                  <SelectTrigger className="bg-slate-800/50 border-slate-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONFIDENCE_LEVELS.map(level => (
                      <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1.5 block">Topic</label>
              <Input
                value={formData.topic}
                onChange={(e) => setFormData(f => ({ ...f, topic: e.target.value }))}
                className="bg-slate-800/50 border-slate-700"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1.5 block">Content</label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData(f => ({ ...f, content: e.target.value }))}
                className="bg-slate-800/50 border-slate-700 min-h-[150px]"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-1.5 block">Tags (comma-separated)</label>
              <Input
                value={formData.tags}
                onChange={(e) => setFormData(f => ({ ...f, tags: e.target.value }))}
                className="bg-slate-800/50 border-slate-700"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-slate-400 mb-1.5 block">Related Topics</label>
                <Input
                  value={formData.relatedTopics}
                  onChange={(e) => setFormData(f => ({ ...f, relatedTopics: e.target.value }))}
                  className="bg-slate-800/50 border-slate-700"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1.5 block">Applicability</label>
                <Input
                  value={formData.applicability}
                  onChange={(e) => setFormData(f => ({ ...f, applicability: e.target.value }))}
                  className="bg-slate-800/50 border-slate-700"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)} className="border-slate-700">
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!formData.topic || !formData.content || updateMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Pencil className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Knowledge Entry</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete "{selectedEntry?.topic}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)} className="border-slate-700">
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              variant="destructive"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
