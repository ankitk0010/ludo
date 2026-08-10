'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { voiceEngine } from './voiceEvents';

function float32ToInt16Base64(floats: Float32Array): string {
  const int16 = new Int16Array(floats.length);
  for (let i = 0; i < floats.length; i++) {
    const s = Math.max(-1, Math.min(1, floats[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  let binary = '';
  const bytes = new Uint8Array(int16.buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/*
 * Owns the local microphone: getUserMedia stream, live level analysis, speaking detection
 * and real-time PCM audio chunk streaming for online rooms.
 */
export function useVoiceMic(options?: {
  onAudioChunk?: (base64: string, mimeType: string) => void;
}) {
  const [micOn, setMicOn] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const ownedRef = useRef(false);
  const speakingRef = useRef(false);
  const onAudioChunkRef = useRef(options?.onAudioChunk);

  useEffect(() => {
    onAudioChunkRef.current = options?.onAudioChunk;
  }, [options?.onAudioChunk]);

  // Mirror voiceEngine speaking state
  useEffect(() => voiceEngine.subscribe(setSpeaking), []);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (scriptNodeRef.current) {
      try {
        scriptNodeRef.current.disconnect();
      } catch {}
      scriptNodeRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {}
      audioCtxRef.current = null;
    }
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    analyserRef.current = null;
    if (ownedRef.current) {
      ownedRef.current = false;
      voiceEngine.setActive(false);
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  // Voice-activity loop — runs while mic is open
  useEffect(() => {
    if (!micOn || !analyserRef.current) return;
    const analyser = analyserRef.current;
    const data = new Uint8Array(analyser.frequencyBinCount);

    ownedRef.current = true;
    voiceEngine.setActive(true);

    const loop = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i += 8) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const level = Math.sqrt(sum / (data.length / 8));
      const isSpeakingNow = level > 0.04;
      speakingRef.current = isSpeakingNow;
      voiceEngine.setSpeaking(isSpeakingNow);
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [micOn]);

  const toggleMic = useCallback(async () => {
    if (micOn) {
      cleanup();
      setMicOn(false);
      setSpeaking(false);
      setMicError(null);
      return;
    }

    setMicBusy(true);
    setMicError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Real-time PCM Audio Streaming via ScriptProcessor
      const scriptNode = ctx.createScriptProcessor(2048, 1, 1);
      source.connect(scriptNode);
      scriptNode.connect(ctx.destination);

      let lastSendTs = 0;
      scriptNode.onaudioprocess = (e) => {
        const now = Date.now();
        if (!speakingRef.current || !onAudioChunkRef.current) return;
        if (now - lastSendTs < 120) return; // Throttle to max 8 packets / sec (~125ms audio)
        lastSendTs = now;

        const input = e.inputBuffer.getChannelData(0);
        const base64 = float32ToInt16Base64(input);
        onAudioChunkRef.current(base64, `pcm/${ctx.sampleRate}`);
      };
      scriptNodeRef.current = scriptNode;

      voiceEngine.setActive(true);
      setMicOn(true);
    } catch {
      cleanup();
      setMicOn(false);
      setSpeaking(false);
      setMicError('Mic permission denied or unavailable');
    } finally {
      setMicBusy(false);
    }
  }, [micOn, cleanup]);

  return { micOn, micBusy, micError, speaking, toggleMic };
}

export type VoiceMicApi = ReturnType<typeof useVoiceMic>;
