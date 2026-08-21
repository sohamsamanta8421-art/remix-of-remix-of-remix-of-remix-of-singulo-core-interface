/**
 * Streaming text-to-speech playback. PCM chunks arrive over SSE from
 * /api/ai/speak and are scheduled on an AudioContext so playback starts
 * before generation finishes. Interruptible at any time.
 */
export interface SpeakOptions {
  voice: string;
  speed: number;
  volume: number;
  onLevel?: (level: number) => void;
  onStart?: () => void;
}

let active: { controller: AbortController; stop: () => void } | null = null;

export function isSpeaking() {
  return active !== null;
}

export function stopSpeaking() {
  active?.stop();
  active = null;
}

export async function speak(text: string, options: SpeakOptions): Promise<void> {
  stopSpeaking();
  const controller = new AbortController();
  const ctx = new AudioContext({ sampleRate: 24_000 });
  if (ctx.state === "suspended") await ctx.resume().catch(() => {});
  const gain = ctx.createGain();
  gain.gain.value = Math.max(0, Math.min(1, options.volume));
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  gain.connect(analyser);
  gain.connect(ctx.destination);

  let raf = 0;
  const levelData = new Uint8Array(analyser.fftSize);
  const tickLevel = () => {
    analyser.getByteTimeDomainData(levelData);
    let peak = 0;
    for (let i = 0; i < levelData.length; i++) {
      peak = Math.max(peak, Math.abs((levelData[i] ?? 128) - 128) / 128);
    }
    options.onLevel?.(peak);
    raf = requestAnimationFrame(tickLevel);
  };

  const stop = () => {
    controller.abort();
    cancelAnimationFrame(raf);
    options.onLevel?.(0);
    void ctx.close().catch(() => {});
  };
  active = { controller, stop };

  let playhead = 0;
  let pending = new Uint8Array(0);

  const playChunk = (incoming: Uint8Array) => {
    const bytes = new Uint8Array(pending.length + incoming.length);
    bytes.set(pending);
    bytes.set(incoming, pending.length);
    const usable = bytes.length - (bytes.length % 2);
    pending = bytes.slice(usable);
    if (usable === 0) return;
    const samples = new Int16Array(bytes.buffer, 0, usable / 2);
    const floats = Float32Array.from(samples, (s) => s / 32768);
    const buffer = ctx.createBuffer(1, floats.length, 24_000);
    buffer.copyToChannel(floats, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    if (playhead === 0) playhead = ctx.currentTime + 0.06;
    else playhead = Math.max(playhead, ctx.currentTime);
    source.start(playhead);
    playhead += buffer.duration;
  };

  try {
    const response = await fetch("/api/ai/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice: options.voice, speed: options.speed }),
      signal: controller.signal,
    });
    if (!response.ok || !response.body) {
      const detail = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(detail?.error ?? `Speech synthesis failed (${response.status}).`);
    }
    options.onStart?.();
    tickLevel();

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffered = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffered += value;
      const parts = buffered.split("\n\n");
      buffered = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data:"));
        if (!line) continue;
        const payloadRaw = line.slice(5).trim();
        if (!payloadRaw || payloadRaw === "[DONE]") continue;
        let payload: { type?: string; audio?: string };
        try {
          payload = JSON.parse(payloadRaw);
        } catch {
          continue;
        }
        if (payload.type !== "speech.audio.delta" || !payload.audio) continue;
        const binary = atob(payload.audio);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        playChunk(bytes);
      }
    }
    // let the queued audio finish before releasing the context
    const remaining = Math.max(0, playhead - ctx.currentTime) * 1000;
    await new Promise((resolve) => setTimeout(resolve, remaining + 120));
  } finally {
    cancelAnimationFrame(raf);
    options.onLevel?.(0);
    if (active?.controller === controller) {
      active = null;
      void ctx.close().catch(() => {});
    }
  }
}