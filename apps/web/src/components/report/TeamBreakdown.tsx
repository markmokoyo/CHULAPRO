import type { TeamSessionReport } from '@cuepulse/shared';

export function TeamBreakdown({ report }: { report: TeamSessionReport }) {
  const nameById = new Map(report.memberReports.map((m) => [m.memberId, m.name]));

  return (
    <div className="space-y-4">
      {(report.teamBalanceScore !== undefined || report.handoffScore !== undefined) && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[#E8DCE0] bg-[#FAF6F7] p-4 shadow-sm">
            <div className="text-xs font-medium text-[#7D666F]">
              ความสมดุลการแบ่งเวลาพูด (Team Balance)
            </div>
            <div className="mt-1 text-2xl font-bold text-[#1F161A]">
              {report.teamBalanceScore ?? '-'}
              <span className="ml-1 text-sm font-normal text-[#7D666F]">/ 100</span>
            </div>
          </div>
          <div className="rounded-2xl border border-[#E8DCE0] bg-[#FAF6F7] p-4 shadow-sm">
            <div className="text-xs font-medium text-[#7D666F]">
              ความลื่นไหลการส่งไม้ต่อ (Handoff Flow)
            </div>
            <div className="mt-1 text-2xl font-bold text-[#1F161A]">
              {report.handoffScore ?? '-'}
              <span className="ml-1 text-sm font-normal text-[#7D666F]">/ 100</span>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[#F2C4D0] bg-white p-5 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-4">
          ผลวิเคราะห์รายบุคคล (Team Member Breakdown)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#F2C4D0] text-xs uppercase text-slate-500">
              <tr>
                <th className="py-2 pr-4">สมาชิก</th>
                <th className="py-2 pr-4">คะแนนรายบุคคล</th>
                <th className="py-2 pr-4">สัดส่วนเวลาพูด</th>
                <th className="py-2 pr-4">ความเร็วเฉลี่ย</th>
                <th className="py-2 pr-4">คำฟุ่มเฟือย</th>
                <th className="py-2 pr-4">Eye Contact</th>
                <th className="py-2">ความตั้งใจฟังเพื่อน</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2C4D0]">
              {report.memberReports.map((m) => (
                <tr key={m.memberId} className="text-slate-700">
                  <td className="py-3 pr-4 font-semibold text-slate-900">{m.name}</td>
                  <td className="py-3 pr-4 font-semibold text-slate-900">
                    {m.individualScore ?? '-'}
                  </td>
                  <td className="py-3 pr-4">
                    {m.speakingSharePercent}% ({m.speakingSeconds}s)
                  </td>
                  <td className="py-3 pr-4">{m.averageSpm} SPM</td>
                  <td className="py-3 pr-4">{m.fillerCount} ครั้ง</td>
                  <td className="py-3 pr-4">{m.eyeContactRatio}%</td>
                  <td className="py-3">{m.attentivenessWhileListening}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {report.handoffTransitions.length > 0 && (
        <div className="rounded-2xl border border-[#F2C4D0] bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-3">
            ความลื่นไหลในการส่งไม้ต่อ (Handoff Transitions)
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {report.handoffTransitions.map((h, i) => (
              <div
                key={i}
                className="rounded-xl border border-[#FF9EB8] bg-[#FFEFF4] p-3 text-xs"
              >
                <div className="font-semibold text-[#BE2257]">
                  {nameById.get(h.fromMemberId) ?? h.fromMemberId} →{' '}
                  {nameById.get(h.toMemberId) ?? h.toMemberId}
                </div>
                <div className="mt-1 text-slate-500">
                  นาทีที่ {Math.round(h.timestampMs / 1000)}s • ช่วงเปลี่ยนผ่าน{' '}
                  <span className="text-slate-900 font-semibold">{h.gapSeconds}s</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
