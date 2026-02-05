import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * OAuth Callback Page
 * 
 * Handles the OAuth callback from Autodesk Platform Services (APS)
 * Exchanges the authorization code for access tokens and stores them
 */
export default function Callback() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/callback");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [projectId, setProjectId] = useState<number | null>(null);

  const exchangeCode = trpc.acc.exchangeCode.useMutation({
    onSuccess: () => {
      setStatus("success");
      // Redirect to project page after 2 seconds
      setTimeout(() => {
        if (projectId) {
          setLocation(`/projects/${projectId}`);
        } else {
          setLocation("/projects");
        }
      }, 2000);
    },
    onError: (error) => {
      setStatus("error");
      setErrorMessage(error.message);
    },
  });

  useEffect(() => {
    // Get query parameters from URL
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const state = urlParams.get("state");
    const error = urlParams.get("error");
    const errorDescription = urlParams.get("error_description");

    // Handle OAuth errors
    if (error) {
      setStatus("error");
      setErrorMessage(errorDescription || error);
      return;
    }

    // Validate required parameters
    if (!code || !state) {
      setStatus("error");
      setErrorMessage("Missing authorization code or state parameter");
      return;
    }

    // Parse state to get project ID and redirect URI
    try {
      const stateData = JSON.parse(decodeURIComponent(state));
      const { projectId: pid, redirectUri } = stateData;

      if (!pid || !redirectUri) {
        setStatus("error");
        setErrorMessage("Invalid state parameter");
        return;
      }

      setProjectId(pid);

      // Exchange code for tokens
      exchangeCode.mutate({
        code,
        redirectUri,
        projectId: pid,
      });
    } catch (err) {
      setStatus("error");
      setErrorMessage("Failed to parse state parameter");
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-md w-full mx-4">
        <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-8">
          {/* Loading State */}
          {status === "loading" && (
            <div className="text-center">
              <Loader2 className="h-12 w-12 text-orange-400 animate-spin mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">
                Connecting to ACC
              </h2>
              <p className="text-slate-300">
                Please wait while we complete the authorization...
              </p>
            </div>
          )}

          {/* Success State */}
          {status === "success" && (
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">
                Successfully Connected!
              </h2>
              <p className="text-slate-300 mb-4">
                Your ACC credentials have been saved. Redirecting...
              </p>
            </div>
          )}

          {/* Error State */}
          {status === "error" && (
            <div className="text-center">
              <XCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">
                Connection Failed
              </h2>
              <p className="text-slate-300 mb-4">
                {errorMessage || "An error occurred during authorization"}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={() => setLocation("/projects")}
                  variant="outline"
                  className="border-slate-600 text-white hover:bg-slate-800"
                >
                  Back to Projects
                </Button>
                {projectId && (
                  <Button
                    onClick={() => setLocation(`/projects/${projectId}`)}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    Try Again
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
