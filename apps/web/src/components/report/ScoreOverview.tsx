import { Eye, Gauge, MessageSquareWarning, UserCheck } from 'lucide-react';
import {
  calculateFluencyScore,
  calculatePacingScore,
  scoreToStars,
  type SessionReport,
  type StarRating,
} from '@cuepulse/shared';

function StarDisplay({
  stars,
  size = 'md',
}: {
  stars: StarRating;
  size?: 'md' | 'lg';
}) {
  const activeColor =
    stars === 1 ? '#EF4444' : stars === 5 ? '#9333EA' : '#EAB308';
  const starSizeCls = size === 'lg' ? 'text-2xl sm:text-3xl leading-none' : 'text-xl leading-none';
  const countSizeCls = size === 'lg' ? 'text-sm sm:text-base' : 'text-sm';

  return (
    <span className="inline-flex items-center gap-1 font-semibold tracking-tight">
      <span className={starSizeCls} style={{ color: activeColor }}>
        {'★'.repeat(stars)}
      </span>
      {stars < 5 && (
        <span className={starSizeCls} style={{ color: '#D1D5DB' }}>
          {'★'.repeat(5 - stars)}
        </span>
      )}
      <span className={`ml-1 font-bold text-slate-700 tabular-nums ${countSizeCls}`}>
        ({stars}/5)
      </span>
    </span>
  );
}

const OVERALL_FEEDBACK: Record<StarRating, string> = {
  1: 'ชื่นชมความกล้าและความตั้งใจเริ่มต้นฝึกซ้อมครับ ลองปรับจังหวะการพูดและสบตากล้องเพิ่มอีกนิด จะพัฒนาขึ้นได้เร็วมาก',
  2: 'วางโครงสร้างการนำเสนอได้ดีเป็นพื้นฐานแล้ว แนะนำให้ฝึกซ้อมซ้ำเพื่อคุมจังหวะและลดคำติดปาก จะช่วยให้ดูมั่นใจยิ่งขึ้น',
  3: 'นำเสนอได้ตามมาตรฐาน ฟังเข้าใจง่ายและครบถ้วน ลองเพิ่มพลังเสียงและการสบตาในจุดสำคัญ จะทำให้น่าติดตามยิ่งขึ้น',
  4: 'ยอดเยี่ยมมากครับ มีคุณภาพระดับมืออาชีพและใส่ใจรายละเอียดดีเยี่ยม เหลือเพียงขัดเกลาความสม่ำเสมออีกเล็กน้อยเท่านั้น',
  5: 'สมบูรณ์แบบระดับมาสเตอร์พีซ! คุมจังหวะ น้ำเสียง สายตา และบุคลิกภาพได้ครบถ้วนและทรงพลังในทุกมิติ',
};

const TOPIC_FEEDBACK: Record<
  'fluency' | 'pacing' | 'eye' | 'posture',
  Record<StarRating, string>
