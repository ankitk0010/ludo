'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { voiceEngine } from './voiceEvents';

/*
 * Owns the local microphone: getUserMedia stream, live level analysis and
 * speaking detection via voiceEngine. Used by the in-game voice controls and
 * the profile sheet so both share a single source of truth.
 */
export function useVoiceMic() {
  const [micOn, setMicOn] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const ownedRef = useRef(false);

  // Mirror voiceEngine speaking state (driven by any active mic loop).
  useEffect(() => voiceEngine.subscribe(setSpeaking), []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      analyserRef.current = null;
      if (ownedRef.current) {
        ownedRef.current = false;
        voiceEngine.setActive(false);
      }
    };
  }, []);

  // Voice-activity loop — runs while the mic is open.
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
      voiceEngine.setSpeaking(level > 0.06);
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [micOn]);

  const toggleMic = useCallback(async () => {
    if (micOn) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      analyserRef.current = null;
      ownedRef.current = false;
      voiceEngine.setActive(false);
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
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;
      voiceEngine.setActive(true);
      setMicOn(true);
    } catch {
      setMicOn(false);
      setSpeaking(false);
      setMicError('Mic permission denied or unavailable');
    } finally {
      setMicBusy(false);
    }
  }, [micOn]);

  return { micOn, micBusy, micError, speaking, toggleMic };
}

export type VoiceMicApi = ReturnType<typeof useVoiceMic>;
