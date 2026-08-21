/**
 * Microphone capture. Records PCM via Web Audio and encodes a complete WAV
 * per segment (16 kHz mono) so every upload is a decodable file on any browser.
 */
export interface RecorderHandle {
  stop: () => Promise<Blob>;
  cancel: () => void;
  level: () => number;
  deviceLabel: string;
}

const TARGET_RATE = 16_000;

function downsample(chunks: Float32Array[], from: number, to: number): Float32Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  if (from === to) return merged;
  const ratio = from / to;
  const outLength = Math.floor(merged.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(merged.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += merged[j] ?? 0;
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export async function startRecording(deviceId?: string | null): Promise<RecorderHandle> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not expose microphone access.");
  }
  // Stable capture: browser DSP on, mono, and a graceful fall-back if the
  // selected device disappeared since it was picked in settings.
  const constraints: MediaTrackConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
  };
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { ...constraints, deviceId: { exact: deviceId } } : constraints,
    });
  } catch {
    stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
  }
  const ctx = new AudioContext();
  if (ctx.state === "suspended") await ctx.resume().catch(() => {});
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  const processor = ctx.createScriptProcessor(2048, 1, 1);
  const chunks: Float32Array[] = [];
  processor.onaudioprocess = (event) => {
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  };
  source.connect(analyser);
  source.connect(processor);
  processor.connect(ctx.destination);
  const levelData = new Uint8Array(analyser.fftSize);

  const teardown = () => {
    processor.onaudioprocess = null;
    processor.disconnect();
    analyser.disconnect();
    source.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => {});
  };

  return {
    deviceLabel: stream.getAudioTracks()[0]?.label ?? "Microphone",
    level: () => {
      analyser.getByteTimeDomainData(levelData);
      let peak = 0;
      for (let i = 0; i < levelData.length; i++) {
        peak = Math.max(peak, Math.abs((levelData[i] ?? 128) - 128) / 128);
      }
      return peak;
    },
    cancel: teardown,
    stop: async () => {
      const rate = ctx.sampleRate;
      teardown();
      const samples = downsample(chunks, rate, TARGET_RATE);
      return encodeWav(samples, TARGET_RATE);
    },
  };
}