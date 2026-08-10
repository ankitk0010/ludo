'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { voiceEngine } from './voiceEvents';

/*
 * Owns the local microphone: getUserMedia stream, live level analysis and
 * speaking detection via voiceEngine. Used by the in-game voice controls and
 * the profile sheet so both share a single source of truth.
 */
export function useVoiceMic(options?: {
  onAudioChunk?: (base64: string, mimeType: string) => void;
}) {
  const [micOn, setMicOn] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const rafRef = useRef<number | null>(null);
  const ownedRef = useRef(false);
  const speakingRef = useRef(false);
  const onAudioChunkRef = useRef(options?.onAudioChunk);

  useEffect(() => {
    onAudioChunkRef.current = options?.onAudioChunk;
  }, [options?.onAudioChunk]);

  // Mirror voiceEngine speaking state (driven by any active mic loop).
  useEffect(() => voiceEngine.subscribe(setSpeaking), []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {}
      }
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      analyserRef.current = null;
      recorderRef.current = null;
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
      const isSpeakingNow = level > 0.05;
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop();
        } catch {}
      }
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      analyserRef.current = null;
      recorderRef.current = null;
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

      // Start MediaRecorder for live voice audio transmission
      if (typeof MediaRecorder !== 'undefined') {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : MediaRecorder.isTypeSupported('audio/mp4')
              ? 'audio/mp4'
              : '';

        const recorderOptions = mimeType ? { mimeType } : undefined;
        const recorder = new MediaRecorder(stream, recorderOptions);

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0 && speakingRef.current && onAudioChunkRef.current) {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              if (result) {
                const base64 = result.split(',')[1] || result;
                onAudioChunkRef.current?.(base64, recorder.mimeType || mimeType || 'audio/webm');
              }
            };
            reader.readAsDataURL(e.data);
          }
        };
        recorder.start(350); // 350ms audio slices
        recorderRef.current = recorder;
      }

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
