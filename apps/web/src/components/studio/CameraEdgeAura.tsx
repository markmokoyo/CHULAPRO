'use client';

import type { AlertReason } from '@cuepulse/shared';

interface CameraEdgeAuraProps {
  reason: AlertReason | null;
  customLabel?: string;
}

const AURA_CONFIG: Record<
  AlertReason,
  {
    color: string;
    secondary: string;
    pillBg: string;
    pillText: string;
    label: string;
    animClass: string;
  }
> = {
  EYE_CONTACT_LOST: {
    color: 'rgba(245, 158, 11, 0.72)',
    secondary: 'rgba(251, 146, 60, 0.45)',
    pillBg: 'bg-amber-500/90',
    pillText: 'text-white',
    label: 'สบตาผู้ฟัง — มองตรงมาที่กล้อง',
    animClass: 'animate-aura-wave',
  },
  SPEAKING_TOO_FAST: {
    color: 'rgba(244, 63, 94, 0.78)',
    secondary: 'rgba(225, 29, 72, 0.5)',
    pillBg: 'bg-rose-600/90',
    pillText: 'text-white',
    label: 'พูดเร็วเกินเกณฑ์ (>240 SPM) — ผ่อนจังหวะลง',
    animClass: 'animate-aura-pulse',
  },
  FILLER_WORD: {
    color: 'rgba(236, 61, 106, 0.78)',
    secondary: 'rgba(217, 70, 239, 0.45)',
    pillBg: 'bg-[#EC3D6A]/90',
    pillText: 'text-white',
    label: 'พบคำฟุ่มเฟือย — หยุดหายใจสั้นๆ แทนการลากเสียง',
    animClass: 'animate-aura-pulse',
  },
  BAD_POSTURE: {
    color: 'rgba(139, 92, 246, 0.72)',
    secondary: 'rgba(168, 85, 247, 0.45)',
    pillBg: 'bg-violet-600/90',
    pillText: 'text-white',
    label: 'ปรับบุคลิกภาพ — ยืดไหล่ตรงและคลายมือ',
    animClass: 'animate-aura-wave',
  },
  SLIDE_TIME_WARNING: {
    color: 'rgba(14, 165, 233, 0.72)',
    secondary: 'rgba(56, 189, 248, 0.45)',
    pillBg: 'bg-sky-600/90',
    pillText: 'text-white',
    label: 'เหลือเวลาสไลด์นี้อีก 10 วินาที',
    animClass: 'animate-aura-wave',
  },
};

export function CameraEdgeAura({ reason, customLabel }: CameraEdgeAuraProps) {
  if (!reason) return null;
  const cfg = AURA_CONFIG[reason];

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
    >
      {/* Blurred moving edge aura around all four borders */}
      <div
        className={`absolute -inset-2 rounded-[inherit] ${cfg.animClass}`}
        style={{
          boxShadow: `inset 0 0 56px 18px ${cfg.color}, inset 0 0 110px 30px ${cfg.secondary}`,
        }}
      />

      {/* Top/Bottom soft edge gradients for extra depth */}
      <div
        className={`absolute inset-x-0 top-0 h-16 ${cfg.animClass}`}
        style={{
          background: `linear-gradient(to bottom, ${cfg.secondary}, transparent)`,
        }}
      />
      <div
        className={`absolute inset-x-0 bottom-0 h-16 ${cfg.animClass}`}
        style={{
          background: `linear-gradient(to top, ${cfg.secondary}, transparent)`,
        }}
      />

      {/* Compact status pill explaining what triggered the edge color */}
      <div className="absolute left-1/2 top-14 -translate-x-1/2">
        <div
          className={`rounded-full px-3.5 py-1 text-xs font-bold shadow-lg backdrop-blur-md whitespace-nowrap ${cfg.pillBg} ${cfg.pillText}`}
        >
          {customLabel || cfg.label}
        </div>
      </div>
    </div>
  );
}
