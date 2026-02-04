import { useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

/**
 * OAuth callback page for ACC authentication
 * This page receives the authorization code from Autodesk and sends it to the parent window
 */
export default function ACCCallback() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Extract code from URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (error) {
      console.error("OAuth error:", error);
      // Send error to parent window
      if (window.opener) {
        window.opener.postMessage(
          { type: "ACC_AUTH_ERROR", error },
          window.location.origin
        );
        window.close();
      } else {
        // If not in popup, redirect to home
        setLocation("/");
      }
      return;
    }

    if (code) {
      // Send code to parent window
      if (window.opener) {
        window.opener.postMessage(
          { type: "ACC_AUTH_SUCCESS", code },
          window.location.origin
        );
        // Close the popup window
        setTimeout(() => window.close(), 500);
      } else {
        // If not in popup (user navigated directly), redirect to home
        setLocation("/");
      }
    } else {
      console.error("No authorization code received");
      if (window.opener) {
        window.opener.postMessage(
          { type: "ACC_AUTH_ERROR", error: "No authorization code" },
          window.location.origin
        );
        window.close();
      } else {
        setLocation("/");
      }
    }
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
        <h2 className="text-xl font-semibold">Completing authentication...</h2>
        <p className="text-sm text-muted-foreground">
          This window will close automatically
        </p>
      </div>
    </div>
  );
}
