import type { ToolCall, ToolResult } from "@/types/singulo";
import { calculate } from "./calculator";
import {
  clearPersistentMemory,
  memoryStore,
  rememberFact,
  upsertNote,
} from "@/lib/memory/store";
import { webSearch } from "@/lib/ai/search.functions";

export interface ToolContext {
  /** Applies a visual command to the SINGULO core (zoom/rotate/reset/focus). */
  visual: (action: string, amount?: number) => void;
  /** Asks the user to approve a sensitive action. Resolves false when denied. */
  confirm: (summary: string) => Promise<boolean>;
  onStatus?: (status: string, progress?: number) => void;
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON schema for parameters, sent verbatim to the model. */
  parameters: Record<string, unknown>;
  /** Sensitive tools require explicit user confirmation before running. */
  sensitive?: boolean;
  category: "compute" | "memory" | "notes" | "web" | "interface";
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
}

const str = (v: unknown, field: string): string => {
  if (typeof v !== "string" || !v.trim()) throw new Error(`"${field}" must be a non-empty string`);
  if (v.length > 8000) throw new Error(`"${field}" is too long`);
  return v.trim();
};

export const tools: ToolDefinition[] = [
  {
    name: "calculate",
    category: "compute",
    description:
      "Evaluate a mathematical expression exactly. Supports + - * / % ^, parentheses, sqrt, sin, cos, tan, log, ln, abs, round, floor, ceil, pi, e.",
    parameters: {
      type: "object",
      properties: { expression: { type: "string", description: "e.g. (2+3)^4/7" } },
      required: ["expression"],
    },
    run: async (args) => {
      const expression = str(args["expression"], "expression");
      return `${expression} = ${calculate(expression)}`;
    },
  },
  {
    name: "web_search",
    category: "web",
    description:
      "Search the public web for current information. Returns titles, snippets and URLs.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "number" } },
      required: ["query"],
    },
    run: async (args, ctx) => {
      ctx.onStatus?.("Querying the web");
      const results = await webSearch({
        data: { query: str(args["query"], "query"), limit: Number(args["limit"] ?? 5) },
      });
      if (!results.length) return "No results found.";
      return results.map((r, i) => `${i + 1}. ${r.title}\n${r.snippet}\n${r.url}`).join("\n\n");
    },
  },
  {
    name: "remember",
    category: "memory",
    description:
      "Save a fact to persistent memory. Only use when the user explicitly asks to be remembered something. Never store secrets, passwords or payment data.",
    parameters: {
      type: "object",
      properties: { fact: { type: "string" } },
      required: ["fact"],
    },
    run: async (args) => {
      const fact = str(args["fact"], "fact");
      if (/password|api[_ -]?key|secret|credit card|cvv|ssn/i.test(fact)) {
        return "Refused: that looks like sensitive credential data, which SINGULO does not store.";
      }
      rememberFact(fact);
      return `Stored in persistent memory: "${fact}"`;
    },
  },
  {
    name: "recall_memory",
    category: "memory",
    description: "List everything currently stored in persistent memory.",
    parameters: { type: "object", properties: {} },
    run: async () => {
      const entries = memoryStore.get().persistent;
      if (!entries.length) return "Persistent memory is empty.";
      return entries.map((e) => `- ${e.text}`).join("\n");
    },
  },
  {
    name: "clear_memory",
    category: "memory",
    sensitive: true,
    description: "Erase all persistent memory. Destructive: requires user confirmation.",
    parameters: { type: "object", properties: {} },
    run: async (_args, ctx) => {
      const approved = await ctx.confirm("Erase all persistent memory entries?");
      if (!approved) return "User denied the request. Memory left untouched.";
      clearPersistentMemory();
      return "Persistent memory erased.";
    },
  },
  {
    name: "note_write",
    category: "notes",
    description: "Create or overwrite a note stored on this device.",
    parameters: {
      type: "object",
      properties: { title: { type: "string" }, body: { type: "string" } },
      required: ["title", "body"],
    },
    run: async (args) => {
      upsertNote(str(args["title"], "title"), str(args["body"], "body"));
      return `Note "${args["title"]}" saved.`;
    },
  },
  {
    name: "note_list",
    category: "notes",
    description: "List notes stored on this device with their contents.",
    parameters: { type: "object", properties: {} },
    run: async () => {
      const notes = memoryStore.get().notes;
      if (!notes.length) return "No notes stored.";
      return notes.map((n) => `# ${n.title}\n${n.body}`).join("\n\n");
    },
  },
  {
    name: "visual_control",
    category: "interface",
    description:
      "Control the SINGULO core visualisation. Actions: zoom_in, zoom_out, rotate, reset, focus.",
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["zoom_in", "zoom_out", "rotate", "reset", "focus"] },
        amount: { type: "number", description: "0..1 relative magnitude" },
      },
      required: ["action"],
    },
    run: async (args, ctx) => {
      const action = str(args["action"], "action");
      const allowed = ["zoom_in", "zoom_out", "rotate", "reset", "focus"];
      if (!allowed.includes(action)) throw new Error(`Unsupported action "${action}"`);
      ctx.visual(action, typeof args["amount"] === "number" ? args["amount"] : undefined);
      return `Interface command executed: ${action}.`;
    },
  },
];

export const toolSchemas = tools.map((t) => ({
  type: "function" as const,
  function: { name: t.name, description: t.description, parameters: t.parameters },
}));

export async function executeTool(call: ToolCall, ctx: ToolContext): Promise<ToolResult> {
  const tool = tools.find((t) => t.name === call.name);
  if (!tool) {
    return { callId: call.id, name: call.name, ok: false, output: `Unknown tool "${call.name}".` };
  }
  try {
    ctx.onStatus?.(`Executing ${tool.name}`);
    const output = await tool.run(call.arguments ?? {}, ctx);
    return { callId: call.id, name: call.name, ok: true, output };
  } catch (error) {
    return {
      callId: call.id,
      name: call.name,
      ok: false,
      output: `Tool failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}