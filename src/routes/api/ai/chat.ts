import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { GATEWAY, apiKey, clientId, gatewayMessage, jsonError, rateLimit } from "@/lib/ai/gateway.server";

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.union([z.string(), z.array(z.record(z.any()))]).nullable().optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z.array(z.record(z.any())).optional(),
});

const bodySchema = z.object({
  model: z.string().min(1).max(80),
  temperature: z.number().min(0).max(2).optional(),
  messages: z.array(messageSchema).min(1).max(60),
  tools: z.array(z.record(z.any())).max(30).optional(),
});

export const Route = createFileRoute("/api/ai/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!rateLimit(`chat:${clientId(request)}`, 30)) {
          return jsonError(429, "Too many requests. Slow down for a moment.");
        }

        let parsed;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return jsonError(400, "Malformed chat request.");
        }

        let key: string;
        try {
          key = apiKey();
        } catch (error) {
          return jsonError(500, error instanceof Error ? error.message : "AI not configured.");
        }

        const upstream = await fetch(`${GATEWAY}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: parsed.model,
            temperature: parsed.temperature ?? 0.6,
            messages: parsed.messages,
            ...(parsed.tools?.length ? { tools: parsed.tools } : {}),
          }),
        });

        if (!upstream.ok) {
          const text = await upstream.text().catch(() => "");
          return jsonError(upstream.status, gatewayMessage(upstream.status, text));
        }

        const data = (await upstream.json()) as {
          choices?: { message?: { content?: string | null; tool_calls?: unknown[] } }[];
        };
        const message = data.choices?.[0]?.message ?? {};
        return new Response(
          JSON.stringify({ content: message.content ?? "", tool_calls: message.tool_calls ?? [] }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});