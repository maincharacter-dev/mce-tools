import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

// VITE_BASE_PATH is set at build time (e.g. "/workspace" when deployed behind nginx).
// All API calls must be prefixed with it so they route to mce-workspace's own server,
// not to oe-toolkit's server which sits at the root.
const BASE_PATH = import.meta.env.VITE_BASE_PATH || '';

// Cache the auth mode so we don't fetch it on every error
let _authMode: "local" | "oauth" | null = null;
async function getAuthMode(): Promise<"local" | "oauth"> {
  if (_authMode) return _authMode;
  try {
    const res = await fetch(`${BASE_PATH}/api/auth/mode`);
    const data = await res.json();
    _authMode = data.mode === "local" ? "local" : "oauth";
  } catch {
    _authMode = "oauth";
  }
  return _authMode;
}

const redirectToLoginIfUnauthorized = async (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;
  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;
  if (!isUnauthorized) return;
  const mode = await getAuthMode();
  if (mode === "local") {
    // Local auth: redirect to our built-in login page
    const loginPath = BASE_PATH ? `${BASE_PATH}/login` : "/login";
    if (window.location.pathname !== loginPath) {
      window.location.href = loginPath;
    }
  } else {
    // Manus OAuth: redirect to external OAuth portal
    window.location.href = getLoginUrl();
  }
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      // Use BASE_PATH prefix so calls go to mce-workspace's own tRPC server,
      // not to oe-toolkit's server at the root.
      url: `${BASE_PATH}/api/trpc`,
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
