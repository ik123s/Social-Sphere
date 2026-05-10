import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ── Global fetch interceptor ──────────────────────────────────────────────────
// Injects X-User-Id (VCN) header on all /api/ requests so every backend call
// is scoped to the authenticated user without modifying each callsite.
const _origFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
  const url =
    typeof input === "string" ? input
    : input instanceof URL ? input.href
    : (input as Request).url;

  if (url.includes("/api/")) {
    const userId = localStorage.getItem("chivra_vcn");
    if (userId) {
      const headers = new Headers(init.headers);
      if (!headers.has("X-User-Id")) headers.set("X-User-Id", userId);
      init = { ...init, headers };
    }
  }
  return _origFetch(input, init);
};

createRoot(document.getElementById("root")!).render(<App />);
