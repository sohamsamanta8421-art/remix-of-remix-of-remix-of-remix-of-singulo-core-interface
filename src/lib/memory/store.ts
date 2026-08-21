import type { ChatMessage, MemoryEntry, NoteEntry } from "@/types/singulo";
import { createStore } from "@/lib/tiny-store";

/**
 * Memory architecture.
 *  - session:    current conversation, never persisted
 *  - persistent: facts the user explicitly asked SINGULO to remember
 *  - notes:      user-authored documents
 * Persistence is a thin adapter so a database can replace localStorage later.
 */
export interface MemoryAdapter {
  read<T>(key: string, fallback: T): T;
  write<T>(key: string, value: T): void;
  clear(key: string): void;
}

export const localAdapter: MemoryAdapter = {
  read: (key, fallback) => {
    if (typeof window === "undefined") return fallback;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  write: (key, value) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota errors */
    }
  },
  clear: (key) => {
    if (typeof window !== "undefined") window.localStorage.removeItem(key);
  },
};

const MEM_KEY = "singulo.memory.v1";
const NOTES_KEY = "singulo.notes.v1";

let adapter: MemoryAdapter = localAdapter;
export const setMemoryAdapter = (next: MemoryAdapter) => {
  adapter = next;
};

export const memoryStore = createStore<{
  session: ChatMessage[];
  persistent: MemoryEntry[];
  notes: NoteEntry[];
}>({ session: [], persistent: [], notes: [] });

export function hydrateMemory() {
  memoryStore.set({
    persistent: adapter.read<MemoryEntry[]>(MEM_KEY, []),
    notes: adapter.read<NoteEntry[]>(NOTES_KEY, []),
  });
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export function appendSessionMessage(message: Omit<ChatMessage, "id" | "createdAt">): ChatMessage {
  const full: ChatMessage = { ...message, id: uid(), createdAt: Date.now() };
  memoryStore.set((s) => ({ session: [...s.session, full] }));
  return full;
}

export function clearSession() {
  memoryStore.set({ session: [] });
}

export function rememberFact(text: string, source: MemoryEntry["source"] = "user") {
  const entry: MemoryEntry = { id: uid(), text, createdAt: Date.now(), source };
  const next = [...memoryStore.get().persistent, entry];
  memoryStore.set({ persistent: next });
  adapter.write(MEM_KEY, next);
  return entry;
}

export function forgetFact(id: string) {
  const next = memoryStore.get().persistent.filter((m) => m.id !== id);
  memoryStore.set({ persistent: next });
  adapter.write(MEM_KEY, next);
}

export function clearPersistentMemory() {
  memoryStore.set({ persistent: [] });
  adapter.clear(MEM_KEY);
}

export function upsertNote(title: string, body: string) {
  const notes = memoryStore.get().notes;
  const existing = notes.find((n) => n.title.toLowerCase() === title.toLowerCase());
  const next = existing
    ? notes.map((n) => (n.id === existing.id ? { ...n, body, updatedAt: Date.now() } : n))
    : [...notes, { id: uid(), title, body, updatedAt: Date.now() }];
  memoryStore.set({ notes: next });
  adapter.write(NOTES_KEY, next);
  return next;
}

export function deleteNote(id: string) {
  const next = memoryStore.get().notes.filter((n) => n.id !== id);
  memoryStore.set({ notes: next });
  adapter.write(NOTES_KEY, next);
}

export function clearNotes() {
  memoryStore.set({ notes: [] });
  adapter.clear(NOTES_KEY);
}

export const useMemory = memoryStore.useStore;