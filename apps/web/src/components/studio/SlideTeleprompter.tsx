'use client';

import { AlertTriangle, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import type { PresentationPlan } from '@cuepulse/shared';

interface SlideTeleprompterProps {
  plan: PresentationPlan | null;
  currentSlideIndex: number;
  slideElapsedSeconds: number;
  onPrevSlide: () => void;
  onNextSlide: () => void;
}

export function SlideTeleprompter({
  plan,
  currentSlideIndex,
  slideElapsedSeconds,
  onPrevSlide,
  onNextSlide,
}: SlideTeleprompterProps) {
  if (!plan || plan.slides.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E8DCE0] bg-white p-5 text-sm text-slate-600 shadow-sm">
        ยังไม่ได้เลือกแผนสไลด์ — สามารถซ้อมพูดอิสระได้ทันที หรือไปที่หน้า{' '}
        <span className="text-[#EC3D6A] font-semibold">เตรียมสไลด์</span> เพื่ออัปโหลดไฟล์ PDF/PPTX
      </div>
    );
  }

  const slide = plan.slides[currentSlideIndex] ?? plan.slides[0];
  const remaining = slide.allocatedSeconds - slideElapsedSeconds;
  const isOvertime = remaining < 0;
  const isWarning = remaining >= 0 && remaining <= 10;

  return (
    <div className="rounded-2xl border border-[#E8DCE0] bg-white p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="text-xs font-semibold text-[#EC3D6A]">
            สไลด์ {slide.slideNumber} / {plan.slides.length}
          </span>
          <h3 className="text-base font-bold text-[#1F161A] truncate">{slide.title}</h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${
              isOvertime
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : isWarning
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-[#FCE8EE] text-[#BE2257] border border-[#F2C4D0]'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            {isOvertime ? `เกิน ${Math.abs(remaining)}s` : `เหลือ ${remaining}s`}
          </div>
          <button
            type="button"
            onClick={onPrevSlide}
            disabled={currentSlideIndex === 0}
            className="rounded-lg border border-[#D8C5CB] p-1.5 text-slate-700 hover:bg-[#FAF6F7] disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNextSlide}
            disabled={currentSlideIndex >= plan.slides.length - 1}
            className="rounded-lg border border-[#D8C5CB] p-1.5 text-slate-700 hover:bg-[#FAF6F7] disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {slide.densityWarning && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
          <span>{slide.densityWarning}</span>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-slate-500">
          ประเด็นที่ต้องพูด
        </p>
        <ul className="space-y-1.5 text-sm text-slate-700">
          {slide.keyPoints.map((kp, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#EC3D6A]" />
              <span>{kp}</span>
            </li>
          ))}
        </ul>
      </div>

      {slide.emphasisCues.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500 font-medium">เน้นเสียง:</span>
          {slide.emphasisCues.map((cue, idx) => (
            <span
              key={idx}
              className="rounded-md bg-[#FCE8EE] px-2 py-0.5 text-xs font-medium text-[#BE2257]"
            >
              {cue}
            </span>
          ))}
        </div>
      )}

      <div className="rounded-xl bg-[#FAF6F7] border border-[#E8DCE0] px-3 py-2.5">
        <span className="text-[11px] font-medium text-slate-500">
          ประโยคเชื่อมสไลด์ถัดไป:
        </span>
        <p className="mt-0.5 text-sm text-slate-700 italic">
          &ldquo;{slide.transitionPhrase}&rdquo;
        </p>
      </div>
    </div>
  );
}
