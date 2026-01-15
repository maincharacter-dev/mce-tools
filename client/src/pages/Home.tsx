import { ArrowRight, Zap, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * OE Toolkit Landing Page
 * 
 * Design Philosophy: Premium Consulting Dashboard Aesthetic
 * - Dark mode-first with deep slate backgrounds
 * - Orange accents for energy and action
 * - Bold typography hierarchy with strong contrast
 * - Card-based tool navigation with smooth hover effects
 * - Asymmetric layout with strategic whitespace
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
      "Extract and manage assets from Autodesk Construction Cloud. Streamline your document processing and data extraction workflows.",
    icon: <Zap className="h-8 w-8" />,
    color: "from-orange-500 to-orange-600",
    url: "https://github.com/robachamilton-afk/acc-tools",
    status: "Active",
  },
  {
    id: "solar-performance",
    title: "Solar Farm Performance Analyser",
    description:
      "Analyze and optimize solar farm performance metrics. Track energy generation, efficiency, and system health in real-time.",
    icon: <BarChart3 className="h-8 w-8" />,
    color: "from-amber-500 to-amber-600",
    url: "https://github.com/robachamilton-afk/mce-tools",
    status: "Active",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navigation Header */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4 md:py-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-muted-foreground">
              Main Character Energy
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              OE Toolkit
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-16 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl">
            {/* Main Title */}
            <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-2 text-foreground">
              Main Character Energy
            </h1>

            {/* Subtitle with Orange Accent */}
            <div className="mb-8">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground inline-block">
                OE Toolkit
              </h2>
              <div className="h-1 w-32 bg-gradient-to-r from-orange-500 to-orange-600 mt-3 rounded-full"></div>
            </div>

            {/* Description */}
            <p className="text-lg text-muted-foreground max-w-2xl mb-8 leading-relaxed">
              Access a suite of specialized tools designed to streamline your consulting operations. 
              From asset extraction to performance analysis, we provide the infrastructure for 
              data-driven decision making.
            </p>

            {/* CTA Button */}
            <div className="flex gap-4">
              <Button
                size="lg"
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
              >
                Explore Tools
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Subtle background accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl -z-10"></div>
      </section>

      {/* Tools Grid Section */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          {/* Section Title */}
          <div className="mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Available Tools
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl">
              Each tool is optimized for specific consulting workflows. Click on a tool to access 
              its dedicated interface and documentation.
            </p>
          </div>

          {/* Tools Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {tools.map((tool) => (
              <a
                key={tool.id}
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <div className="h-full flex flex-col bg-card border border-border rounded-xl p-8 transition-all duration-300 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10 cursor-pointer">
                  {/* Header with Icon and Status */}
                  <div className="flex items-start justify-between mb-6">
                    <div className={`p-3 rounded-lg bg-gradient-to-br ${tool.color} text-white`}>
                      {tool.icon}
                    </div>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-300 border border-green-500/30">
                      {tool.status}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl font-bold text-foreground mb-3 group-hover:text-orange-500 transition-colors duration-300">
                    {tool.title}
                  </h3>

                  {/* Description */}
                  <p className="text-muted-foreground text-base leading-relaxed mb-6 flex-grow">
                    {tool.description}
                  </p>

                  {/* Footer with Arrow */}
                  <div className="flex items-center text-orange-500 font-semibold group-hover:gap-3 gap-2 transition-all duration-300">
                    <span>Access Tool</span>
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <section className="py-12 md:py-16 bg-background border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div>
              <p className="text-muted-foreground text-sm">
                © 2026 Main Character Energy. All rights reserved.
              </p>
              <p className="text-muted-foreground text-xs mt-2">
                OE Toolkit v1.0 — Premium Consulting Infrastructure
              </p>
            </div>
            <div className="flex gap-6">
              <a
                href="#"
                className="text-muted-foreground hover:text-orange-500 transition-colors text-sm"
              >
                Documentation
              </a>
              <a
                href="#"
                className="text-muted-foreground hover:text-orange-500 transition-colors text-sm"
              >
                Support
              </a>
              <a
                href="#"
                className="text-muted-foreground hover:text-orange-500 transition-colors text-sm"
              >
                Status
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
