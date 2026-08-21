import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { GATEWAY, apiKey, clientId, gatewayMessage, jsonError, rateLimit } from "@/lib/ai/gateway.server";

const bodySchema = z.object({
  text: z.string().min(1).max(4000),
  voice: z.string().min(1).max(40).default("alloy"),
  speed: z.number().min(0.25).max(4).default(1),
});

export const Route = createFileRoute("/api/ai/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!rateLimit(`tts:${clientId(request)}`, 60)) {
          return jsonError(429, "Speech synthesis is rate limited. Try again shortly.");
        }

        let parsed;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return jsonError(400, "Malformed speech request.");
        }

        let key: string;
        try {
          key = apiKey();
        } catch (error) {
          return jsonError(500, error instanceof Error ? error.message : "AI not configured.");
        }

        try {
          const upstream = await fetch(`${GATEWAY}/audio/speech`, {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "openai/gpt-4o-mini-tts",
              input: parsed.text,
              voice: parsed.voice,
              speed: parsed.speed,
              stream_format: "sse",
              response_format: "pcm",
            }),
            signal: request.signal,
          });

          if (!upstream.ok) {
            const text = await upstream.text().catch(() => "");
            return jsonError(upstream.status, gatewayMessage(upstream.status, text));
          }
          return new Response(upstream.body, {
            headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" },
          });
        } catch (error) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          throw error;
        }
      },
    },
  },
});