'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Radio,
  Vibrate,
  Watch,
} from 'lucide-react';
import type { WatchTelemetryState } from '@/app/api/watch-sync/route';
import {
  getOrCreateWatchPairCode,
  pollWatchState,
  saveWatchPairCode,
  sendWatchRemoteCommand,
  vibrateDevice,
} from '@/services/watchBridge';

export default function WatchCompanionPage() {
  const [pairCode, setPairCode] = useState('1234');
  const [inputCode, setInputCode] = useState('1234');
  const [state, setState] = useState<WatchTelemetryState | null>(null);
  const [connected, setConnected] = useState(false);
  const [remoteToast, setRemoteToast] = useState<string | null>(null);
  const lastCueIdRef = useRef<string | null>(null);

  useEffect(() => {
    const initial = getOrCreateWatchPairCode();
    setPairCode(initial);
    setInputCode(initial);
  }, []);

  const syncOnce = useCallback(async (code: string) => {
    if (!/^\d{4}$/.test(code)) return;
    const latest = await pollWatchState(code);
    if (latest) {
      setConnected(true);
      setState(latest);
      if (latest.activeCue && latest.activeCue.id !== lastCueIdRef.current) {
        lastCueIdRef.current = latest.activeCue.id;
        vibrateDevice(latest.activeCue.pattern);
      }
    } else {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    void syncOnce(pairCode);
    const timer = setInterval(() => {
      void syncOnce(pairCode);
    }, 1000);

    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('cuepulse_watch_sync_v1');
      bc.onmessage = (ev) => {
        const msg = ev.data as {
          type?: string;
          pairCode?: string;
          state?: Partial<WatchTelemetryState>;
        };
        if (msg.type === 'studio_update' && msg.pairCode === pairCode && msg.state) {
          setConnected(true);
          setState((prev) => ({
            pairCode,
            isRunning: msg.state?.isRunning ?? prev?.isRunning ?? false,
            mode: msg.state?.mode ?? prev?.mode ?? 'solo',
            currentSpm: msg.state?.currentSpm ?? prev?.currentSpm ?? 0,
            slideNumber: msg.state?.slideNumber ?? prev?.slideNumber ?? 1,
            totalSlides: msg.state?.totalSlides ?? prev?.totalSlides ?? 1,
            remainingSeconds: msg.state?.remainingSeconds ?? prev?.remainingSeconds ?? null,
            cooldownRemainingMs: msg.state?.cooldownRemainingMs ?? prev?.cooldownRemainingMs ?? 0,
            activeCue: msg.state?.activeCue ?? null,
            updatedAtMs: Date.now(),
          }));
          if (msg.state.activeCue && msg.state.activeCue.id !== lastCueIdRef.current) {
            lastCueIdRef.current = msg.state.activeCue.id;
            vibrateDevice(msg.state.activeCue.pattern);
          }
        }
      };
    }

    return () => {
      clearInterval(timer);
      bc?.close();
    };
  }, [pairCode, syncOnce]);

  const handlePairSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(inputCode)) return;
    saveWatchPairCode(inputCode);
    setPairCode(inputCode);
    lastCueIdRef.current = null;
    void syncOnce(inputCode);
  };

  const sendCommand = async (cmd: 'PREV_SLIDE' | 'NEXT_SLIDE' | 'PING_VIBRATE') => {
    vibrateDevice('SOFT_TICK');
    const ok = await sendWatchRemoteCommand(pairCode, cmd);
    setRemoteToast(
      ok
        ? cmd === 'NEXT_SLIDE'
          ? 'ส่งคำสั่ง: สไลด์ถัดไป'
          : cmd === 'PREV_SLIDE'
            ? 'ส่งคำสั่ง: สไลด์ก่อนหน้า'
            : 'ทดสอบส่งสัญญาณสั่นแล้ว'
        : 'กำลังซิงก์ในเครื่องเดียวกัน'
    );
    setTimeout(() => setRemoteToast(null), 1600);
  };

  const cooldownSec = state ? Math.ceil(state.cooldownRemainingMs / 1000) : 0;
  const activeCue = state?.activeCue ?? null;

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href="/practice/solo"
          className="app-press inline-flex items-center gap-1.5 rounded-full border border-[#E8DCE0] bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-[#EC3D6A] hover:text-[#EC3D6A]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          กลับห้องซ้อม
        </Link>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
            connected
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}
        >
          <Radio className="h-3.5 w-3.5" />
          {connected ? 'เชื่อมต่อห้องซ้อมแล้ว' : 'รอสัญญาณจากห้องซ้อม'}
        </span>
      </div>

      {/* OLED Circular Smartwatch Face */}
      <div className="flex flex-col items-center rounded-[2.5rem] border-4 border-[#2B2135] bg-[#120D18] p-6 text-white shadow-2xl space-y-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#F9A8D4]">
          <Watch className="h-4 w-4" />
          CuePulse Watch • #{pairCode}
        </div>

        {/* Circular Gauge */}
        <div
          className={`relative flex h-56 w-56 flex-col items-center justify-center rounded-full border-4 text-center transition-all ${
            activeCue
              ? 'animate-watch-buzz border-[#EC3D6A] bg-[#2D1426] shadow-[0_0_32px_rgba(236,61,106,0.45)]'
              : state?.isRunning
                ? 'border-[#8B5CF6] bg-[#1D1529]'
                : 'border-[#332744] bg-[#191224]'
          }`}
        >
          {activeCue ? (
            <div className="px-5 space-y-1.5">
              <span className="inline-block rounded-full bg-[#EC3D6A] px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-white">
                PULSE ALERT
              </span>
              <p className="text-sm font-bold text-white leading-snug">
                {activeCue.messageTh}
              </p>
            </div>
          ) : (
            <>
              <span className="text-[11px] font-medium text-slate-400">
                ความเร็วพูด (SPM)
              </span>
              <span className="font-display text-5xl font-extrabold text-white tabular-nums mt-0.5">
                {state?.currentSpm ?? 0}
              </span>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-semibold text-[#F9A8D4] tabular-nums">
                  สไลด์ {state?.slideNumber ?? 1}/{state?.totalSlides ?? 1}
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-semibold text-emerald-300 tabular-nums">
                  {cooldownSec > 0 ? `พัก ${cooldownSec}s` : 'พร้อมเตือน'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Remote Slide Clicker Controls */}
        <div className="grid w-full grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => void sendCommand('PREV_SLIDE')}
            className="app-press flex items-center justify-center gap-1 rounded-2xl bg-white/10 hover:bg-white/20 py-3 text-xs font-bold text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            สไลด์ก่อนหน้า
          </button>
          <button
            type="button"
            onClick={() => void sendCommand('NEXT_SLIDE')}
            className="app-press flex items-center justify-center gap-1 rounded-2xl bg-[#EC3D6A] hover:bg-[#F472B6] py-3 text-xs font-bold text-white"
          >
            สไลด์ถัดไป
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => void sendCommand('PING_VIBRATE')}
          className="app-press inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-1.5 text-[11px] font-semibold text-slate-300"
        >
          <Vibrate className="h-3.5 w-3.5 text-[#F472B6]" />
          ทดสอบสั่นบนข้อมือ
        </button>

        {remoteToast && (
          <p className="text-[11px] font-medium text-emerald-300">{remoteToast}</p>
        )}
      </div>

      {/* 4-Digit Pairing Form */}
      <form
        onSubmit={handlePairSubmit}
        className="flex items-center justify-between gap-2 rounded-2xl border border-[#E8DCE0] bg-white p-3.5 shadow-sm"
      >
        <label htmlFor="watch-pin" className="text-xs font-semibold text-[#2B2135]">
          รหัสจับคู่ 4 หลัก:
        </label>
        <div className="flex items-center gap-2">
          <input
            id="watch-pin"
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="w-20 rounded-xl border border-[#D8C5CB] bg-[#FAF6F7] px-2.5 py-1.5 text-center font-mono text-sm font-bold tracking-widest text-[#1F161A] focus:outline-none focus:border-[#EC3D6A]"
          />
          <button
            type="submit"
            disabled={inputCode.length !== 4}
            className="app-press rounded-xl bg-[#2B2135] px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-40"
          >
            เชื่อมต่อ
          </button>
        </div>
      </form>
    </div>
  );
}
