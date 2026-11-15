import { Eye, Gauge, MessageSquareWarning, UserCheck } from 'lucide-react';
import type { SessionReport } from '@cuepulse/shared';

export function ScoreOverview({ report }: { report: SessionReport }) {
  const { metrics, overallScore } = report;

  const cards = [
    {
      label: 'ความเร็วในการพูด',
      value: `${metrics.averageSpm} พยางค์/นาที`,
      target: 'เกณฑ์ 180–220',
      ok: metrics.averageSpm >= 165 && metrics.averageSpm <= 230,
      icon: Gauge,
      cardCls: 'border-[#BAE6FD] bg-gradient-to-br from-white to-[#F0F9FF]',
      iconCls: 'bg-[#E0F2FE] text-[#0284C7]',
    },
    {
      label: 'คำฟุ่มเฟือย',
      value: `${metrics.fillerCount} ครั้ง`,
      target: `${metrics.fillerPerMinute} ครั้ง/นาที`,
      ok: metrics.fillerPerMinute <= 2,
      icon: MessageSquareWarning,
      cardCls: 'border-[#FBCFE8] bg-gradient-to-br from-white to-[#FFF0F5]',
      iconCls: 'bg-[#FCE8EE] text-[#EC3D6A]',
    },
    {
      label: 'การสบตาผู้ฟัง',
      value: `${metrics.eyeContactRatio}%`,
      target: 'เกณฑ์ ≥ 75%',
      ok: metrics.eyeContactRatio >= 75,
      icon: Eye,
      cardCls: 'border-[#A7F3D0] bg-gradient-to-br from-white to-[#ECFDF5]',
      iconCls: 'bg-[#D1FAE5] text-[#059669]',
    },
    {
      label: 'บุคลิกท่าทาง',
      value: `${metrics.goodPostureRatio}%`,
      target: 'เกณฑ์ ≥ 80%',
      ok: metrics.goodPostureRatio >= 80,
      icon: UserCheck,
      cardCls: 'border-[#DDD6FE] bg-gradient-to-br from-white to-[#F5F3FF]',
      iconCls: 'bg-[#EDE9FE] text-[#7C3AED]',
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-[#F9A8D4] bg-gradient-to-br from-[#EC3D6A] via-[#F472B6] to-[#8B5CF6] p-6 text-center shadow-md shadow-[#EC3D6A]/20">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/90">
          คะแนนการนำเสนอ
        </span>
        <div className="mt-2 text-5xl font-extrabold text-white tabular-nums">
          {overallScore}
        </div>
        <span className="mt-1 text-xs text-white/90">จากเต็ม 100 คะแนน</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className={`rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${c.cardCls}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-slate-600">{c.label}</p>
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${c.iconCls}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2.5 text-2xl font-bold text-[#2B2135] tabular-nums">{c.value}</p>
              <span
                className={`mt-2 inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${
                  c.ok
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {c.target}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
