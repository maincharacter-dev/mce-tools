import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle2, Link2Off } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface ACCConnectionStatusProps {
  projectId?: number;
}

export function ACCConnectionStatus({ projectId: propProjectId }: ACCConnectionStatusProps = {}) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const params = useParams();
  
  // Use prop projectId first, then URL path param, then query string
  const searchParams = new URLSearchParams(window.location.search);
  const queryProjectId = searchParams.get("projectId");
  const projectId = propProjectId ?? (params.id ? parseInt(params.id) : null) ?? (queryProjectId ? parseInt(queryProjectId) : null);

  // Check for stored credentials on mount
  const { data: storedCreds } = trpc.acc.getStoredCredentials.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  // Check for stored project mapping
  const { data: storedMapping } = trpc.acc.getProjectMapping.useQuery(
    { projectId: projectId! },
    { enabled: !!projectId }
  );

  // Auto-load stored credentials
  useEffect(() => {
    if (storedCreds?.hasCredentials && !storedCreds.isExpired && storedCreds.accessToken) {
      setAccessToken(storedCreds.accessToken);
      setIsConnected(true);
    } else if (storedCreds?.isExpired) {
      setAccessToken(null);
      setIsConnected(false);
    }
  }, [storedCreds]);

  // Get OAuth URL with client-side callback
  const { data: authData } = trpc.acc.getAuthUrl.useQuery(
    { redirectUri: window.location.origin + "/api/acc/oauth/callback", projectId: projectId! },
    { enabled: !accessToken && !!projectId }
  );

  // Exchange code mutation
  const exchangeCodeMutation = trpc.acc.exchangeCode.useMutation({
    onSuccess: (tokens) => {
      setAccessToken(tokens.access_token);
      setIsAuthenticating(false);
      setIsConnected(true);
      toast.success("Successfully connected to ACC!");
    },
    onError: (error) => {
      setIsAuthenticating(false);
      toast.error(`Connection failed: ${error.message}`);
    },
  });

  // Disconnect mutation
  const disconnectMutation = trpc.acc.disconnect.useMutation({
    onSuccess: () => {
      setAccessToken(null);
      setIsConnected(false);
      toast.success("Disconnected from ACC");
    },
    onError: (error) => {
      toast.error(`Failed to disconnect: ${error.message}`);
    },
  });

  // Handle OAuth
  const handleAuthenticate = () => {
    if (!authData?.authUrl) return;

    setIsAuthenticating(true);
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const authWindow = window.open(
      authData.authUrl,
      "ACC Authorization",
      `width=${width},height=${height},left=${left},top=${top}`
    );

    // Listen for OAuth callback with authorization code
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "ACC_AUTH_SUCCESS" && event.data.code) {
        exchangeCodeMutation.mutate({
          code: event.data.code,
          redirectUri: window.location.origin + "/api/acc/oauth/callback",
          projectId: projectId || undefined,
        });
        window.removeEventListener("message", handleMessage);
      } else if (event.data.type === "ACC_AUTH_ERROR") {
        setIsAuthenticating(false);
        toast.error(`Connection error: ${event.data.error}`);
        window.removeEventListener("message", handleMessage);
      }
    };

    window.addEventListener("message", handleMessage);

    // Check if window was closed
    const checkClosed = setInterval(() => {
      if (authWindow?.closed) {
        clearInterval(checkClosed);
        setIsAuthenticating(false);
        window.removeEventListener("message", handleMessage);
      }
    }, 500);
  };

  // Connected state - simple status display
  if (isConnected && storedMapping?.hasMapping) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
              <div>
                <p className="text-sm font-medium text-white">Connected to ACC</p>
                <p className="text-xs text-slate-400">
                  {storedMapping.accProjectName}
                  {storedMapping.accHubName && ` (${storedMapping.accHubName})`}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
              onClick={() => {
                if (confirm("Are you sure you want to disconnect from ACC?")) {
                  disconnectMutation.mutate({ projectId: projectId! });
                }
              }}
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Disconnect"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Connected but no project mapping yet
  if (isConnected && !storedMapping?.hasMapping) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-yellow-400" />
              <div>
                <p className="text-sm font-medium text-white">ACC Authenticated</p>
                <p className="text-xs text-slate-400">
                  Select a project in the Upload page to complete setup
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
              onClick={() => {
                if (confirm("Are you sure you want to disconnect from ACC?")) {
                  disconnectMutation.mutate({ projectId: projectId! });
                }
              }}
              disabled={disconnectMutation.isPending}
            >
              {disconnectMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Disconnect"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Not connected state
  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link2Off className="h-5 w-5 text-slate-500" />
            <div>
              <p className="text-sm font-medium text-white">ACC Not Connected</p>
              <p className="text-xs text-slate-400">
                {storedCreds?.isExpired
                  ? "Session expired - reconnect to sync files"
                  : "Connect to sync files with Autodesk Construction Cloud"}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white"
            onClick={handleAuthenticate}
            disabled={isAuthenticating || !authData}
          >
            {isAuthenticating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : storedCreds?.isExpired ? (
              "Reconnect"
            ) : (
              "Connect to ACC"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
