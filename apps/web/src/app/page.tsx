'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ScrollReveal, SpotlightCard } from '@/components/studio/InteractiveUX';
import {
  ArrowRight,
  BarChart3,
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

export default function DashboardPage() {
  const [latestReport, setLatestReport] = useState<AnySessionReport | null>(null);
  const [reportCount, setReportCount] = useState(0);
  const [activePlan, setActivePlan] = useState<PresentationPlan | null>(null);

  useEffect(() => {
    const all = listSessionReports();
    setReportCount(all.length);
    setLatestReport(all[0] ?? null);
    setActivePlan(getActivePlan());
  }, []);

  return (
    <div className="space-y-5">
      {/* 1. Ultra-Clean Studio Hero Card */}
      <section className="animate-fade-up overflow-hidden rounded-3xl border border-[#E8DCE0] bg-white shadow-sm">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#EC3D6A] via-[#8B5CF6] to-[#0EA5E9]" />
        <div className="flex flex-col gap-4 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl space-y-3">
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#2B2135] leading-snug">
              พร้อมฝึกซ้อมการนำเสนอ
            </h1>

            {/* Compact Active Slide Pill */}
            <div className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-[#E8DCE0] bg-[#FAF6F7] px-3.5 py-2 text-xs">
              <FileText className="h-3.5 w-3.5 shrink-0 text-[#EC3D6A]" />
              {activePlan ? (
                <>
                  <span className="font-semibold text-[#1F161A] max-w-[180px] sm:max-w-[260px] truncate">
                    {activePlan.fileName}
                  </span>
                  <span className="text-slate-400 tabular-nums">
                    ({activePlan.slides.length} หน้า)
                  </span>
                  <Link
                    href="/planner"
                    className="font-semibold text-[#BE2257] hover:underline"
                  >
                    เปลี่ยน
                  </Link>
                </>
              ) : (
                <>
                  <span className="text-slate-600">โหมดพูดอิสระ (ยังไม่มีสไลด์)</span>
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

          {/* App Studio Visual */}
          <div className="relative shrink-0 overflow-hidden rounded-2xl border border-[#E8DCE0] bg-[#FDF8FA] p-1.5 shadow-sm md:w-64">
            <img
              src="/images/app-hero-studio.png"
              alt="CuePulse Studio"
              className="h-28 sm:h-32 w-full rounded-xl object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:scale-[1.03] motion-reduce:transition-none motion-reduce:hover:scale-100"
            />
          </div>
        </div>
      </section>

      {/* 2. 3 Clean Mode Cards */}
      <section aria-label="เลือกโหมด" className="grid gap-4 sm:grid-cols-3">
        <ScrollReveal delayMs={0}>
          <SpotlightCard
            spotlightColor="rgba(14, 165, 233, 0.14)"
            className="app-card group h-full rounded-3xl border border-[#E8DCE0] bg-white shadow-sm hover:border-[#BAE6FD]"
          >
            <Link href="/planner" className="flex h-full flex-col justify-between p-4 sm:p-5">
              <div>
                <div className="mb-3 overflow-hidden rounded-2xl border border-[#E0F2FE] bg-[#F0F9FF]">
                  <img
                    src="/images/mode-planner.png"
                    alt="เตรียมสไลด์"
                    className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-base font-bold text-[#2B2135] flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-[#0EA5E9]" />
                    เตรียมสไลด์
                  </h2>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#0EA5E9] group-hover:translate-x-1 transition-all duration-200" />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  อัปโหลดสไลด์หรือวางบทพูด
                </p>
              </div>
            </Link>
          </SpotlightCard>
        </ScrollReveal>

        <ScrollReveal delayMs={80}>
          <SpotlightCard
            spotlightColor="rgba(236, 61, 106, 0.16)"
            className="app-card group h-full rounded-3xl border-2 border-[#F9A8D4] bg-gradient-to-br from-white to-[#FFF5F8] shadow-sm hover:border-[#EC3D6A]"
          >
            <Link href="/practice/solo" className="flex h-full flex-col justify-between p-4 sm:p-5">
              <div>
                <div className="relative mb-3 overflow-hidden rounded-2xl border border-[#FBCFE8] bg-[#FFF0F5]">
                  <img
                    src="/images/mode-solo.png"
                    alt="ซ้อมพูดเดี่ยว"
                    className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                  <span className="absolute top-2.5 right-2.5 rounded-full bg-white/95 border border-[#F9A8D4] px-2.5 py-0.5 text-[11px] font-bold text-[#BE2257] shadow-sm">
                    แนะนำ
                  </span>
                </div>
                <h2 className="font-display text-base font-bold text-[#2B2135] flex items-center gap-1.5">
                  <Mic className="h-4 w-4 text-[#EC3D6A]" />
                  ซ้อมเดี่ยว
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  จับจังหวะ สายตา และผล 5 ดาว
                </p>
              </div>
              <span className="cta-shimmer mt-3.5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#EC3D6A] to-[#F472B6] px-3.5 py-2 text-xs font-bold text-white shadow-sm">
                เริ่มซ้อมเลย
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          </SpotlightCard>
        </ScrollReveal>

        <ScrollReveal delayMs={160}>
          <SpotlightCard
            spotlightColor="rgba(139, 92, 246, 0.14)"
            className="app-card group h-full rounded-3xl border border-[#E8DCE0] bg-white shadow-sm hover:border-[#DDD6FE]"
          >
            <Link href="/practice/team" className="flex h-full flex-col justify-between p-4 sm:p-5">
              <div>
                <div className="mb-3 overflow-hidden rounded-2xl border border-[#EDE9FE] bg-[#F5F3FF]">
                  <img
                    src="/images/mode-team.png"
                    alt="ซ้อมกลุ่ม"
                    className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-base font-bold text-[#2B2135] flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-[#8B5CF6]" />
                    ซ้อมกลุ่ม
                  </h2>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#8B5CF6] group-hover:translate-x-1 transition-all duration-200" />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  ซ้อม 2–5 คน พร้อมจับคิวส่งต่อ
                </p>
              </div>
            </Link>
          </SpotlightCard>
        </ScrollReveal>
      </section>

      {/* 3. Single-Line Latest Summary Strip -> /reports */}
      <Link
        href={latestReport ? `/report/${latestReport.sessionId}` : '/reports'}
        className="app-press flex items-center justify-between gap-3 rounded-2xl border border-[#E8DCE0] bg-white px-4 py-3.5 shadow-sm hover:border-[#F9A8D4] transition"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FCE8EE] text-[#EC3D6A]">
            <BarChart3 className="h-4 w-4" />
          </span>
          {latestReport ? (
            <p className="text-xs sm:text-sm font-medium text-[#2B2135] truncate">
              รอบล่าสุด:{' '}
              <span className="font-bold text-[#EC3D6A] tabular-nums">
                {latestReport.overallScore}/100
              </span>{' '}
              <span className="text-slate-400">
                • ซ้อมแล้ว {reportCount} ครั้ง
              </span>
            </p>
          ) : (
            <p className="text-xs sm:text-sm font-medium text-slate-600 truncate">
              สรุปผลการฝึกซ้อมทั้งหมด
            </p>
          )}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#BE2257]">
          ดูสรุปผล
          <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </Link>
    </div>
  );
}