> = {
  fluency: {
    1: 'เริ่มต้นกล้าพูดได้ต่อเนื่องดีครับ ลองหยุดหายใจสั้นๆ แทนคำว่า อืม/อ่า จะช่วยให้ประโยคคมชัดขึ้น',
    2: 'จับใจความหลักได้ดีแล้ว แนะนำให้เว้นวรรคตอนแทนคำฟุ่มเฟือยในจุดเปลี่ยนหัวข้อ จะลื่นไหลขึ้นมาก',
    3: 'การพูดลื่นไหลได้มาตรฐาน เข้าใจง่าย ลดคำติดปากช่วงเชื่อมต่อประโยคอีกเล็กน้อยจะยิ่งน่าฟัง',
    4: 'คุมจังหวะคำพูดได้ยอดเยี่ยม ระดับมืออาชีพ แทบไม่มีคำฟุ่มเฟือย เหลือเพียงขัดเกลาช่วงเร่งจังหวะอีกนิดเดียว',
    5: 'ความลื่นไหลสมบูรณ์แบบไร้ที่ติ พูดได้ชัดเจน ทรงพลัง และไม่มีคำฟุ่มเฟือยรบกวนผู้ฟังเลย',
  },
  pacing: {
    1: 'มีความตั้งใจถ่ายทอดเนื้อหาดีครับ ลองปรับความเร็วเข้าใกล้ช่วง 180–220 พยางค์/นาที เพื่อให้ผู้ฟังตามทันสบายขึ้น',
    2: 'มีจังหวะการพูดเป็นโครงสร้างแล้ว แนะนำให้เน้นช้า-เร็วสลับกันในประเด็นสำคัญเพื่อเพิ่มความน่าสนใจ',
    3: 'ความเร็วในการพูดอยู่ในเกณฑ์มาตรฐาน ฟังง่ายสบายหู ปรับเน้นคำสำคัญอีกนิดจะยิ่งดึงดูดผู้ฟัง',
    4: 'คุมความเร็วได้ยอดเยี่ยมระดับมืออาชีพ สม่ำเสมอและฟังชัด เหลือเพียงผ่อนจังหวะช่วงท้ายประโยคอีกเล็กน้อย',
    5: 'จังหวะการพูดสมบูรณ์แบบระดับมาสเตอร์พีซ คุมความเร็ว 180–220 พยางค์/นาทีได้แม่นยำและทรงพลัง',
  },
  eye: {
    1: 'เริ่มต้นได้ดีครับ ลองมองตรงมาที่เลนส์กล้องมากขึ้นระหว่างอธิบายประเด็นหลัก เพื่อสร้างความเชื่อมโยงกับผู้ฟัง',
    2: 'มีการสบตาผู้ฟังเป็นช่วงๆ แล้ว แนะนำให้ลดการละสายตาไปด้านบนหรือด้านข้างให้น้อยลง จะดูมั่นใจขึ้นมาก',
    3: 'การสบตาผู้ฟังอยู่ในเกณฑ์มาตรฐาน เป็นธรรมชาติ แนะนำให้มองกล้องค้างไว้ตอนจบประโยคสำคัญจะยิ่งทรงพลัง',
    4: 'สบตากล้องได้ยอดเยี่ยมมาก แสดงความมั่นใจระดับมืออาชีพ เหลือเพียงรักษาโฟกัสช่วงเปลี่ยนสไลด์อีกนิดเดียว',
    5: 'การสบตาสื่อสารสมบูรณ์แบบไร้ที่ติ ดึงดูดสายตาและสร้างความน่าเชื่อถือได้เต็มร้อยตลอดการนำเสนอ',
  },
  posture: {
    1: 'มีความตั้งใจนำเสนอที่ดีครับ ลองยืดไหล่ตรงและผ่อนคลายช่วงแขนขณะพูด จะช่วยเสริมบุคลิกให้น่าเชื่อถือยิ่งขึ้น',
    2: 'วางท่าทางพื้นฐานได้ดีแล้ว แนะนำให้ลดการกอดอกหรือขยับตัวไปมา เพื่อเสริมความสง่าและนิ่งมั่นคง',
    3: 'บุคลิกภาพได้มาตรฐาน ดูสุภาพและเข้าถึงง่าย ลองใช้ภาษามือประกอบคำอธิบายเล็กน้อยจะยิ่งน่าสนใจ',
    4: 'บุคลิกภาพสง่างามระดับมืออาชีพ ท่าทางมั่นคงและเป็นธรรมชาติ เหลือเพียงรักษาความนิ่งช่วงท้ายอีกนิดเดียว',
    5: 'บุคลิกภาพสมบูรณ์แบบระดับมาสเตอร์พีซ สง่า มั่นคง และส่งเสริมพลังการสื่อสารได้ในทุกมิติ',
  },
};

