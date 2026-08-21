import { createStore } from "@/lib/tiny-store";
import type { AiState } from "@/types/singulo";

export interface PermissionRequest {
  id: string;
  summary: string;
  resolve: (approved: boolean) => void;
}

export interface SinguloState {
  aiState: AiState;
  statusLine: string;
  progress: number | null;
  error: string | null;
  micLevel: number;
  speechLevel: number;
  cameraActive: boolean;
  gestureReady: boolean;
  onboarded: boolean;
  panel: "none" | "settings" | "memory" | "conversation";
  pending: PermissionRequest | null;
  lastGesture: string | null;
}

export const singuloStore = createStore<SinguloState>({
  aiState: "idle",
  statusLine: "Standby",
  progress: null,
  error: null,
  micLevel: 0,
  speechLevel: 0,
  cameraActive: false,
  gestureReady: false,
  onboarded: false,
  panel: "none",
  pending: null,
  lastGesture: null,
});

export const useSingulo = singuloStore.useStore;

export function setAiState(aiState: AiState, statusLine?: string) {
  singuloStore.set({
    aiState,
    ...(statusLine !== undefined ? { statusLine } : {}),
    ...(aiState !== "error" ? { error: null } : {}),
  });
}

export function setError(message: string) {
  singuloStore.set({ aiState: "error", error: message, statusLine: "Fault", progress: null });
}

export function clearError() {
  singuloStore.set({ aiState: "idle", error: null, statusLine: "Standby", progress: null });
}

/** Permission gate for sensitive tool execution. */
export function requestPermission(summary: string): Promise<boolean> {
  return new Promise((resolve) => {
    singuloStore.set({
      pending: {
        id: Math.random().toString(36).slice(2),
        summary,
        resolve: (approved) => {
          singuloStore.set({ pending: null });
          resolve(approved);
        },
      },
    });
  });
}