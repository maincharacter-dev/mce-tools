import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Projects from "./pages/Projects";
import Callback from "./pages/Callback";
import ProjectDetail from "./pages/ProjectDetail";
import ACCProjects from "./pages/ACCProjects";
import AgentChat from "./pages/AgentChat";
import KnowledgeBase from "./pages/KnowledgeBase";
import AgentStats from "./pages/AgentStats";
import Login from "./pages/Login";
import AdminUsers from "./pages/AdminUsers";
import KnowledgeEngine from "./pages/KnowledgeEngine";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path="/projects" component={Projects} />
      <Route path="/projects/:id" component={ProjectDetail} />
      <Route path="/acc-projects" component={ACCProjects} />
      <Route path="/agent" component={AgentChat} />
      <Route path="/agent/knowledge" component={KnowledgeBase} />
      <Route path="/knowledge-engine" component={KnowledgeEngine} />
      <Route path="/agent/stats" component={AgentStats} />
      <Route path="/login" component={Login} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/callback" component={Callback} />
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
