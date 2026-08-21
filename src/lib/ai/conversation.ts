import type { ChatMessage, ToolCall } from "@/types/singulo";
import { settingsStore } from "@/config/settings";
import { appendSessionMessage, memoryStore } from "@/lib/memory/store";
import { executeTool, toolSchemas } from "@/lib/tools/registry";
import type { ToolContext } from "@/lib/tools/registry";
import { requestPermission, setAiState, setError, singuloStore } from "@/lib/state/singulo";

interface WireMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null | Record<string, unknown>[];
  tool_call_id?: string;
  tool_calls?: Record<string, unknown>[];
}

const styleGuide = {
  concise: "Answer in one short sentence. No preamble, no restating the question.",
  balanced: "Answer in at most three sentences. Lead with the direct answer, then the key detail.",
  detailed:
    "Answer in at most six short sentences or bullet-like lines. Facts and steps only, no filler.",
};

function systemPrompt(): string {
  const { ai } = settingsStore.get();
  const facts = memoryStore.get().persistent;
  return [
    "You are SINGULO, a voice-first AI operating interface.",
    "You are software with defined tools and permissions — never claim sentience, feelings, or system access you do not have.",
    "Be precise: answer the exact question asked, lead with the answer, give concrete numbers, names and dates instead of vague description.",
    "Never pad with pleasantries, apologies, disclaimers, or offers to help further. Do not repeat the user's words back.",
    "If you are unsure or the answer depends on live data, say so in one clause and use a tool instead of guessing.",
    "Your replies are usually spoken aloud: plain prose, no markdown tables or headings, code fences only when code was requested.",
    styleGuide[ai.style],
    "Use tools when they give a better answer than guessing (calculations, current web information, notes, memory, interface control).",
    "If a tool fails, say what failed and offer the next step.",
    facts.length
      ? `Persistent memory the user saved:\n${facts.map((f) => `- ${f.text}`).join("\n")}`
      : "Persistent memory is currently empty.",
  ].join("\n");
}

function toWire(messages: ChatMessage[]): WireMessage[] {
  return messages
    .filter((m) => m.role !== "tool")
    .slice(-20)
    .map((m) => ({ role: m.role as WireMessage["role"], content: m.content }));
}

async function callModel(messages: WireMessage[], signal?: AbortSignal) {
  const { ai } = settingsStore.get();
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ai.model,
      temperature: ai.temperature,
      messages,
      tools: toolSchemas,
    }),
    signal: signal ?? null,
  });
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? `AI request failed (${response.status}).`);
  }
  return (await response.json()) as {
    content: string;
    tool_calls: { id?: string; function?: { name?: string; arguments?: string } }[];
  };
}

export interface SendOptions {
  /** Extra multimodal context blocks (images, attached text). */
  attachments?: Record<string, unknown>[];
  /** Spatial context contributed by gestures, e.g. the currently pointed target. */
  spatialContext?: string | null;
  visual: ToolContext["visual"];
  onReply: (text: string) => void | Promise<void>;
  signal?: AbortSignal;
}

const MAX_TOOL_ROUNDS = 4;

/** Intent → tool router → permission check → execution → reply. */
export async function sendMessage(userText: string, options: SendOptions) {
  const trimmed = userText.trim();
  if (!trimmed) return;

  appendSessionMessage({ role: "user", content: trimmed });
  setAiState("thinking", "Reasoning");

  const wire: WireMessage[] = [
    { role: "system", content: systemPrompt() },
    ...(options.spatialContext
      ? [{ role: "system" as const, content: `Gesture context: ${options.spatialContext}` }]
      : []),
    ...toWire(memoryStore.get().session),
  ];

  if (options.attachments?.length) {
    wire[wire.length - 1] = {
      role: "user",
      content: [{ type: "text", text: trimmed }, ...options.attachments],
    };
  }

  const ctx: ToolContext = {
    visual: options.visual,
    confirm: requestPermission,
    onStatus: (status, progress) =>
      singuloStore.set({ aiState: "executing", statusLine: status, progress: progress ?? null }),
  };

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const result = await callModel(wire, options.signal);
      const calls: ToolCall[] = (result.tool_calls ?? [])
        .map((call) => {
          let args: Record<string, unknown> = {};
          try {
            args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
          } catch {
            args = {};
          }
          return {
            id: call.id ?? Math.random().toString(36).slice(2),
            name: call.function?.name ?? "",
            arguments: args,
          };
        })
        .filter((c) => c.name);

      if (!calls.length || round === MAX_TOOL_ROUNDS) {
        const content = result.content?.trim() || "I could not produce a response for that.";
        appendSessionMessage({ role: "assistant", content });
        await options.onReply(content);
        return;
      }

      wire.push({
        role: "assistant",
        content: result.content ?? "",
        tool_calls: (result.tool_calls ?? []) as Record<string, unknown>[],
      });

      for (const call of calls) {
        const toolResult = await executeTool(call, ctx);
        appendSessionMessage({
          role: "tool",
          toolName: call.name,
          content: toolResult.output,
        });
        wire.push({ role: "tool", tool_call_id: call.id, content: toolResult.output });
      }
      setAiState("thinking", "Integrating results");
    }
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      setAiState("idle", "Standby");
      return;
    }
    setError(error instanceof Error ? error.message : "The AI request failed.");
  }
}