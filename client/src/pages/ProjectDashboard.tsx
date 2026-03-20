import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, AlertCircle, FolderOpen, ExternalLink, Linkedin, Menu } from "lucide-react";
import { useLocation } from "wouter";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ProjectCard } from "@/components/ProjectCard";
import { useState } from "react";

// OE Toolkit URL — projects are managed there, not in mce-workspace
const OE_TOOLKIT_URL = "/";

export default function ProjectDashboard() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Fetch projects from oe-toolkit (via /api/trpc which routes to oe-toolkit)
  const { data: projects, isLoading, error } = trpc.projects.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

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
      {/* Header */}
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
            <a
              href={OE_TOOLKIT_URL}
              className="text-slate-300 hover:text-orange-400 transition-colors font-medium"
            >
              OE Toolkit
            </a>
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
                <a
                  href={OE_TOOLKIT_URL}
                  onClick={() => setIsMenuOpen(false)}
                  className="text-xl font-semibold text-white hover:text-orange-400 transition-colors py-2"
                >
                  OE Toolkit
                </a>
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
        <div className="mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Your Projects
            </h1>
            <p className="text-lg text-slate-300 max-w-3xl">
              Select a project to upload documents, extract insights, and manage your TA/TDD workflow.
              Projects are created and managed in OE Toolkit.
            </p>
          </div>
          {/* Link to OE Toolkit for project creation */}
          <a href={`${OE_TOOLKIT_URL}projects`}>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold whitespace-nowrap">
              <ExternalLink className="mr-2 h-4 w-4" />
              Manage in OE Toolkit
            </Button>
          </a>
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
            {/* Project count */}
            <p className="text-slate-400 mb-8">
              {projects.length} project{projects.length !== 1 ? "s" : ""} total
            </p>

            {/* Projects Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {projects.map((project: any) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onClick={() => setLocation(`/project-dashboard?projectId=${project.id}`)}
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
              Create your first project in OE Toolkit to get started with document ingestion and analysis.
            </p>
            <a href={`${OE_TOOLKIT_URL}projects`}>
              <Button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold" size="lg">
                <ExternalLink className="mr-2 h-5 w-5" />
                Create Project in OE Toolkit
              </Button>
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
