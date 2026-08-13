'use client';

import React, { useEffect, useState, useRef } from 'react';

interface PerformanceMonitorProps {
  pingMs: number | null;
  mode: string;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ pingMs, mode }) => {
  const [fps, setFps] = useState(60);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const renderCountRef = useRef(0);

  renderCountRef.current += 1;

  useEffect(() => {
    let animId: number;
    const loop = () => {
      frameCountRef.current += 1;
      const now = performance.now();
      const delta = now - lastTimeRef.current;

      if (delta >= 1000) {
        setFps(Math.round((frameCountRef.current * 1000) / delta));
        frameCountRef.current = 0;
        lastTimeRef.current = now;
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animId);
  }, []);

  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div className="fixed bottom-2 left-2 z-[999] px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-emerald-500/40 text-[9px] font-mono text-emerald-400 shadow-xl pointer-events-none select-none flex items-center gap-2">
      <span className="font-bold flex items-center gap-1">
        <span className={`w-1.5 h-1.5 rounded-full ${fps >= 50 ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        {fps} FPS
      </span>
      <span className="text-slate-600">|</span>
      <span>PING: {pingMs !== null ? `${pingMs}ms` : 'N/A'}</span>
      <span className="text-slate-600">|</span>
      <span>MODE: {mode.toUpperCase()}</span>
      <span className="text-slate-600">|</span>
      <span className="text-slate-400">R: {renderCountRef.current}</span>
    </div>
  );
};

export default PerformanceMonitor;
