import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Router as WouterRouter } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ProjectDashboard from "./pages/ProjectDashboard";
import ProjectDetailDashboard from "./pages/ProjectDetailDashboard";
import DocumentUpload from "./pages/DocumentUpload";
import FactVerification from "./pages/FactVerification";
import OllamaConfig from "./pages/OllamaConfig";
import ProcessingStatus from "./pages/ProcessingStatus";
import { Documents } from "./pages/Documents";
import ACCFolderInspector from "./pages/ACCFolderInspector";
import RedFlags from "./pages/RedFlags";
import Conflicts from "./pages/Conflicts";
import PerformanceValidation from "./pages/PerformanceValidation";
import { PerformanceParameters } from "./pages/PerformanceParameters";
import { FinancialData } from "./pages/FinancialData";
import ACCCallback from "./pages/ACCCallback";
import Login from "./pages/Login";
import Deliverables from "./pages/Deliverables";
import ReportBuilder from "./pages/ReportBuilder";

function Router() {
  // Base path for subpath routing behind nginx (e.g. /workspace)
  // Falls back to empty string for direct local access
  const base = import.meta.env.VITE_BASE_PATH || "";
  // make sure to consider if you need authentication for certain routes
  return (
    <WouterRouter base={base}>
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/projects" component={ProjectDashboard} />
      <Route path="/project-dashboard" component={ProjectDetailDashboard} />
      <Route path="/project/:id/upload" component={DocumentUpload} />
      <Route path="/project/:id/documents" component={Documents} />
          <Route path="/project/:id/acc-inspector" component={ACCFolderInspector} />
      <Route path="/insights" component={FactVerification} />
      <Route path="/red-flags" component={RedFlags} />
      <Route path="/conflicts" component={Conflicts} />
      <Route path="/project/:projectId/performance" component={PerformanceValidation} />
      <Route path="/project/:projectId/performance-params" component={PerformanceParameters} />
      <Route path="/project/:projectId/financial" component={FinancialData} />
      <Route path="/project/:projectId/deliverables" component={Deliverables} />
      <Route path="/project/:projectId/report-builder" component={ReportBuilder} />
      <Route path="/project/:projectId/report-builder/:draftId" component={ReportBuilder} />
      <Route path="/ollama-config" component={OllamaConfig} />
      <Route path="/processing-status" component={ProcessingStatus} />
      <Route path="/api/acc/oauth/callback" component={ACCCallback} />
      <Route path="/login" component={Login} />
      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
    </WouterRouter>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="dark"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
