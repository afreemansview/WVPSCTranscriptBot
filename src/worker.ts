// Cloudflare Worker entry point. Static files in public/ are served by Workers Assets;
// only /api/* reaches this code (see run_worker_first in wrangler.toml).
import { handleAsk, type Env } from "./ask";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/ask") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { allow: "POST" } });
      return handleAsk(request, env);
    }
    if (url.pathname.startsWith("/api/")) return Response.json({ error: "not found" }, { status: 404 });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
