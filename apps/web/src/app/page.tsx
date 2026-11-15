'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Clock,
  FileText,
  Mic,
  Users,
  Vibrate,
  Watch,
} from 'lucide-react';
import {
  getActivePlan,
  listSessionReports,
  type AnySessionReport,
} from '@/services/storage';
import type { PresentationPlan } from '@cuepulse/shared';

type SessionFilter = 'all' | 'solo' | 'team';

export default function DashboardPage() {
  const [reports, setReports] = useState<AnySessionReport[]>([]);
  const [activePlan, setActivePlan] = useState<PresentationPlan | null>(null);
  const [filter, setFilter] = useState<SessionFilter>('all');
  const [isPulsingWatch, setIsPulsingWatch] = useState(false);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setReports(listSessionReports());
    setActivePlan(getActivePlan());
    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, []);

  const triggerWatchPreview = () => {
    setIsPulsingWatch(true);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(80);
      } catch {
        // Ignore on unsupported browsers
      }
    }
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => {
      setIsPulsingWatch(false);
    }, 1500);
  };

  const avgScore =
    reports.length > 0
      ? Math.round(
          reports.reduce((acc, r) => acc + r.overallScore, 0) / reports.length
        )
      : null;

  const bestScore =
    reports.length > 0
      ? Math.max(...reports.map((r) => r.overallScore))
      : null;

  const filteredReports = reports.filter((r) =>
    filter === 'all' ? true : r.mode === filter
  );

  return (
    <div className="space-y-6">
      {/* Institutional Masthead */}
      <section className="animate-fade-up overflow-hidden rounded-2xl border border-[#E8DCE0] bg-white shadow-sm">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#EC3D6A] via-[#8B5CF6] to-[#0EA5E9]" />
        <div className="flex flex-col gap-6 p-5 sm:p-7 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E8DCE0] bg-white p-1">
                <img
                  src="/logo-chula.jpg"
                  alt="ตราพระเกี้ยว"
                  className="h-full w-full object-contain"
                />
              </div>
              <p className="text-xs font-semibold tracking-wide text-[#BE2257]">
                จุฬาลงกรณ์มหาวิทยาลัย • เครื่องมือฝึกทักษะการพูดและการนำเสนอ
              </p>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#2B2135] leading-snug">
              ซ้อมพูดให้คล่องและคุมเวลาให้แม่นยำ ก่อนขึ้นเวทีจริง
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
              แบ่งเวลาพูดต่อสไลด์ จับคำติดปากภาษาไทย ตรวจจังหวะการพูดและมุมสายตา
              พร้อมตัวจำลองสัญญาณสั่นบนสมาร์ทวอทช์เพื่อช่วยเตือนแบบไม่เสียสมาธิ
            </p>

            <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 pt-1">
              <Link
                href="/practice/solo"
                className="app-press inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#EC3D6A] to-[#F472B6] hover:brightness-105 px-5 py-2.5 text-sm font-bold text-white shadow-sm"
              >
                <Mic className="h-4 w-4" />
                เริ่มซ้อมเดี่ยว
              </Link>
              <Link
                href="/planner"
                className="app-press inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#BAE6FD] bg-[#F0F9FF] hover:bg-[#E0F2FE] px-4 py-2.5 text-sm font-semibold text-[#0369A1]"
              >
                <FileText className="h-4 w-4 text-[#0EA5E9]" />
                เตรียมสไลด์และกะเวลา
              </Link>
              <Link
                href="/practice/team"
                className="app-press inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] hover:bg-[#EDE9FE] px-4 py-2.5 text-sm font-semibold text-[#6D28D9]"
              >
                <Users className="h-4 w-4 text-[#8B5CF6]" />
                ซ้อมเป็นกลุ่ม
              </Link>
            </div>
          </div>

          {/* Right Editorial Studio Illustration on Desktop */}
          <div className="hidden md:flex shrink-0 flex-col items-end space-y-2 border-l border-[#E8DCE0] pl-6">
            <img
              src="/images/studio-stage.svg"
              alt="ภาพจำลองสตูดิโอซ้อมพูดและสไลด์"
              className="w-64 h-auto rounded-xl"
            />
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>เกณฑ์จังหวะแนะนำ</span>
              <span className="font-bold text-[#1F161A] tabular-nums">
                180–220 พยางค์/นาที
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Step Guided UX Workflow Bar (UXpert Visual Hierarchy) */}
      <section aria-label="ขั้นตอนการใช้งาน 3 ขั้น" className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/planner"
          className="app-card group rounded-2xl border border-[#E8DCE0] bg-white p-4 shadow-sm hover:border-[#BAE6FD]"
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="inline-flex items-center rounded-full bg-[#E0F2FE] px-2.5 py-0.5 text-xs font-bold text-[#0369A1]">
              ขั้นที่ 1
            </span>
            <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#0EA5E9] transition" />
          </div>
          <h2 className="font-display text-sm sm:text-base font-bold text-[#2B2135]">
            เตรียมสไลด์หรือสคริปต์
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
            อัปโหลดไฟล์ PDF/PPTX ให้ AI แบ่งเวลาพูด หรือวางสคริปต์พูดสดได้ทันที
          </p>
        </Link>

        <Link
          href="/practice/solo"
          className="app-card group rounded-2xl border border-[#E8DCE0] bg-white p-4 shadow-sm hover:border-[#FF9EB8]"
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="inline-flex items-center rounded-full bg-[#FCE8EE] px-2.5 py-0.5 text-xs font-bold text-[#BE2257]">
              ขั้นที่ 2
            </span>
            <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#EC3D6A] transition" />
          </div>
          <h2 className="font-display text-sm sm:text-base font-bold text-[#2B2135]">
            ซ้อมพูดหน้ากล้องเต็มจอ
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
            ตรวจจับความเร็ว คำฟุ่มเฟือย และสายตา พร้อมแสงสีเตือนรอบขอบจอ
          </p>
        </Link>

        <div className="rounded-2xl border border-[#E8DCE0] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="inline-flex items-center rounded-full bg-[#EDE9FE] px-2.5 py-0.5 text-xs font-bold text-[#6D28D9]">
              ขั้นที่ 3
            </span>
          </div>
          <h2 className="font-display text-sm sm:text-base font-bold text-[#2B2135]">
            ดูวิดีโอย้อนหลัง & รับผล 5 ดาว
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
            ชมคลิปตัวเองย้อนหลังพร้อมคำชมจาก AI และซ้อมตอบคำถามกรรมการ
          </p>
        </div>
      </section>

      {/* 12-Column Asymmetric Studio Workspace */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left 8 Columns: Active Cue Sheet + Rehearsal Log */}
        <div className="lg:col-span-8 space-y-6">
          {/* Active Cue Sheet */}
          <section className="animate-fade-up rounded-2xl border border-[#E8DCE0] border-l-4 border-l-[#EC3D6A] bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E8DCE0]">
              <div>
                <span className="text-xs font-semibold text-[#BE2257]">
                  ใบคิวสไลด์ปัจจุบัน
                </span>
                <h2 className="text-base sm:text-lg font-bold text-[#1F161A]">
                  {activePlan ? activePlan.fileName : 'ยังไม่ได้เลือกไฟล์สไลด์'}
                </h2>
              </div>
              <Link
                href="/planner"
                className="app-press inline-flex items-center gap-1 rounded-lg border border-[#E8DCE0] bg-[#FAF6F7] hover:bg-[#FCE8EE] px-3 py-1.5 text-xs font-semibold text-[#1F161A]"
              >
                {activePlan ? 'เปลี่ยนหรือแก้ไขคิว' : 'เพิ่มไฟล์สไลด์'}
                <ArrowRight className="h-3.5 w-3.5 text-[#EC3D6A]" />
              </Link>
            </div>

            {activePlan ? (
              <div className="mt-4 space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed bg-[#FAF6F7] rounded-xl border border-[#E8DCE0] px-3.5 py-2.5">
                  <span className="font-semibold text-[#1F161A]">เกริ่นนำเปิดเรื่อง: </span>
                  &ldquo;{activePlan.openingHook}&rdquo;
                </p>

                <div className="space-y-2">
                  {activePlan.slides.slice(0, 3).map((s) => (
                    <div
                      key={s.slideNumber}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[#E8DCE0] px-3.5 py-2 text-sm"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {s.imageDataUrl ? (
                          <img
                            src={s.imageDataUrl}
                            alt={`ตัวอย่างสไลด์หน้า ${s.slideNumber}`}
                            className="h-9 w-16 shrink-0 rounded-md border border-[#E8DCE0] object-cover bg-white"
                          />
                        ) : (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#FCE8EE] text-xs font-bold text-[#BE2257]">
                            {s.slideNumber}
                          </span>
                        )}
                        <div className="min-w-0">
                          <span className="font-medium text-[#1F161A] truncate block">
                            {s.slideNumber}. {s.title}
                          </span>
                          {s.speakerScript && (
                            <span className="text-[11px] text-slate-500 truncate block">
                              มีสคริปต์พูดพร้อมซ้อม
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-600 tabular-nums">
                        <Clock className="h-3.5 w-3.5 text-[#EC3D6A]" />
                        {s.allocatedSeconds} วิ
                      </span>
                    </div>
                  ))}
                  {activePlan.slides.length > 3 && (
                    <p className="text-xs text-slate-500 pl-1">
                      และอีก {activePlan.slides.length - 3} หน้า (เวลารวม{' '}
                      {Math.round(activePlan.totalDurationSeconds / 60)} นาที)
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-[#D8C5CB] bg-[#FAF6F7] p-5 text-sm text-slate-600">
                นำเข้าไฟล์ .pdf, .pptx หรือ .txt ในหน้า{' '}
                <Link
                  href="/planner"
                  className="font-semibold text-[#EC3D6A] hover:underline"
                >
                  เตรียมสไลด์
                </Link>{' '}
                เพื่อแบ่งเวลาพูดอัตโนมัติ หรือกด{' '}
                <Link
                  href="/practice/solo"
                  className="font-semibold text-[#EC3D6A] hover:underline"
                >
                  เริ่มซ้อมเดี่ยว
                </Link>{' '}
                แบบพูดอิสระได้เลย
              </div>
            )}
          </section>

          {/* Rehearsal Log */}
          <section className="animate-fade-up rounded-2xl border border-[#E8DCE0] bg-white p-5 sm:p-6 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-bold text-[#1F161A]">บันทึกการซ้อมย้อนหลัง</h2>

              <div
                role="tablist"
                aria-label="กรองบันทึกการซ้อม"
                className="inline-flex self-start rounded-xl border border-[#E8DCE0] bg-[#F5EEF0] p-1 text-xs"
              >
                {(
                  [
                    { id: 'all', label: 'ทั้งหมด' },
                    { id: 'solo', label: 'ซ้อมเดี่ยว' },
                    { id: 'team', label: 'ซ้อมกลุ่ม' },
                  ] as const
                ).map((tab) => {
                  const active = filter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFilter(tab.id)}
                      className={`app-press rounded-lg px-3 py-1.5 font-semibold transition-all ${
                        active
                          ? 'bg-white text-[#1F161A] shadow-sm border border-[#E8DCE0]'
                          : 'text-slate-600 hover:text-[#EC3D6A] border border-transparent'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredReports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#D8C5CB] bg-[#FAF6F7] p-7 text-center text-sm text-slate-500">
                {reports.length === 0
                  ? 'ยังไม่มีบันทึกการซ้อม ลองซ้อมรอบแรกเพื่อเก็บสถิติและเทียบพัฒนาการครับ'
                  : 'ไม่พบบันทึกในหมวดนี้'}
              </div>
            ) : (
              <div className="divide-y divide-[#E8DCE0]">
                {filteredReports.slice(0, 8).map((r) => (
                  <Link
                    key={r.sessionId}
                    href={`/report/${r.sessionId}`}
                    className="app-press flex items-center justify-between gap-4 py-3.5 hover:bg-[#FAF6F7] px-3 -mx-3 rounded-xl transition"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-[#FCE8EE] px-2 py-0.5 text-[11px] font-semibold text-[#BE2257]">
                          {r.mode === 'team' ? 'ซ้อมกลุ่ม' : 'ซ้อมเดี่ยว'}
                        </span>
                        <span className="text-sm font-semibold text-[#1F161A] tabular-nums">
                          {r.durationSeconds} วินาที
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        ความเร็ว {r.metrics.averageSpm} พยางค์/นาที • คำติดปาก{' '}
                        {r.metrics.fillerCount} ครั้ง • สบตา {r.metrics.eyeContactRatio}%
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-bold text-[#1F161A] tabular-nums">
                          {r.overallScore}
                          <span className="text-xs font-normal text-slate-400">
                            /100
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-[#F5EEF0]">
                          <div
                            className="h-full rounded-full bg-[#EC3D6A]"
                            style={{ width: `${r.overallScore}%` }}
                          />
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right 4 Columns: Studio Side Console */}
        <aside className="lg:col-span-4 space-y-5">
          {/* Summary Card */}
          <div className="rounded-2xl border border-[#E8DCE0] bg-white p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-[#1F161A]">ภาพรวมการฝึกซ้อม</h2>
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-[#E8DCE0] bg-[#FAF6F7] p-3 text-center">
              <div>
                <div className="text-lg font-bold text-[#1F161A] tabular-nums">
                  {reports.length}
                </div>
                <div className="text-[11px] text-slate-500">ครั้งที่ซ้อม</div>
              </div>
              <div className="border-x border-[#E8DCE0]">
                <div className="text-lg font-bold text-[#EC3D6A] tabular-nums">
                  {avgScore ?? '—'}
                </div>
                <div className="text-[11px] text-slate-500">คะแนนเฉลี่ย</div>
              </div>
              <div>
                <div className="text-lg font-bold text-[#1F161A] tabular-nums">
                  {bestScore ?? '—'}
                </div>
                <div className="text-[11px] text-slate-500">สูงสุด</div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500">
                <span>ความสม่ำเสมอเฉลี่ย</span>
                <span className="font-semibold text-[#1F161A] tabular-nums">
                  {avgScore !== null ? `${avgScore}%` : 'รอข้อมูลรอบแรก'}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#F5EEF0]">
                <div
                  className="h-full rounded-full bg-[#EC3D6A] transition-all duration-300"
                  style={{ width: `${avgScore ?? 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Watch Companion Card */}
          <div className="rounded-2xl border border-[#DDD6FE] bg-gradient-to-br from-white to-[#F5F3FF] p-5 shadow-sm space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-[#2B2135]">
                  นาฬิกาเตือนจังหวะ
                </h2>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  สั่นเตือนเบาๆ เมื่อพูดเร็วหรือเผลอใช้คำติดปาก มีช่วงพักเตือน 20 วินาที
                </p>
              </div>
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
                {isPulsingWatch && (
                  <span className="animate-pulse-ring absolute inset-0 rounded-full border-2 border-[#8B5CF6]" />
                )}
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 bg-gradient-to-br from-[#4C3575] to-[#7C3AED] text-white shadow-sm ${
                    isPulsingWatch
                      ? 'animate-watch-buzz border-[#EC3D6A]'
                      : 'border-[#DDD6FE]'
                  }`}
                >
                  <Watch className="h-4 w-4 text-[#FDE68A]" />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={triggerWatchPreview}
              className="app-press w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#DDD6FE] bg-white hover:bg-[#EDE9FE] px-3 py-2 text-xs font-semibold text-[#6D28D9]"
            >
              <Vibrate className="h-3.5 w-3.5 text-[#8B5CF6]" />
              {isPulsingWatch ? 'กำลังสั่นเตือนตัวอย่าง...' : 'ลองจังหวะสั่น'}
            </button>
          </div>

          {/* Editorial Evaluation Reference */}
          <div className="rounded-2xl border border-[#A7F3D0] bg-gradient-to-br from-white to-[#ECFDF5] p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-[#2B2135]">
              หลักเกณฑ์ที่ใช้ประเมิน
            </h2>
            <ol className="space-y-2.5 text-xs text-slate-600">
              <li className="flex items-start gap-2.5">
                <span className="font-mono text-[11px] font-bold text-[#0EA5E9] mt-0.5">
                  01
                </span>
                <span>คุมความเร็วการพูดให้พอดีช่วง 180–220 พยางค์ต่อนาที</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-mono text-[11px] font-bold text-[#EC3D6A] mt-0.5">
                  02
                </span>
                <span>เว้นจังหวะหายใจแทนคำติดปากอย่าง &ldquo;อืม / อ่า / แบบว่า&rdquo;</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-mono text-[11px] font-bold text-[#10B981] mt-0.5">
                  03
                </span>
                <span>สบตาผู้ฟังและยืนในท่าทางที่เปิดเผย ไม่ห่อไหล่หรือกอดอก</span>
              </li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
