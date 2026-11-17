'use client';

import { useEffect, useState } from 'react';

const SPLASH_KEY = 'cuepulse_splash_shown_v1';

export function AppSplashScreen() {
  const [phase, setPhase] = useState<'visible' | 'exiting' | 'hidden'>('hidden');
  const [progress, setProgress] = useState(18);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const alreadyShown = window.sessionStorage.getItem(SPLASH_KEY) === '1';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (alreadyShown || reduceMotion) {
      window.sessionStorage.setItem(SPLASH_KEY, '1');
      setPhase('hidden');
      return;
    }

    setPhase('visible');
    const progTimer = setTimeout(() => setProgress(100), 60);
    const exitTimer = setTimeout(() => {
      setPhase('exiting');
      window.sessionStorage.setItem(SPLASH_KEY, '1');
    }, 950);
    const hideTimer = setTimeout(() => {
      setPhase('hidden');
    }, 1380);

    return () => {
      clearTimeout(progTimer);
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (phase === 'hidden') return null;

  const dismissNow = () => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(SPLASH_KEY, '1');
    }
    setPhase('exiting');
    setTimeout(() => setPhase('hidden'), 280);
  };

  return (
    <div
      role="status"
      aria-label="กำลังเปิดใช้งานแอป CuePulse AI"
      onClick={dismissNow}
      className={`fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center bg-[#FDF8FA] px-6 transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        phase === 'exiting'
          ? 'pointer-events-none scale-[1.02] opacity-0'
          : 'scale-100 opacity-100'
      }`}
    >
      <div className="pointer-events-none flex flex-col items-center text-center space-y-5 max-w-xs">
        {/* App Icon Emblem with Pulse Ring */}
        <div className="relative flex h-20 w-20 items-center justify-center">
          <span
            aria-hidden="true"
            className="animate-pulse-ring absolute inset-0 rounded-3xl border-2 border-[#EC3D6A]/45"
          />
          <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-[#F2D7E0] bg-white p-2.5 shadow-lg shadow-[#EC3D6A]/10">
            <img
              src="/logo-chula.jpg"
              alt="ตราพระเกี้ยว"
              className="h-full w-full object-contain"
            />
          </div>
        </div>

        {/* Studio Illustration Preview */}
        <div className="overflow-hidden rounded-2xl border border-[#E8DCE0] bg-white/80 p-1.5 shadow-sm">
          <img
            src="/images/app-hero-studio.png"
            alt="CuePulse AI Studio"
            className="h-24 w-40 rounded-xl object-cover"
          />
        </div>

        {/* App Title & Subtitle */}
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-[#2B2135]">
            CuePulse AI
          </h1>
          <p className="text-xs font-medium text-slate-500">
            สตูดิโอฝึกซ้อมการนำเสนอ • จุฬาลงกรณ์มหาวิทยาลัย
          </p>
        </div>

        {/* Smooth App Launch Progress Pill */}
        <div className="w-44 space-y-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F3E6EB]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#EC3D6A] via-[#8B5CF6] to-[#0EA5E9] transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] font-medium text-slate-400">
            กำลังเตรียมห้องซ้อม... (แตะเพื่อข้าม)
          </p>
        </div>
      </div>
    </div>
  );
}
