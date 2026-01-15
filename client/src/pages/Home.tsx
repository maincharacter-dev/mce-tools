import { Link } from "wouter";
import { ArrowRight, Zap, BarChart3, Linkedin, Search, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

/**
 * OE Toolkit Landing Page
 * 
 * Design Philosophy: MCE Style Guide - Bold & Authoritative
 * - Dark mode-first with slate-900 background
 * - Orange accents for energy and action
 * - Premium consulting aesthetic
 * - Gradient backgrounds and subtle depth
 */

interface ToolCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  url: string;
  status: string;
}

const tools: ToolCard[] = [
  {
    id: "acc-extractor",
    title: "ACC Asset Extractor",
    description:
      "Extract and manage assets from Autodesk Construction Cloud. Streamline your document processing and data extraction workflows with intelligent automation.",
    icon: <Zap className="h-8 w-8" />,
    color: "from-orange-500 to-orange-600",
    url: "https://accextractor-wgbdueae.manus.space/",
    status: "Active",
  },
  {
    id: "solar-performance",
    title: "Solar Farm Performance Analyser",
    description:
      "Analyze and optimize solar farm performance metrics. Track energy generation, efficiency, and system health in real-time with advanced analytics.",
    icon: <BarChart3 className="h-8 w-8" />,
    color: "from-amber-500 to-amber-600",
    url: "https://solaranalys-v5zbfm3a.manus.space/",
    status: "Active",
  },
];

export default function Home() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      {/* Header - Matching MCE Website Style */}
      <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 md:py-6 flex items-center justify-between">
          {/* Logo Section */}
          <Link href="/">
            <a className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <img 
                src="/mce-logo.png" 
                alt="Main Character Energy" 
                className="h-10 w-10 md:h-12 md:w-12" 
              />
              <div>
                <div className="text-lg md:text-2xl font-bold text-white tracking-tight">
                  MAIN CHARACTER ENERGY
                </div>
                <div className="text-xs md:text-sm text-slate-400 font-medium">
                  OE Toolkit
                </div>
              </div>
            </a>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            <a 
              href="#tools"
              className="text-slate-300 hover:text-orange-400 transition-colors font-medium"
            >
              Tools
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
                  href="#tools"
                  onClick={() => setIsMenuOpen(false)}
                  className="text-xl font-semibold text-slate-300 hover:text-white transition-colors py-2"
                >
                  Tools
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

      {/* Hero Section */}
      <section className="py-16 md:py-32 lg:py-40">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl">
            {/* Main Title */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              OE Toolkit
            </h1>

            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-slate-300 mb-6 leading-relaxed">
              Specialized tools for consulting operations. From asset extraction to performance analysis, 
              we provide the infrastructure for data-driven decision making.
            </p>

            {/* Description */}
            <p className="text-lg text-slate-400 mb-12 leading-relaxed max-w-3xl">
              Access a suite of optimized tools designed to streamline your consulting workflows. Each tool 
              is built for specific use cases, enabling teams to extract insights, analyze performance, and 
              make informed decisions faster.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="#tools">
                <Button 
                  size="lg" 
                  className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                >
                  Explore Tools
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </a>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-slate-600 text-white hover:bg-slate-800 hover:text-white"
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section id="tools" className="py-20 md:py-32 bg-slate-800/30">
        <div className="container mx-auto px-4">
          {/* Section Header */}
          <div className="mb-16 md:mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Available Tools
            </h2>
            <p className="text-xl text-slate-300 max-w-3xl">
              Each tool is optimized for specific consulting workflows. Click on a tool to access 
              its dedicated interface and documentation.
            </p>
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl">
            {tools.map((tool) => (
              <a
                key={tool.id}
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <div className="h-full flex flex-col bg-slate-900/50 border border-slate-700/50 rounded-xl p-8 transition-all duration-300 hover:border-orange-500/50 hover:bg-slate-900/80 hover:shadow-lg hover:shadow-orange-500/10 cursor-pointer">
                  {/* Header with Icon and Status */}
                  <div className="flex items-start justify-between mb-6">
                    <div className={`p-4 rounded-lg bg-gradient-to-br ${tool.color} text-white`}>
                      {tool.icon}
                    </div>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-300 border border-green-500/30">
                      {tool.status}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-orange-400 transition-colors duration-300">
                    {tool.title}
                  </h3>

                  {/* Description */}
                  <p className="text-slate-300 text-base leading-relaxed mb-8 flex-grow">
                    {tool.description}
                  </p>

                  {/* Footer with Arrow */}
                  <div className="flex items-center text-orange-400 font-semibold group-hover:gap-3 gap-2 transition-all duration-300">
                    <span>Access Tool</span>
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
              <div className="text-3xl font-bold text-orange-400 mb-2">2</div>
              <div className="text-sm text-slate-300">Active Tools</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
              <div className="text-3xl font-bold text-orange-400 mb-2">100%</div>
              <div className="text-sm text-slate-300">Data-Driven Approach</div>
            </div>
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-6">
              <div className="text-3xl font-bold text-orange-400 mb-2">24/7</div>
              <div className="text-sm text-slate-300">Accessible Infrastructure</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 bg-slate-900/50 py-12 md:py-16 mt-auto">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div>
              <p className="text-slate-400 text-sm">
                © 2026 Main Character Energy. All rights reserved.
              </p>
              <p className="text-slate-500 text-xs mt-2">
                OE Toolkit v1.0 — Premium Consulting Infrastructure
              </p>
            </div>
            <div className="flex gap-6">
              <a
                href="#"
                className="text-slate-400 hover:text-orange-400 transition-colors text-sm"
              >
                Documentation
              </a>
              <a
                href="#"
                className="text-slate-400 hover:text-orange-400 transition-colors text-sm"
              >
                Support
              </a>
              <a
                href="#"
                className="text-slate-400 hover:text-orange-400 transition-colors text-sm"
              >
                Status
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
