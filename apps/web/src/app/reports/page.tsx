'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Mic,
  Trash2,
} from 'lucide-react';
import {
  deleteSessionReport,
  listSessionReports,
  type AnySessionReport,
} from '@/services/storage';
import { deleteSessionVideo } from '@/services/videoStorage';

type SessionFilter = 'all' | 'solo' | 'team';

export default function ReportsPage() {
  const [reports, setReports] = useState<AnySessionReport[]>([]);
  const [filter, setFilter] = useState<SessionFilter>('all');

  useEffect(() => {
    setReports(listSessionReports());
  }, []);

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    deleteSessionReport(sessionId);
    await deleteSessionVideo(sessionId);
    setReports(listSessionReports());
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
    <div className="space-y-5">
      {/* Compact Header */}
      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FCE8EE] text-[#EC3D6A]">
            <BarChart3 className="h-5 w-5" />
          </span>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-[#2B2135]">
            สรุปผลการฝึกซ้อม
          </h1>
        </div>

        <Link
          href="/practice/solo"
          className="app-press cta-shimmer inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#EC3D6A] to-[#F472B6] px-4 py-2 text-xs font-bold text-white shadow-sm"
        >
          <Mic className="h-3.5 w-3.5" />
          ซ้อมรอบใหม่
        </Link>
      </div>

      {/* 3-Metric Summary Card */}
      <div className="animate-fade-up grid grid-cols-3 gap-3 rounded-3xl border border-[#E8DCE0] bg-white p-4 sm:p-5 text-center shadow-sm">
        <div>
          <div className="font-display text-2xl sm:text-3xl font-bold text-[#1F161A] tabular-nums">
            {reports.length}
          </div>
          <div className="text-xs text-slate-500">ครั้งที่ซ้อม</div>
        </div>
        <div className="border-x border-[#E8DCE0]">
          <div className="font-display text-2xl sm:text-3xl font-bold text-[#EC3D6A] tabular-nums">
            {avgScore ?? '—'}
          </div>
          <div className="text-xs text-slate-500">คะแนนเฉลี่ย</div>
        </div>
        <div>
          <div className="font-display text-2xl sm:text-3xl font-bold text-[#1F161A] tabular-nums">
            {bestScore ?? '—'}
          </div>
          <div className="text-xs text-slate-500">คะแนนสูงสุด</div>
        </div>
      </div>

      {/* Session List Card */}
      <section className="animate-fade-up stagger-1 rounded-3xl border border-[#E8DCE0] bg-white p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-bold text-[#2B2135]">
            ประวัติการซ้อม ({filteredReports.length})
          </h2>

          <div
            role="tablist"
            aria-label="กรองประวัติการซ้อม"
            className="inline-flex rounded-2xl border border-[#E8DCE0] bg-[#F5EEF0] p-1 text-xs"
          >
            {(
              [
                { id: 'all', label: 'ทั้งหมด' },
                { id: 'solo', label: 'เดี่ยว' },
                { id: 'team', label: 'กลุ่ม' },
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
                  className={`app-press rounded-xl px-3 py-1.5 font-semibold transition-all ${
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
          <div className="rounded-2xl border border-dashed border-[#D8C5CB] bg-[#FAF6F7] p-8 text-center space-y-3">
            <p className="text-sm text-slate-500">
              {reports.length === 0 ? 'ยังไม่มีบันทึกการซ้อม' : 'ไม่พบบันทึกในหมวดนี้'}
            </p>
            {reports.length === 0 && (
              <Link
                href="/practice/solo"
                className="app-press inline-flex items-center gap-1.5 rounded-xl bg-[#EC3D6A] px-4 py-2 text-xs font-bold text-white"
              >
                <Mic className="h-3.5 w-3.5" />
                เริ่มซ้อมรอบแรก
              </Link>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#E8DCE0]">
            {filteredReports.map((r) => (
              <Link
                key={r.sessionId}
                href={`/report/${r.sessionId}`}
                className="app-press flex items-center justify-between gap-3 py-3.5 hover:bg-[#FAF6F7] px-3 -mx-3 rounded-2xl transition group"
              >
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[#FCE8EE] px-2 py-0.5 text-[11px] font-semibold text-[#BE2257]">
                      {r.mode === 'team' ? 'กลุ่ม' : 'เดี่ยว'}
                    </span>
                    <span className="text-sm font-semibold text-[#1F161A] tabular-nums">
                      {r.durationSeconds} วินาที
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(r.createdAt).toLocaleDateString('th-TH', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate">
                    {r.metrics.averageSpm} พยางค์/นาที • คำติดปาก {r.metrics.fillerCount} • สบตา{' '}
                    {r.metrics.eyeContactRatio}%
                  </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <div className="text-right">
                    <div className="font-display text-base font-bold text-[#1F161A] tabular-nums">
                      {r.overallScore}
                      <span className="text-[11px] font-normal text-slate-400">/100</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="ลบบันทึกนี้"
                    onClick={(e) => void handleDelete(e, r.sessionId)}
                    className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-[#EC3D6A] transition" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
