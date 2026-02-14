import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
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
import RedFlags from "./pages/RedFlags";
import Conflicts from "./pages/Conflicts";
import PerformanceValidation from "./pages/PerformanceValidation";
import { PerformanceParameters } from "./pages/PerformanceParameters";
import { FinancialData } from "./pages/FinancialData";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/projects" component={ProjectDashboard} />
      <Route path="/project-dashboard" component={ProjectDetailDashboard} />
      <Route path="/project/:id/upload" component={DocumentUpload} />
      <Route path="/project/:id/documents" component={Documents} />
      <Route path="/insights" component={FactVerification} />
      <Route path="/red-flags" component={RedFlags} />
      <Route path="/conflicts" component={Conflicts} />
      <Route path="/project/:projectId/performance" component={PerformanceValidation} />
      <Route path="/project/:projectId/performance-params" component={PerformanceParameters} />
      <Route path="/project/:projectId/financial" component={FinancialData} />
      <Route path="/ollama-config" component={OllamaConfig} />
      <Route path="/processing-status" component={ProcessingStatus} />
      <Route path="/404" component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
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
