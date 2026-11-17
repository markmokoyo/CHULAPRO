'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, BellOff, Bluetooth, ExternalLink, Vibrate, Watch } from 'lucide-react';
import type { HapticCueEvent, HapticPatternType } from '@cuepulse/shared';
import {
  connectBleSmartwatch,
  getConnectedBleDeviceName,
  getOrCreateWatchPairCode,
  isWebBluetoothSupported,
  sendBleAlert,
  triggerNativeAndroidWearCue,
} from '@/services/watchBridge';

interface WatchSimulatorHUDProps {
  activeCue: HapticCueEvent | null;
  cooldownRemainingMs: number;
  liveAlertsEnabled: boolean;
  onToggleLiveAlerts: () => void;
}

const PATTERN_STYLE: Record<
  HapticPatternType,
  { ring: string; stroke: string; badge: string; label: string; vibratePattern: number[] }
> = {
  SOFT_TICK: {
    ring: 'border-[#EC3D6A] shadow-[#EC3D6A]/35',
    stroke: '#EC3D6A',
    badge: 'bg-[#FFD1DF] text-[#BE2257]',
    label: 'Soft Tick (80ms)',
    vibratePattern: [80],
  },
  DOUBLE_PULSE: {
    ring: 'border-amber-500 shadow-amber-500/35',
    stroke: '#F59E0B',
    badge: 'bg-amber-100 text-amber-800',
    label: 'Double Pulse (100ms×2)',
    vibratePattern: [100, 80, 100],
  },
  GENTLE_WAVE: {
    ring: 'border-[#CC6B92] shadow-[#CC6B92]/35',
    stroke: '#CC6B92',
    badge: 'bg-[#F7C8E0]/60 text-[#9D2954]',
    label: 'Gentle Wave (300ms)',
    vibratePattern: [300],
  },
};

const QUICK_TESTS: Array<{
  pattern: HapticPatternType;
  label: string;
  reason: HapticCueEvent['reason'];
  messageTh: string;
}> = [
  {
    pattern: 'SOFT_TICK',
    label: 'Soft Tick',
    reason: 'FILLER_WORD',
    messageTh: 'ตัวอย่าง: พบคำฟุ่มเฟือย ("อืม/อ่า") — หายใจพักสั้นๆ',
  },
  {
    pattern: 'DOUBLE_PULSE',
    label: 'Double Pulse',
    reason: 'SPEAKING_TOO_FAST',
    messageTh: 'ตัวอย่าง: พูดเร็วเกิน 220 SPM — ชะลอจังหวะลงเล็กน้อย',
  },
  {
    pattern: 'GENTLE_WAVE',
    label: 'Gentle Wave',
    reason: 'BAD_POSTURE',
    messageTh: 'ตัวอย่าง: ยืดไหล่ตรง & สบตากล้องอย่างมั่นใจ',
  },
];

