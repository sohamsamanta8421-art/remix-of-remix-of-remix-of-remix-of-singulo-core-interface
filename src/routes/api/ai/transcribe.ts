import { createFileRoute } from "@tanstack/react-router";
import { GATEWAY, apiKey, clientId, gatewayMessage, jsonError, rateLimit } from "@/lib/ai/gateway.server";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED = ["audio/wav", "audio/wave", "audio/x-wav", "audio/mpeg", "audio/webm", "audio/mp4"];

export const Route = createFileRoute("/api/ai/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!rateLimit(`stt:${clientId(request)}`, 60)) {
          return jsonError(429, "Transcription is rate limited. Try again shortly.");
        }

        let file: File | null = null;
        try {
          const form = await request.formData();
          const candidate = form.get("file");
          if (candidate instanceof File) file = candidate;
        } catch {
          return jsonError(400, "Expected a multipart audio upload.");
        }

        if (!file || file.size === 0) return jsonError(400, "No audio received.");
        if (file.size > MAX_BYTES) return jsonError(413, "Recording is too large.");
        const type = (file.type || "audio/wav").split(";")[0] ?? "audio/wav";
        if (!ALLOWED.includes(type)) return jsonError(400, `Unsupported audio type: ${type}`);

        let key: string;
        try {
          key = apiKey();
        } catch (error) {
          return jsonError(500, error instanceof Error ? error.message : "AI not configured.");
        }

        const ext =
          type === "audio/mpeg"
            ? "mp3"
            : type === "audio/webm"
              ? "webm"
              : type === "audio/mp4"
                ? "mp4"
                : "wav";

        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-transcribe");
        upstream.append("file", file, `recording.${ext}`);

        const response = await fetch(`${GATEWAY}/audio/transcriptions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${key}` },
          body: upstream,
        });

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          return jsonError(response.status, gatewayMessage(response.status, text));
        }

        const data = (await response.json()) as { text?: string };
        return new Response(JSON.stringify({ text: data.text ?? "" }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});