export function ScoreOverview({
  report,
  starEvalLoading = false,
  onRegenerateStarEval,
}: {
  report: SessionReport;
  starEvalLoading?: boolean;
  onRegenerateStarEval?: () => void;
}) {
  const { metrics, overallScore, starEvaluation } = report;

  const pacingScore = calculatePacingScore(metrics.averageSpm);
  const fluencyScore = calculateFluencyScore(metrics.fillerPerMinute);
  const overallStars = scoreToStars(overallScore);

  const evaluations: Array<{
    key: 'overall' | 'fluency' | 'pacing' | 'eye' | 'posture';
    title: string;
    stars: StarRating;
    feedback: string;
  }> = [
    {
      key: 'overall',
      title: 'คะแนนรวมเฉลี่ยทั้งหมด',
      stars: overallStars,
      feedback:
        starEvaluation?.overall ||
        `ทำคะแนนรวมได้ ${overallScore}/100 จากการซ้อม ${report.durationSeconds} วินาที — ${OVERALL_FEEDBACK[overallStars]}`,
    },
    {
      key: 'fluency',
      title: 'ความลื่นไหลและคำฟุ่มเฟือย',
      stars: scoreToStars(fluencyScore),
      feedback:
        starEvaluation?.fluency ||
        (metrics.fillerCount === 0
          ? 'พูดได้ต่อเนื่องลื่นไหล ตลอดการซ้อมไม่พบคำฟุ่มเฟือยเลย'
          : `พบคำฟุ่มเฟือย ${metrics.fillerCount} ครั้ง (${metrics.fillerPerMinute} ครั้ง/นาที) — ${TOPIC_FEEDBACK.fluency[scoreToStars(fluencyScore)]}`),
    },
    {
      key: 'pacing',
      title: 'จังหวะความเร็วในการพูด',
      stars: scoreToStars(pacingScore),
      feedback:
        starEvaluation?.pacing ||
        `ความเร็วเฉลี่ย ${metrics.averageSpm} พยางค์/นาที — ${TOPIC_FEEDBACK.pacing[scoreToStars(pacingScore)]}`,
    },
    {
      key: 'eye',
      title: 'การสบตาผู้ฟัง',
      stars: scoreToStars(metrics.eyeContactRatio),
      feedback:
        starEvaluation?.eye ||
        `สบตากล้องได้ ${metrics.eyeContactRatio}% ของเวลาทั้งหมด — ${TOPIC_FEEDBACK.eye[scoreToStars(metrics.eyeContactRatio)]}`,
    },
    {
      key: 'posture',
      title: 'บุคลิกภาพและท่าทาง',
      stars: scoreToStars(metrics.goodPostureRatio),
      feedback:
        starEvaluation?.posture ||
        `บุคลิกภาพเหมาะสม ${metrics.goodPostureRatio}% — ${TOPIC_FEEDBACK.posture[scoreToStars(metrics.goodPostureRatio)]}`,
    },
  ];

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
    <div className="space-y-4">
      {/* Top Full-Width Overall Score Banner */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-[#F9A8D4] bg-gradient-to-r from-[#EC3D6A] via-[#F472B6] to-[#8B5CF6] px-6 py-6 sm:px-8 text-center sm:text-left shadow-md shadow-[#EC3D6A]/20">
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/90">
            คะแนนการนำเสนอ
          </span>
          <div className="flex items-baseline justify-center sm:justify-start gap-2">
            <span className="text-5xl sm:text-6xl font-extrabold text-white tabular-nums">
              {overallScore}
            </span>
            <span className="text-sm font-medium text-white/90">/ 100 คะแนน</span>
          </div>
        </div>

        <div className="flex flex-col items-center sm:items-end gap-2 max-w-xl">
          <div className="rounded-full bg-white/95 px-4 py-1.5 shadow-sm">
            <StarDisplay stars={overallStars} size="lg" />
          </div>
          <p className="text-xs sm:text-sm font-medium text-white/95 leading-relaxed sm:text-right">
            {starEvalLoading && !starEvaluation
              ? 'กำลังวิเคราะห์วิดีโอจริงของคุณเพื่อสร้างคำแนะนำเฉพาะบุคคล...'
              : evaluations[0].feedback}
          </p>
        </div>
      </div>

      {/* 4 Sub-Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* 5-Star Evaluation Breakdown */}
      <div className="rounded-2xl border border-[#E8DCE0] bg-white p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8DCE0] pb-3.5">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#BE2257]">
              5-Star Evaluation Summary
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#1F161A]">
              สรุปผลการประเมินแยกตามหัวข้อ
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {starEvalLoading ? (
              <span className="rounded-full bg-[#FCE8EE] px-3 py-1 text-xs font-semibold text-[#BE2257] animate-pulse">
                กำลังวิเคราะห์วิดีโอจริง...
              </span>
            ) : starEvaluation ? (
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
                {starEvaluation.source === 'gemini-video'
                  ? 'วิเคราะห์จากวิดีโอจริง (AI)'
                  : starEvaluation.source === 'gemini-telemetry'
                    ? 'วิเคราะห์จากคำพูดและสถิติจริง (AI)'
                    : 'สรุปจากสถิติจริงของรอบนี้'}
              </span>
            ) : null}

            {onRegenerateStarEval && !starEvalLoading && (
              <button
                type="button"
                onClick={onRegenerateStarEval}
                className="rounded-lg border border-[#D8C5CB] bg-white hover:bg-[#FAF6F7] px-2.5 py-1 text-xs font-semibold text-slate-700"
              >
                วิเคราะห์จากวิดีโอใหม่
              </button>
            )}
          </div>
        </div>

        <ul className="space-y-3 text-sm sm:text-base">
          {evaluations.map((item) => (
            <li
              key={item.key}
              className={`rounded-xl border px-4 py-3.5 ${
                item.key === 'overall'
                  ? 'border-[#F5C6D4] bg-[#FFF7FA]'
                  : 'border-[#E8DCE0] bg-[#FAF6F7]/60'
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 leading-relaxed text-[#1F161A]">
                <strong className="text-base font-bold">{item.title}:</strong>
                <StarDisplay stars={item.stars} size="md" />
                <span className="text-slate-400">—</span>
                <span className="text-sm sm:text-base text-slate-700">{item.feedback}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