const RING_RADIUS = 42;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function WatchSimulatorHUD({
  activeCue,
  cooldownRemainingMs,
  liveAlertsEnabled,
  onToggleLiveAlerts,
}: WatchSimulatorHUDProps) {
  const [previewCue, setPreviewCue] = useState<HapticCueEvent | null>(null);
  const [pairCode, setPairCode] = useState('1234');
  const [bleName, setBleName] = useState<string | null>(null);
  const [bleSupported, setBleSupported] = useState(false);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPairCode(getOrCreateWatchPairCode());
    setBleSupported(isWebBluetoothSupported());
    setBleName(getConnectedBleDeviceName());
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, []);

  const handleBleConnect = async () => {
    const res = await connectBleSmartwatch();
    if (res.connected && res.deviceName) {
      setBleName(res.deviceName);
    }
  };

  const triggerTestPattern = (preset: (typeof QUICK_TESTS)[number]) => {
    const sample: HapticCueEvent = {
      id: `preview-${Date.now()}`,
      timestampMs: 0,
      pattern: preset.pattern,
      reason: preset.reason,
      messageTh: preset.messageTh,
      slideNumber: 1,
    };
    setPreviewCue(sample);
    void sendBleAlert(preset.pattern);
    triggerNativeAndroidWearCue(sample);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(PATTERN_STYLE[preset.pattern].vibratePattern);
      } catch {
        // Ignore on unsupported browsers
      }
    }
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      setPreviewCue(null);
    }, 1800);
  };

  const displayCue = activeCue ?? previewCue;
  const cooldownSec = Math.ceil(cooldownRemainingMs / 1000);
  const cooldownProgress = Math.max(
    0,
    Math.min(100, ((20_000 - cooldownRemainingMs) / 20_000) * 100)
  );
  const style = displayCue ? PATTERN_STYLE[displayCue.pattern] : null;
  const ringRatio = displayCue ? 1 : cooldownProgress / 100;
  const ringOffset = RING_CIRCUMFERENCE * (1 - ringRatio);
  const ringStrokeColor = displayCue
    ? style?.stroke
    : cooldownSec > 0
      ? '#FB6F92'
      : '#EC3D6A';

  return (
    <div className="rounded-3xl border border-[#E8DCE0] bg-white p-4 sm:p-5 shadow-sm space-y-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-[#2B2135]">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#FCE8EE] text-[#EC3D6A]">
            <Watch className="h-4 w-4" />
          </span>
          นาฬิกาเตือนจังหวะ (จำลองสมาร์ทวอทช์)
        </div>
        <button
          type="button"
          onClick={onToggleLiveAlerts}
          className={`app-press flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            liveAlertsEnabled
              ? 'bg-[#FCE8EE] text-[#BE2257] border border-[#F2C4D0]'
              : 'bg-slate-100 text-slate-500 border border-slate-200'
          }`}
        >
          {liveAlertsEnabled ? (
            <>
              <Bell className="h-3.5 w-3.5" />
              เปิดสั่นเตือน
            </>
          ) : (
            <>
              <BellOff className="h-3.5 w-3.5" />
              ปิดสั่นเตือน
            </>
          )}
        </button>
      </div>

      <div className="flex items-center gap-4">
        {/* 3D Smartwatch Visual Frame with Live Pulse & Cooldown Badge */}
        <div className="relative h-28 w-28 shrink-0">
          {displayCue && (
            <div
              className={`animate-pulse-ring absolute -inset-1 rounded-2xl border-2 ${style?.ring}`}
            />
          )}
          <div
            className={`relative h-full w-full overflow-hidden rounded-2xl border-2 bg-[#FDF8FA] shadow-sm transition-all ${
              displayCue
                ? `animate-watch-buzz ${style?.ring}`
                : 'border-[#F2D7E0]'
            }`}
          >
            <img
              src="/images/smartwatch-cue.png"
              alt="สมาร์ทวอทช์จำลองการสั่นเตือน"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-center">
              {displayCue ? (
                <span className="rounded-full bg-[#2B2135]/90 px-2.5 py-0.5 text-[10px] font-bold text-[#FF9EB8] shadow-sm backdrop-blur-sm">
                  PULSE • {displayCue.pattern.replace('_', ' ')}
                </span>
              ) : (
                <span className="rounded-full bg-white/95 border border-[#E8DCE0] px-2.5 py-0.5 text-[10px] font-bold text-[#2B2135] shadow-sm backdrop-blur-sm tabular-nums">
                  {cooldownSec > 0 ? `พักเตือน ${cooldownSec}s` : 'READY • 20s'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status & Cooldown Bar */}
        <div className="min-w-0 flex-1 space-y-2.5">
          {displayCue ? (
            <div>
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style?.badge}`}
              >
                {style?.label}
              </span>
              <p className="mt-1.5 text-sm font-semibold text-[#1F161A] leading-snug">
                {displayCue.messageTh}
              </p>
            </div>
          ) : (
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              {liveAlertsEnabled
                ? 'พร้อมเตือนแบบไร้เสียง (พักเตือน 20 วินาที)'
                : 'ปิดการสั่นระหว่างพูดแล้ว'}
            </p>
          )}

          <div>
            <div className="mb-1 flex justify-between text-[11px] text-slate-500">
              <span>ระยะพักเตือน (20 วินาที)</span>
              <span className="font-semibold text-[#BE2257] tabular-nums">
                {cooldownSec > 0 ? `รออีก ${cooldownSec}s` : 'พร้อมเตือน'}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#F5EEF0]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#EC3D6A] to-[#8B5CF6] transition-all duration-300"
                style={{ width: `${cooldownProgress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Haptic Pattern Tester & Watch Pairing */}
      <div className="space-y-2.5 border-t border-[#E8DCE0] pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 mr-1">
            <Vibrate className="h-3.5 w-3.5 text-[#EC3D6A]" />
            ลองจังหวะสั่น:
          </span>
          {QUICK_TESTS.map((preset) => {
            const isTesting = previewCue?.pattern === preset.pattern;
            return (
              <button
                key={preset.pattern}
                type="button"
                onClick={() => triggerTestPattern(preset)}
                className={`app-press rounded-full px-3 py-1 text-[11px] font-semibold border transition-colors ${
                  isTesting
                    ? 'bg-[#EC3D6A] text-white border-[#EC3D6A] shadow-sm'
                    : 'bg-[#FAF6F7] text-[#1F161A] border-[#D8C5CB] hover:bg-[#FCE8EE]'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#EDE9FE] bg-[#F5F3FF]/60 px-3 py-2 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#6D28D9]">รหัสนาฬิกา:</span>
            <span className="rounded-lg bg-white border border-[#DDD6FE] px-2 py-0.5 font-mono font-bold text-[#2B2135] tracking-wider">
              {pairCode}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {bleSupported && (
              <button
                type="button"
                onClick={() => void handleBleConnect()}
                className={`app-press inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold transition ${
                  bleName
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-[#DDD6FE] bg-white text-[#6D28D9] hover:bg-[#EDE9FE]'
                }`}
              >
                <Bluetooth className="h-3 w-3" />
                {bleName ? bleName : 'Bluetooth'}
              </button>
            )}
            <Link
              href="/watch"
              target="_blank"
              className="app-press inline-flex items-center gap-1 rounded-full bg-[#2B2135] hover:bg-[#433352] px-2.5 py-1 font-semibold text-white"
            >
              หน้าปัดนาฬิกา
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
