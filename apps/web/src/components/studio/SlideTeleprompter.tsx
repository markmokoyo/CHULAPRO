'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import type { PresentationPlan } from '@cuepulse/shared';

interface SlideTeleprompterProps {
  plan: PresentationPlan | null;
  currentSlideIndex: number;
  slideElapsedSeconds: number;
  onPrevSlide: () => void;
  onNextSlide: () => void;
  onSelectSlide?: (index: number) => void;
  freeformTopic?: string;
  onChangeFreeformTopic?: (topic: string) => void;
  freeformScript?: string;
  onChangeFreeformScript?: (script: string) => void;
}

type PromptTab = 'points' | 'script' | 'minimal';

export function SlideTeleprompter({
  plan,
  currentSlideIndex,
  slideElapsedSeconds,
  onPrevSlide,
  onNextSlide,
  onSelectSlide,
  freeformTopic = '',
  onChangeFreeformTopic,
  freeformScript = '',
  onChangeFreeformScript,
}: SlideTeleprompterProps) {
  const [showSlideImage, setShowSlideImage] = useState(true);
  const [promptTab, setPromptTab] = useState<PromptTab>('points');
  const [showFreeformScript, setShowFreeformScript] = useState(true);

  if (!plan || plan.slides.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E8DCE0] bg-white p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E8DCE0] pb-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#BE2257]">
              โหมดพูดอิสระ
            </span>
            <h3 className="text-base font-bold text-[#1F161A]">
              ซ้อมพูดโดยไม่ใช้สไลด์
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setShowFreeformScript((v) => !v)}
            className="app-press inline-flex items-center gap-1.5 rounded-lg border border-[#D8C5CB] bg-[#FAF6F7] hover:bg-[#FCE8EE] px-2.5 py-1 text-xs font-semibold text-[#1F161A]"
          >
            {showFreeformScript ? (
              <>
                <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                ซ่อนสคริปต์
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5 text-[#EC3D6A]" />
                แสดงสคริปต์
              </>
            )}
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label
              htmlFor="freeform-topic"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              หัวข้อที่กำลังพูด (ไม่บังคับ)
            </label>
            <input
              id="freeform-topic"
              type="text"
              value={freeformTopic}
              onChange={(e) => onChangeFreeformTopic?.(e.target.value)}
              placeholder="เช่น แนะนำตัวสัมภาษณ์งาน, สรุปผลงานวิจัย 3 นาที"
              className="w-full rounded-xl border border-[#D8C5CB] bg-[#FAF6F7] px-3 py-2 text-xs sm:text-sm text-[#1F161A] placeholder:text-slate-400 focus:outline-none focus:border-[#EC3D6A]"
            />
          </div>

          {showFreeformScript && (
            <div>
              <label
                htmlFor="freeform-script"
                className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1"
              >
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-[#EC3D6A]" />
                  สคริปต์หรือบันทึกย่อสำหรับดูระหว่างซ้อม (ไม่บังคับ)
                </span>
              </label>
              <textarea
                id="freeform-script"
                rows={5}
                value={freeformScript}
                onChange={(e) => onChangeFreeformScript?.(e.target.value)}
                placeholder="วางบทพูดหรือหัวข้อย่อยที่อยากพูดถึงที่นี่... หรือปล่อยว่างไว้เพื่อพูดสดได้เลย"
                className="w-full rounded-xl border border-[#D8C5CB] bg-[#FAF6F7] px-3 py-2.5 text-sm leading-relaxed text-[#1F161A] placeholder:text-slate-400 focus:outline-none focus:border-[#EC3D6A]"
              />
            </div>
          )}

          <p className="rounded-xl border border-[#E8DCE0] bg-[#FAF6F7] px-3 py-2 text-xs text-slate-600 leading-relaxed">
            หากไม่ได้อัปโหลดสไลด์ หลังจบการซ้อมระบบจะนำเสียงพูดที่ถอดความได้มาวิเคราะห์โครงสร้างและประเมินความชัดเจนให้โดยอัตโนมัติ
          </p>
        </div>
      </div>
    );
  }

  const slide = plan.slides[currentSlideIndex] ?? plan.slides[0];
  const remaining = slide.allocatedSeconds - slideElapsedSeconds;
  const isOvertime = remaining < 0;
  const isWarning = remaining >= 0 && remaining <= 10;

  return (
    <div className="rounded-2xl border border-[#E8DCE0] bg-white p-4 sm:p-5 space-y-3.5 shadow-sm">
      {/* Header: Slide indicator + Timer + Prev/Next + Toggle Image */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#EC3D6A] tabular-nums">
              สไลด์ {slide.slideNumber} / {plan.slides.length}
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-[#1F161A] truncate">
            {slide.title}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold tabular-nums ${
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
            onClick={() => setShowSlideImage((v) => !v)}
            title={showSlideImage ? 'ซ่อนภาพสไลด์' : 'แสดงภาพสไลด์'}
            className={`app-press inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition ${
              showSlideImage
                ? 'border-[#F2C4D0] bg-[#FCE8EE] text-[#BE2257]'
                : 'border-[#D8C5CB] bg-[#FAF6F7] text-slate-600 hover:bg-[#FCE8EE]'
            }`}
          >
            {showSlideImage ? (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">ซ่อนสไลด์</span>
              </>
            ) : (
              <>
                <ImageIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">ดูสไลด์</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onPrevSlide}
            disabled={currentSlideIndex === 0}
            aria-label="สไลด์ก่อนหน้า"
            className="rounded-lg border border-[#D8C5CB] p-1.5 text-slate-700 hover:bg-[#FAF6F7] disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNextSlide}
            disabled={currentSlideIndex >= plan.slides.length - 1}
            aria-label="สไลด์ถัดไป"
            className="rounded-lg border border-[#D8C5CB] p-1.5 text-slate-700 hover:bg-[#FAF6F7] disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Collapsible 16:9 Slide Visual Preview */}
      {showSlideImage && (
        <div className="space-y-2">
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[#E8DCE0] bg-[#FAF6F7]">
            {slide.imageDataUrl ? (
              <img
                src={slide.imageDataUrl}
                alt={`ภาพสไลด์หน้า ${slide.slideNumber}: ${slide.title}`}
                className="h-full w-full object-contain bg-white"
              />
            ) : (
              <div className="flex h-full w-full flex-col justify-between bg-white p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-[#FCE8EE] px-2 py-0.5 text-[10px] font-bold text-[#BE2257] uppercase tracking-wider">
                    Slide {String(slide.slideNumber).padStart(2, '0')}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {slide.allocatedSeconds}s
                  </span>
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm sm:text-base font-bold text-[#1F161A] line-clamp-2">
                    {slide.title}
                  </p>
                  <p className="text-xs text-slate-500 line-clamp-3">
                    {slide.extractedText}
                  </p>
                </div>
                <div className="h-1 w-16 rounded-full bg-[#EC3D6A]" />
              </div>
            )}

            <span className="absolute bottom-2 right-2 rounded-md bg-slate-900/75 px-2 py-0.5 text-[10px] font-semibold text-white tabular-nums backdrop-blur-sm">
              หน้า {slide.slideNumber} / {plan.slides.length}
            </span>
          </div>

          {onSelectSlide && plan.slides.length > 1 && (
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {plan.slides.map((s, idx) => {
                const active = idx === currentSlideIndex;
                return (
                  <button
                    key={s.slideNumber}
                    type="button"
                    onClick={() => onSelectSlide(idx)}
                    className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold tabular-nums border transition ${
                      active
                        ? 'border-[#EC3D6A] bg-[#EC3D6A] text-white'
                        : 'border-[#E8DCE0] bg-[#FAF6F7] text-slate-600 hover:bg-[#FCE8EE]'
                    }`}
                  >
                    {s.slideNumber}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Clean View Switcher Tabs to Avoid Clutter */}
      <div className="flex items-center justify-between gap-2 border-t border-[#E8DCE0] pt-3">
        <div
          role="tablist"
          aria-label="มุมมองตัวช่วยพูด"
          className="inline-flex rounded-xl border border-[#E8DCE0] bg-[#F5EEF0] p-0.5 text-xs"
        >
          {(
            [
              { id: 'points', label: 'ประเด็นหลัก' },
              { id: 'script', label: 'สคริปต์พูด' },
              { id: 'minimal', label: 'ปิดข้อความ' },
            ] as const
          ).map((t) => {
            const active = promptTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPromptTab(t.id)}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  active
                    ? 'bg-white text-[#1F161A] shadow-sm'
                    : 'text-slate-600 hover:text-[#EC3D6A]'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {slide.densityWarning && (
          <span
            title={slide.densityWarning}
            className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-800"
          >
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            ตัวอักษรหนาแน่น
          </span>
        )}
      </div>

      {promptTab === 'points' && (
        <div className="space-y-3">
          <ul className="space-y-1.5 text-sm text-slate-700">
            {slide.keyPoints.map((kp, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#EC3D6A]" />
                <span>{kp}</span>
              </li>
            ))}
          </ul>

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

          <div className="rounded-xl bg-[#FAF6F7] border border-[#E8DCE0] px-3 py-2 text-xs text-slate-600">
            <span className="font-semibold text-[#1F161A]">คำเชื่อมสไลด์ถัดไป: </span>
            <span className="italic">&ldquo;{slide.transitionPhrase}&rdquo;</span>
          </div>
        </div>
      )}

      {promptTab === 'script' && (
        <div className="rounded-xl border border-[#E8DCE0] bg-[#FAF6F7] p-3.5 space-y-2">
          <p className="text-sm sm:text-[15px] leading-relaxed text-[#1F161A] whitespace-pre-line">
            {slide.speakerScript ||
              slide.speakingGuide ||
              `สรุปประเด็นหน้านี้: ${slide.keyPoints.join(' — ')}`}
          </p>
          {slide.transitionPhrase && (
            <p className="border-t border-[#E8DCE0] pt-2 text-xs text-slate-500 italic">
              คำเชื่อม: &ldquo;{slide.transitionPhrase}&rdquo;
            </p>
          )}
        </div>
      )}
    </div>
  );
}
