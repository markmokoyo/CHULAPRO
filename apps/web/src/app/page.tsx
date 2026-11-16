'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ScrollReveal, SpotlightCard } from '@/components/studio/InteractiveUX';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Mic,
  Users,
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
  const [showAllReports, setShowAllReports] = useState(false);

  useEffect(() => {
    setReports(listSessionReports());
    setActivePlan(getActivePlan());
  }, []);

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
  const visibleReports = showAllReports
    ? filteredReports
    : filteredReports.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* 1. Compact Hero Header + Active Plan Pill */}
      <section className="animate-fade-up overflow-hidden rounded-2xl border border-[#E8DCE0] bg-white shadow-sm">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#EC3D6A] via-[#8B5CF6] to-[#0EA5E9]" />
        <div className="flex flex-col gap-5 p-5 sm:p-7 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl space-y-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E8DCE0] bg-white p-1">
                <img
                  src="/logo-chula.jpg"
                  alt="ตราพระเกี้ยว"
                  className="h-full w-full object-contain"
                />
              </div>
              <p className="text-xs font-semibold tracking-wide text-[#BE2257]">
                จุฬาลงกรณ์มหาวิทยาลัย • CuePulse AI Studio
              </p>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-[#2B2135] leading-snug">
              ซ้อมพูดให้คล่องและคุมเวลาให้แม่นยำ ก่อนขึ้นเวทีจริง
            </h1>

            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
              ฝึกจังหวะการพูดภาษาไทย ตรวจคำติดปาก การสบตา และรับผลประเมินจากวิดีโอจริง
            </p>

            {/* Compact Active Slide Deck Pill */}
            <div className="pt-1">
              <div className="inline-flex flex-wrap items-center gap-2.5 rounded-xl border border-[#E8DCE0] bg-[#FAF6F7] px-3.5 py-2 text-xs">
                <FileText className="h-3.5 w-3.5 shrink-0 text-[#EC3D6A]" />
                {activePlan ? (
                  <>
                    <span className="text-slate-500">สไลด์ที่เลือก:</span>
                    <span className="font-semibold text-[#1F161A] max-w-[200px] sm:max-w-[280px] truncate">
                      {activePlan.fileName}
                    </span>
                    <span className="text-slate-400 tabular-nums">
                      ({activePlan.slides.length} หน้า •{' '}
                      {Math.max(1, Math.round(activePlan.totalDurationSeconds / 60))} นาที)
                    </span>
                    <Link
                      href="/planner"
                      className="font-semibold text-[#BE2257] hover:underline"
                    >
                      เปลี่ยนสไลด์
                    </Link>
                  </>
                ) : (
                  <>
                    <span className="text-slate-600">
                      ยังไม่ได้เลือกสไลด์ — ซ้อมพูดสดได้ทันที
                    </span>
                    <Link
                      href="/planner"
                      className="font-semibold text-[#BE2257] hover:underline"
                    >
                      เพิ่มสไลด์
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right Editorial Studio Illustration on Desktop */}
          <div className="hidden md:flex shrink-0 flex-col items-end space-y-2 border-l border-[#E8DCE0] pl-6">
            <img
              src="/images/studio-stage.svg"
              alt="ภาพจำลองสตูดิโอซ้อมพูดและสไลด์"
              className="w-56 h-auto rounded-xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100"
            />
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>จังหวะแนะนำ</span>
              <span className="font-bold text-[#1F161A] tabular-nums">
                180–220 พยางค์/นาที
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. 3 Primary Action Cards */}
      <section aria-label="เลือกโหมดการฝึกซ้อม" className="grid gap-3.5 sm:grid-cols-3">
        <ScrollReveal delayMs={0}>
          <SpotlightCard
            spotlightColor="rgba(14, 165, 233, 0.14)"
            className="app-card group h-full rounded-2xl border border-[#E8DCE0] bg-white shadow-sm hover:border-[#BAE6FD]"
          >
            <Link href="/planner" className="flex h-full flex-col justify-between p-5">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E0F2FE] text-[#0369A1]">
                    <FileText className="h-4 w-4" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#0EA5E9] group-hover:translate-x-1 transition-all duration-200" />
                </div>
                <h2 className="font-display text-base font-bold text-[#2B2135]">
                  เตรียมสไลด์ & สคริปต์
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  อัปโหลด PDF/PPTX หรือวางบทพูดให้ AI ช่วยแบ่งเวลาและจัดคิว
                </p>
              </div>
              <span className="mt-4 inline-flex items-center text-xs font-semibold text-[#0369A1]">
                จัดการสไลด์
              </span>
            </Link>
          </SpotlightCard>
        </ScrollReveal>

        <ScrollReveal delayMs={80}>
          <SpotlightCard
            spotlightColor="rgba(236, 61, 106, 0.16)"
            className="app-card group h-full rounded-2xl border-2 border-[#F9A8D4] bg-gradient-to-br from-white to-[#FFF5F8] shadow-sm hover:border-[#EC3D6A]"
          >
            <Link href="/practice/solo" className="flex h-full flex-col justify-between p-5">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FCE8EE] text-[#BE2257]">
                    <Mic className="h-4 w-4" />
                  </span>
                  <span className="rounded-full bg-[#FCE8EE] px-2.5 py-0.5 text-[11px] font-bold text-[#BE2257]">
                    แนะนำ
                  </span>
                </div>
                <h2 className="font-display text-base font-bold text-[#2B2135]">
                  ซ้อมพูดเดี่ยว
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  เปิดกล้องเต็มจอ จับจังหวะพูด คำติดปาก การสบตา และประเมินผล 5 ดาว
                </p>
              </div>
              <span className="cta-shimmer mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#EC3D6A] to-[#F472B6] px-3.5 py-2 text-xs font-bold text-white shadow-sm">
                เริ่มซ้อมเดี่ยว
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          </SpotlightCard>
        </ScrollReveal>

        <ScrollReveal delayMs={160}>
          <SpotlightCard
            spotlightColor="rgba(139, 92, 246, 0.14)"
            className="app-card group h-full rounded-2xl border border-[#E8DCE0] bg-white shadow-sm hover:border-[#DDD6FE]"
          >
            <Link href="/practice/team" className="flex h-full flex-col justify-between p-5">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EDE9FE] text-[#6D28D9]">
                    <Users className="h-4 w-4" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#8B5CF6] group-hover:translate-x-1 transition-all duration-200" />
                </div>
                <h2 className="font-display text-base font-bold text-[#2B2135]">
                  ซ้อมนำเสนอกลุ่ม
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                  ซ้อมหลายคนบนเวที จับเวลาส่งต่อบทพูดและความสมดุลของทีม
                </p>
              </div>
              <span className="mt-4 inline-flex items-center text-xs font-semibold text-[#6D28D9]">
                เข้าโหมดซ้อมกลุ่ม
              </span>
            </Link>
          </SpotlightCard>
        </ScrollReveal>
      </section>

      {/* 3. Unified Stats & Recent Sessions */}
      <section className="animate-fade-up stagger-2 rounded-2xl border border-[#E8DCE0] bg-white p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-[#1F161A]">
              ภาพรวมและบันทึกการซ้อมย้อนหลัง
            </h2>
            <p className="text-xs text-slate-500">
              ติดตามคะแนนและความสม่ำเสมอจากการซ้อมทุกครั้ง
            </p>
          </div>

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
                  onClick={() => {
                    setFilter(tab.id);
                    setShowAllReports(false);
                  }}
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

        {/* Compact 3-Metric Summary Strip */}
        <div className="grid grid-cols-3 gap-3 rounded-xl border border-[#E8DCE0] bg-[#FAF6F7] p-3.5 text-center">
          <div>
            <div className="font-display text-xl font-bold text-[#1F161A] tabular-nums">
              {reports.length}
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500">ครั้งที่ซ้อม</div>
          </div>
          <div className="border-x border-[#E8DCE0]">
            <div className="font-display text-xl font-bold text-[#EC3D6A] tabular-nums">
              {avgScore ?? '—'}
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500">คะแนนเฉลี่ย</div>
          </div>
          <div>
            <div className="font-display text-xl font-bold text-[#1F161A] tabular-nums">
              {bestScore ?? '—'}
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500">คะแนนสูงสุด</div>
          </div>
        </div>

        {visibleReports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D8C5CB] bg-[#FAF6F7] p-7 text-center text-sm text-slate-500">
            {reports.length === 0
              ? 'ยังไม่มีบันทึกการซ้อม ลองซ้อมรอบแรกเพื่อเก็บสถิติและดูผลประเมินจากวิดีโอครับ'
              : 'ไม่พบบันทึกในหมวดนี้'}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="divide-y divide-[#E8DCE0]">
              {visibleReports.map((r) => (
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

            {filteredReports.length > 5 && (
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllReports((v) => !v)}
                  className="app-press inline-flex items-center gap-1.5 rounded-xl border border-[#E8DCE0] bg-[#FAF6F7] hover:bg-[#FCE8EE] px-4 py-2 text-xs font-semibold text-[#1F161A]"
                >
                  {showAllReports ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5 text-[#EC3D6A]" />
                      ย่อรายการ
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5 text-[#EC3D6A]" />
                      ดูทั้งหมด ({filteredReports.length} รายการ)
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
