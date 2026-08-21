export const GATEWAY = "https://ai.gateway.lovable.dev/v1";

export function apiKey(): string {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured: LOVABLE_API_KEY is missing on the server.");
  return key;
}

/** Naive in-memory sliding-window rate limiter, per client identity. */
const buckets = new Map<string, number[]>();

export function rateLimit(identity: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const hits = (buckets.get(identity) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(identity, hits);
    return false;
  }
  hits.push(now);
  buckets.set(identity, hits);
  return true;
}

export function clientId(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}

export function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Maps gateway failures onto user-facing, honest messages. */
export function gatewayMessage(status: number, body: string): string {
  if (status === 429) return "SINGULO is rate limited. Wait a moment and try again.";
  if (status === 402) return "AI credits are exhausted for this workspace.";
  if (status === 403) return "AI access is blocked by workspace policy.";
  if (status === 401) return "AI credentials are invalid on the server.";
  return body.slice(0, 400) || `AI request failed with status ${status}.`;
}