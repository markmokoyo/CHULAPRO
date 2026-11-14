import type { SessionReport } from '@cuepulse/shared';

export function ScoreOverview({ report }: { report: SessionReport }) {
  const { metrics, overallScore } = report;

  const cards = [
    {
      label: 'ความเร็วในการพูด',
      value: `${metrics.averageSpm} พยางค์/นาที`,
      target: 'เกณฑ์ 180–220',
      ok: metrics.averageSpm >= 165 && metrics.averageSpm <= 230,
    },
    {
      label: 'คำฟุ่มเฟือย',
      value: `${metrics.fillerCount} ครั้ง`,
      target: `${metrics.fillerPerMinute} ครั้ง/นาที`,
      ok: metrics.fillerPerMinute <= 2,
    },
    {
      label: 'การสบตาผู้ฟัง',
      value: `${metrics.eyeContactRatio}%`,
      target: 'เกณฑ์ ≥ 75%',
      ok: metrics.eyeContactRatio >= 75,
    },
    {
      label: 'บุคลิกท่าทาง',
      value: `${metrics.goodPostureRatio}%`,
      target: 'เกณฑ์ ≥ 80%',
      ok: metrics.goodPostureRatio >= 80,
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-[#FB6F92] bg-gradient-to-br from-[#EC3D6A] to-[#CC6B92] p-6 text-center shadow-md shadow-[#EC3D6A]/20">
        <span className="text-xs font-semibold uppercase tracking-wider text-white/90">
          Overall Score
        </span>
        <div className="mt-2 text-5xl font-extrabold text-white">
          {overallScore}
        </div>
        <span className="mt-1 text-xs text-white/85">จากเต็ม 100 คะแนน</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-[#F2C4D0] bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-medium text-slate-500">{c.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{c.value}</p>
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
        ))}
      </div>
    </div>
  );
}
