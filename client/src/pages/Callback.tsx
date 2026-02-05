import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

/**
 * OAuth Callback Page
 * 
 * Handles the OAuth callback from Autodesk Platform Services (APS)
 * This page runs in a popup window and communicates back to the parent via postMessage
 */
export default function Callback() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [projectId, setProjectId] = useState<string | null>(null);

  const exchangeCode = trpc.acc.exchangeCode.useMutation({
    onSuccess: () => {
      setStatus("success");
      // Send success message to parent window
      if (window.opener) {
        window.opener.postMessage(
          { type: "ACC_AUTH_SUCCESS", projectId },
          window.location.origin
        );
      }
      // Close popup after a short delay
      setTimeout(() => {
        window.close();
      }, 1500);
    },
    onError: (error) => {
      setStatus("error");
      setErrorMessage(error.message);
      // Send error message to parent window
      if (window.opener) {
        window.opener.postMessage(
          { type: "ACC_AUTH_ERROR", error: error.message },
          window.location.origin
        );
      }
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
      if (window.opener) {
        window.opener.postMessage(
          { type: "ACC_AUTH_ERROR", error: errorDescription || error },
          window.location.origin
        );
      }
      return;
    }

    // Validate required parameters
    if (!code) {
      setStatus("error");
      setErrorMessage("Missing authorization code");
      if (window.opener) {
        window.opener.postMessage(
          { type: "ACC_AUTH_ERROR", error: "Missing authorization code" },
          window.location.origin
        );
      }
      return;
    }

    // Get projectId from state if provided
    if (state) {
      setProjectId(state);
    }

    // Exchange code for tokens
    const redirectUri = `${window.location.origin}/callback`;
    exchangeCode.mutate({
      code,
      redirectUri,
    });
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
                Your ACC credentials have been saved. This window will close automatically.
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
              <p className="text-sm text-slate-400">
                You can close this window and try again.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
