"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
 * Records the microphone as a 16 kHz mono WAV.
 *
 * Why not MediaRecorder: it produces webm/opus in Chrome and mp4/aac in
 * Safari, and Google Speech-to-Text does not accept mp4. Raw PCM from the Web
 * Audio API, encoded here as WAV, works in every browser and needs no codec.
 * 16 kHz mono is what speech models are trained on, and keeps a 10 s clip
 * around 320 KB.
 *
 * Nothing is uploaded here. Every finished recording — whether the learner
 * tapped stop or it hit MAX_SECONDS — is handed to `onRecorded`.
 */

export type RecorderError = "denied" | "no_mic" | "unsupported" | "failed";
type State = "idle" | "starting" | "recording";

const TARGET_RATE = 16_000;
const MAX_SECONDS = 12;

// Copies each block of input samples to the main thread.
const TAP = `class Tap extends AudioWorkletProcessor {
  process(inputs) { const c = inputs[0] && inputs[0][0]; if (c) this.port.postMessage(c.slice(0)); return true; }
}
registerProcessor("mizizi-tap", Tap);`;

function downsample(samples: Float32Array, from: number): Float32Array {
  if (from === TARGET_RATE) return samples;
  const ratio = from / TARGET_RATE;
  const out = new Float32Array(Math.floor(samples.length / ratio));
  for (let i = 0; i < out.length; i++) {
    // Average the source samples this output sample covers — a cheap low-pass.
    const start = Math.floor(i * ratio);
    const end = Math.min(samples.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += samples[j];
    out[i] = sum / Math.max(end - start, 1);
  }
  return out;
}

function encodeWav(samples: Float32Array): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, TARGET_RATE, true);
  view.setUint32(28, TARGET_RATE * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export function useRecorder(onRecorded: (wav: Blob | null) => void) {
  const [state, setState] = useState<State>("idle");
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<RecorderError | null>(null);

  const parts = useRef<{
    stream: MediaStream;
    context: AudioContext;
    chunks: Float32Array[];
    cleanup: () => void;
    startedAt: number;
  } | null>(null);
  const callback = useRef(onRecorded);
  useEffect(() => {
    callback.current = onRecorded;
  }, [onRecorded]);
  const autoStop = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meter = useRef(0);

  const finish = useCallback(async (deliver = true): Promise<void> => {
    const current = parts.current;
    if (!current) return;
    parts.current = null;
    if (autoStop.current) clearTimeout(autoStop.current);
    current.cleanup();
    current.stream.getTracks().forEach((t) => t.stop());
    const rate = current.context.sampleRate;
    await current.context.close().catch(() => {});
    setState("idle");
    setLevel(0);

    const length = current.chunks.reduce((n, c) => n + c.length, 0);
    const merged = new Float32Array(length);
    let offset = 0;
    for (const chunk of current.chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    if (deliver) callback.current(length > 0 ? encodeWav(downsample(merged, rate)) : null);
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    if (parts.current) return true;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === "undefined") {
      setError("unsupported");
      return false;
    }
    setState("starting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      const name = (e as DOMException)?.name;
      setError(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" ? "no_mic" : "failed");
      setState("idle");
      return false;
    }

    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const chunks: Float32Array[] = [];
    const onSamples = (samples: Float32Array) => {
      chunks.push(samples);
      let sum = 0;
      for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
      meter.current = Math.min(1, Math.sqrt(sum / samples.length) * 6);
    };

    // A silent sink keeps the graph pulling audio without playing it back.
    const sink = context.createGain();
    sink.gain.value = 0;
    sink.connect(context.destination);

    let cleanup: () => void;
    if (context.audioWorklet) {
      const url = URL.createObjectURL(new Blob([TAP], { type: "text/javascript" }));
      await context.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      const node = new AudioWorkletNode(context, "mizizi-tap");
      node.port.onmessage = (e) => onSamples(e.data as Float32Array);
      source.connect(node).connect(sink);
      cleanup = () => {
        node.port.onmessage = null;
        source.disconnect();
        node.disconnect();
      };
    } else {
      // Older Safari: the deprecated but universally supported fallback.
      const node = context.createScriptProcessor(4096, 1, 1);
      node.onaudioprocess = (e) => onSamples(new Float32Array(e.inputBuffer.getChannelData(0)));
      source.connect(node).connect(sink);
      cleanup = () => {
        node.onaudioprocess = null;
        source.disconnect();
        node.disconnect();
      };
    }

    parts.current = { stream, context, chunks, cleanup, startedAt: Date.now() };
    autoStop.current = setTimeout(() => void finish(), MAX_SECONDS * 1000);
    setElapsed(0);
    setState("recording");
    return true;
  }, [finish]);

  // Meter and timer, at animation-frame rate but only while recording.
  useEffect(() => {
    if (state !== "recording") return;
    let frame = 0;
    const tick = () => {
      setLevel((l) => l * 0.6 + meter.current * 0.4);
      if (parts.current) setElapsed((Date.now() - parts.current.startedAt) / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [state]);

  // Release the microphone if the component goes away mid-recording.
  useEffect(() => () => void finish(false), [finish]);

  const stop = useCallback(() => void finish(), [finish]);
  return { state, level, elapsed, error, maxSeconds: MAX_SECONDS, start, stop };
}
