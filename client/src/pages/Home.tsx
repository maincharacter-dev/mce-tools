import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, Database, Brain, Shield, Linkedin, Menu } from "lucide-react";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800/50 backdrop-blur-xl bg-slate-900/50 sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="https://files.manuscdn.com/user_upload_by_module/session_file/310519663183448316/ajFrkysEfsqfkiXJ.png" alt="MCE" className="h-10 w-10" />
              <div>
                <h1 className="text-xl font-bold text-white">Project Intake</h1>
                <p className="text-sm text-slate-400">TA/TDD Workflow · Stage 1</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-4">
              {isAuthenticated && (
                <Button
                  variant="outline"
                  className="border-slate-700 hover:border-orange-500/50"
                  onClick={() => setLocation("/projects")}
                >
                  My Projects
                </Button>
              )}
              <a 
                href="https://www.linkedin.com/company/main-character-energy-consulting/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-[#0077b5] transition-colors"
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
                  {isAuthenticated && (
                    <Button
                      variant="outline"
                      className="border-slate-700"
                      onClick={() => {
                        setIsMenuOpen(false);
                        setLocation("/projects");
                      }}
                    >
                      My Projects
                    </Button>
                  )}
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
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="max-w-4xl">
          <div className="mb-4">
            <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30 mb-2">
              TA/TDD Workflow · Stage 1
            </Badge>
          </div>
          <h2 className="text-5xl font-bold text-white mb-6 leading-tight">
            Project Intake
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
              Document Intelligence
            </span>
          </h2>
          <p className="text-xl text-slate-300 leading-relaxed mb-8">
            First stage of the Technical Advisory workflow. Ingest project documents, extract structured insights, and build the foundational Project Intelligence Base for downstream analysis.
          </p>
          <p className="text-lg text-slate-400 leading-relaxed mb-8">
            Process IMs, DD packs, concept designs, and grid studies using hybrid extraction (deterministic parsing + Ollama LLM). Maintain data sovereignty with per-project databases while contributing de-identified insights to the knowledge base.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            {isAuthenticated ? (
              <Button 
                size="lg" 
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                onClick={() => setLocation("/projects")}
              >
                Go to Projects
              </Button>
            ) : (
              <Button 
                size="lg" 
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                onClick={() => window.location.href = getLoginUrl()}
              >
                Sign In to Start
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-lg p-6">
            <div className="p-3 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/20 border border-orange-500/30 w-fit mb-4">
              <FileText className="h-6 w-6 text-orange-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Document Ingestion</h3>
            <p className="text-sm text-slate-400">
              Upload PDFs, DOCX, XLSX files. Drag-and-drop interface with automatic text extraction.
            </p>
          </div>

          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-lg p-6">
            <div className="p-3 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 w-fit mb-4">
              <Brain className="h-6 w-6 text-blue-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Hybrid Extraction</h3>
            <p className="text-sm text-slate-400">
              Deterministic patterns + Ollama LLM for comprehensive fact extraction with confidence scores.
            </p>
          </div>

          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-lg p-6">
            <div className="p-3 rounded-lg bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 w-fit mb-4">
              <Database className="h-6 w-6 text-green-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Project Fact Base</h3>
            <p className="text-sm text-slate-400">
              Structured storage of extracted insights with source tracking and verification workflow.
            </p>
          </div>

          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700 rounded-lg p-6">
            <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 w-fit mb-4">
              <Shield className="h-6 w-6 text-purple-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Data Sovereignty</h3>
            <p className="text-sm text-slate-400">
              Per-project databases ensure complete data isolation and control. Delete anytime.
            </p>
          </div>
        </div>
      </section>

      {/* Workflow Context */}
      <section className="container mx-auto px-6 py-12">
        <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/10 border border-orange-500/30 rounded-lg p-8">
          <h3 className="text-2xl font-bold text-white mb-4">Part of the TA/TDD Workflow</h3>
          <p className="text-slate-300 mb-6">
            Project Intake is the first stage in the Technical Advisory & Due Diligence workflow. 
            Once your Project Fact Base is established, it feeds into:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
              <div className="text-sm font-semibold text-orange-500 mb-1">Stage 2</div>
              <div className="text-white font-bold mb-1">Rapid Assessment</div>
              <div className="text-xs text-slate-400">Red-flag detection and gap analysis</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
              <div className="text-sm font-semibold text-orange-500 mb-1">Stage 3</div>
              <div className="text-white font-bold mb-1">Deep Dive</div>
              <div className="text-xs text-slate-400">Technical evaluation and benchmarking</div>
            </div>
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
              <div className="text-sm font-semibold text-orange-500 mb-1">Stage 4</div>
              <div className="text-white font-bold mb-1">Investment Decision</div>
              <div className="text-xs text-slate-400">PDR generation and FC readiness</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800/50 mt-12">
        <div className="container mx-auto px-6 py-8">
          <p className="text-sm text-slate-500 text-center">
            © 2025 Main Character Energy. Part of the OE Toolkit v2.0
          </p>
        </div>
      </footer>
    </div>
  );
}
