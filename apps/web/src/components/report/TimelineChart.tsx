import type { FillerOccurrence, HapticCueEvent, TelemetrySnapshot } from '@cuepulse/shared';

interface TimelineChartProps {
  timeline: TelemetrySnapshot[];
  fillers: FillerOccurrence[];
  hapticCues: HapticCueEvent[];
}

export function TimelineChart({
  timeline,
  fillers,
  hapticCues,
}: TimelineChartProps) {
  if (timeline.length === 0) {
    return (
      <div className="rounded-2xl border border-[#F2C4D0] bg-white p-6 text-sm text-slate-500 shadow-sm">
        ยังไม่มีข้อมูลกราฟเวลาในเซสชันนี้
      </div>
    );
  }

  const maxBars = 48;
  const step = Math.max(1, Math.floor(timeline.length / maxBars));
  const sampled = timeline.filter((_, i) => i % step === 0).slice(0, maxBars);

  return (
    <div className="rounded-2xl border border-[#E8DCE0] bg-white p-5 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-[#2B2135]">
          ไทม์ไลน์ความเร็วและบุคลิกภาพ
        </h3>
        <div className="flex items-center gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#0EA5E9]" />
            ความเร็ว (SPM)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#10B981]" />
            Eye Contact
          </span>
        </div>
      </div>

      <div className="flex h-36 items-end gap-1 rounded-xl bg-gradient-to-b from-[#F0F9FF] to-[#FFF0F5] p-3 border border-[#BAE6FD]">
        {sampled.map((pt, i) => {
          const spmHeight = Math.min(100, Math.round((pt.currentSpm / 280) * 100));
          const eyeHeight = Math.round(pt.eyeContactScore * 100);
          return (
            <div
              key={i}
              className="flex flex-1 items-end gap-0.5 h-full"
              title={`${Math.round(pt.timestampMs / 1000)}s | SPM: ${pt.currentSpm} | Eye: ${eyeHeight}%`}
            >
              <div
                className="w-1/2 rounded-t bg-[#0EA5E9]"
                style={{ height: `${Math.max(4, spmHeight)}%` }}
              />
              <div
                className="w-1/2 rounded-t bg-[#10B981]"
                style={{ height: `${Math.max(4, eyeHeight)}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-[#FFF0F5] border border-[#FBCFE8] p-3">
          <p className="text-xs font-semibold text-slate-700 mb-2">
            คำฟุ่มเฟือยที่ตรวจพบ ({fillers.length})
          </p>
          {fillers.length === 0 ? (
            <p className="text-xs text-emerald-700">ยอดเยี่ยม! ไม่พบคำฟุ่มเฟือย</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {fillers.map((f, idx) => (
                <span
                  key={idx}
                  className="rounded-md bg-rose-50 border border-rose-200 px-2 py-0.5 text-xs text-rose-700"
                >
                  {f.word} ({Math.round(f.timestampMs / 1000)}s)
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl bg-[#FFEFF4] border border-[#F2C4D0] p-3">
          <p className="text-xs font-semibold text-slate-700 mb-2">
            ประวัติการสั่นเตือน ({hapticCues.length})
          </p>
          {hapticCues.length === 0 ? (
            <p className="text-xs text-emerald-700">ไม่มีเหตุการณ์เตือนระหว่างพูด</p>
          ) : (
            <ul className="space-y-1 text-xs text-slate-600 max-h-24 overflow-y-auto">
              {hapticCues.map((c) => (
                <li key={c.id}>
                  <span className="text-[#EC3D6A] font-semibold">
                    [{Math.round(c.timestampMs / 1000)}s]
                  </span>{' '}
                  {c.messageTh}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
