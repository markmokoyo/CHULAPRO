'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  FileUp,
  ImagePlus,
  Loader2,
  Play,
  RefreshCw,
} from 'lucide-react';
import {
  FORMALITY_LABELS,
  type FormalityLevel,
  type PresentationPlan,
  type SlideItem,
} from '@cuepulse/shared';
import {
  countThaiWords,
  estimateThaiSyllables,
  parseMultipleImageSlides,
  parseSlideFile,
  renderTextSlidePreviewDataUrl,
  resizeImageFileToDataUrl,
  type ExtractedSlide,
} from '@/services/slideParser';
import {
  getAiRequestHeaders,
  listPlans,
  savePlan,
  setActivePlanId,
} from '@/services/storage';
import { emitQuotaUpdated } from '@/components/AiQuotaBadge';
import type { AiQuotaSnapshot } from '@/services/geminiQuota';

type SlideCardTab = 'points' | 'script' | 'judge';

export default function PlannerPage() {
  const router = useRouter();
  const [fileName, setFileName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [formality, setFormality] = useState<FormalityLevel>('competition');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiErrorNotice, setAiErrorNotice] = useState<string | null>(null);
  const [plan, setPlan] = useState<PresentationPlan | null>(null);
  const [savedPlans, setSavedPlans] = useState<PresentationPlan[]>([]);
  const [sourceTag, setSourceTag] = useState<string | null>(null);
  const [lastExtractedSlides, setLastExtractedSlides] = useState<
    ExtractedSlide[] | null
  >(null);
  const [slideTabs, setSlideTabs] = useState<Record<number, SlideCardTab>>({});
  const [scriptSavedTick, setScriptSavedTick] = useState<number | null>(null);
  const [inputMode, setInputMode] = useState<'file' | 'text'>('file');
  const [pastedTitle, setPastedTitle] = useState('');
  const [pastedScript, setPastedScript] = useState('');

  useEffect(() => {
    const existing = listPlans();
    setSavedPlans(existing);
    if (existing.length > 0) {
      setPlan(existing[0]);
      setFileName(existing[0].fileName);
    }
  }, []);

  const handleFilesUpload = async (fileList: FileList) => {
    setError(null);
    setAiErrorNotice(null);
    setLoading(true);
    const files = Array.from(fileList);
    if (files.length === 0) {
      setLoading(false);
      return;
    }

    const displayName =
      files.length === 1 ? files[0].name : `ชุดภาพสไลด์ (${files.length} หน้า)`;
    setFileName(displayName);

    try {
      const allImages = files.every((f) =>
        /\.(png|jpe?g|webp)$/i.test(f.name)
      );
      const extracted =
        files.length > 1 && allImages
          ? await parseMultipleImageSlides(files)
          : await parseSlideFile(files[0]);

      setLastExtractedSlides(extracted);
      await generatePlan(displayName, extracted);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'ไม่สามารถอ่านไฟล์สไลด์ได้'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTextScriptSubmit = async () => {
    const clean = pastedScript.trim();
    if (!clean) {
      setError('กรุณาวางหรือพิมพ์ข้อความบทพูดก่อนกดสร้างแผน');
      return;
    }
    setError(null);
    setAiErrorNotice(null);
    setLoading(true);
    const titleName = pastedTitle.trim() || 'บทพูดนำเสนอ (ข้อความ)';
    setFileName(titleName);
    try {
      const chunks = clean
        .split(/\n---+\n|\n\s*\n+/)
        .map((c) => c.trim())
        .filter(Boolean);
      const sections = chunks.length > 0 ? chunks : [clean];
      const extracted: ExtractedSlide[] = sections.map((chunk, idx) => ({
        slideNumber: idx + 1,
        extractedText: chunk,
        speakerScript: chunk,
        imageDataUrl: renderTextSlidePreviewDataUrl(idx + 1, chunk),
        wordCount: countThaiWords(chunk),
        estimatedSyllables: estimateThaiSyllables(chunk),
      }));
      setLastExtractedSlides(extracted);
      await generatePlan(titleName, extracted);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'ไม่สามารถสร้างแผนจากข้อความได้'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSlides = async () => {
    setError(null);
    setAiErrorNotice(null);
    setLoading(true);
    const demoName = 'CuePulse_Pitch_Deck.pptx';
    setFileName(demoName);
    try {
      const demoSlides: ExtractedSlide[] = [
        {
          slideNumber: 1,
          imageDataUrl: '/images/demo-slide-1.svg',
          extractedText:
            'ปัญหาความประหม่าบนเวทีและการควบคุมเวลาในการนำเสนอ\nนิสิตและทีมงานซ้อมคนเดียวมักพูดเร็วเกิน 220 พยางค์ต่อนาที\nเผลอใช้คำติดปาก "อืม / อ่า / แบบว่า" โดยไม่รู้ตัว',
          speakerScript:
            'สวัสดีครับ หลายคนเวลาขึ้นเวทีนำเสนองานมักพูดเร็วกว่าปกติและเผลอใช้คำติดปากโดยไม่รู้ตัว ซึ่งส่งผลต่อความน่าเชื่อถือและทำให้จบไม่ตรงเวลา',
          wordCount: 34,
          estimatedSyllables: 62,
        },
        {
          slideNumber: 2,
          imageDataUrl: '/images/demo-slide-2.svg',
          extractedText:
            'แนวทางแก้ไข: CuePulse Web Studio และระบบสั่นเตือนจังหวะ\nวิเคราะห์ท่าทาง Eye Contact และจังหวะคำพูดแบบเรียลไทม์บนเบราว์เซอร์\nพักเตือนขั้นต่ำ 20 วินาที เพื่อไม่ให้รบกวนสมาธิระหว่างพูด',
          speakerScript:
            'เราจึงพัฒนา CuePulse เพื่อช่วยตรวจจับความเร็วคำพูด คำฟุ่มเฟือย และการสบตาผู้ฟังแบบเรียลไทม์ พร้อมจำลองสัญญาณสั่นเตือนที่มีช่วงพัก 20 วินาทีไม่รบกวนสมาธิ',
          wordCount: 36,
          estimatedSyllables: 68,
        },
        {
          slideNumber: 3,
          imageDataUrl: '/images/demo-slide-3.svg',
          extractedText:
            'ผลทดสอบเบื้องต้นและแผนพัฒนาสู่ Android & Wear OS\nลดคำติดปากได้ชัดเจนหลังซ้อมต่อเนื่อง 3 รอบ\nพร้อมขยายผลใช้งานจริงในห้องเรียนและการแข่งขันระดับมหาวิทยาลัย',
          speakerScript:
            'จากการทดสอบช่วยให้ผู้พูดคุมจังหวะให้อยู่ในช่วง 180 ถึง 220 พยางค์ต่อนาทีได้ดีขึ้น และในระยะถัดไปเราจะเชื่อมต่อเข้ากับสมาร์ทวอทช์จริงสำหรับใช้งานบนเวทีครับ',
          wordCount: 29,
          estimatedSyllables: 54,
        },
      ];
      setLastExtractedSlides(demoSlides);
      await generatePlan(demoName, demoSlides);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'สร้างแผนไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleReanalyzeWithAi = async () => {
    const slidesToUse: ExtractedSlide[] =
      lastExtractedSlides ??
      (plan?.slides.map((s) => ({
        slideNumber: s.slideNumber,
        extractedText: s.extractedText,
        speakerScript: s.speakerScript,
        imageDataUrl: s.imageDataUrl,
        wordCount: s.wordCount,
        estimatedSyllables:
          s.estimatedSyllables ?? Math.max(1, Math.round(s.wordCount * 1.65)),
      })) ??
        []);

    if (slidesToUse.length === 0) return;

    setError(null);
    setAiErrorNotice(null);
    setLoading(true);
    try {
      await generatePlan(
        plan?.fileName || fileName || 'Presentation_Slides',
        slidesToUse
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'วิเคราะห์ใหม่ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const generatePlan = async (name: string, slides: ExtractedSlide[]) => {
    // Strip large imageDataUrl strings from API payload and re-attach locally
    const payloadSlides = slides.map((s) => ({
      slideNumber: s.slideNumber,
      extractedText: s.extractedText,
      speakerScript: s.speakerScript,
      wordCount: s.wordCount,
      estimatedSyllables: s.estimatedSyllables,
    }));

    const res = await fetch('/api/plan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAiRequestHeaders(),
      },
      body: JSON.stringify({
        fileName: name,
        totalDurationSeconds: durationMinutes * 60,
        formality,
        slides: payloadSlides,
      }),
    });
    const data = (await res.json()) as {
      plan?: PresentationPlan;
      source?: string;
      aiError?: string;
      quota?: AiQuotaSnapshot;
      error?: string;
    };
    if (!res.ok || !data.plan) {
      throw new Error(data.error || 'สร้างแผนไม่สำเร็จ');
    }

    const hydratedPlan: PresentationPlan = {
      ...data.plan,
      sourceType: 'slides',
      slides: data.plan.slides.map((s, idx) => {
        const matched =
          slides.find((src) => src.slideNumber === s.slideNumber) ??
          slides[idx];
        return {
          ...s,
          imageDataUrl: matched?.imageDataUrl ?? s.imageDataUrl,
          speakerScript: s.speakerScript || matched?.speakerScript,
        };
      }),
    };

    emitQuotaUpdated(data.quota);
    savePlan(hydratedPlan);
    setPlan(hydratedPlan);
    setSourceTag(data.source ?? null);
    setAiErrorNotice(data.aiError ?? null);
    setSavedPlans(listPlans());
  };

  const updateSlideField = (
    slideNumber: number,
    patch: Partial<SlideItem>
  ) => {
    if (!plan) return;
    const updated: PresentationPlan = {
      ...plan,
      slides: plan.slides.map((s) =>
        s.slideNumber === slideNumber ? { ...s, ...patch } : s
      ),
    };
    setPlan(updated);
    savePlan(updated);
    setSavedPlans(listPlans());
    setScriptSavedTick(slideNumber);
    setTimeout(() => {
      setScriptSavedTick((curr) => (curr === slideNumber ? null : curr));
    }, 1500);
  };

  const handleSlideImageReplace = async (slideNumber: number, file: File) => {
    try {
      const dataUrl = await resizeImageFileToDataUrl(file, 800, 0.78);
      if (dataUrl) {
        updateSlideField(slideNumber, { imageDataUrl: dataUrl });
      }
    } catch {
      setError('ไม่สามารถอัปโหลดรูปภาพสไลด์ได้');
    }
  };

  const selectSavedPlan = (p: PresentationPlan) => {
    setActivePlanId(p.id);
    setPlan(p);
    setFileName(p.fileName);
    setLastExtractedSlides(null);
    setSourceTag(null);
    setAiErrorNotice(null);
  };

  return (
    <div className="space-y-6">
      <div className="animate-fade-up flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-[#2B2135]">
            เตรียมสไลด์ สคริปต์พูด และจัดสรรเวลา
          </h1>
          <p className="text-sm text-slate-500">
            อัปโหลดสไลด์ (.pdf / .pptx / รูปภาพ) หรือวางบทพูดเพื่อให้ระบบแบ่งเวลาซ้อมให้อัตโนมัติ
          </p>
        </div>
        {plan && (
          <div className="flex w-full sm:w-auto flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => void handleReanalyzeWithAi()}
              className="app-press flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#D8C5CB] bg-white hover:bg-[#FAF6F7] px-3.5 py-2.5 text-sm font-semibold text-[#1F161A] disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#EC3D6A]" />
              ) : (
                <RefreshCw className="h-4 w-4 text-[#EC3D6A]" />
              )}
              วิเคราะห์ใหม่ด้วย Gemini
            </button>
            <button
              type="button"
              onClick={() => router.push('/practice/solo')}
              className="app-press cta-shimmer flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#EC3D6A] to-[#F472B6] hover:brightness-105 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition"
            >
              <Play className="h-4 w-4" />
              นำแผนนี้ไปซ้อมเดี่ยว
            </button>
          </div>
        )}
      </div>

      {aiErrorNotice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <span className="font-semibold">หมายเหตุการเชื่อมต่อ Gemini:</span>{' '}
          {aiErrorNotice} (ตรวจสอบคีย์ได้ที่ปุ่ม Gemini API มุมขวาบน)
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left 4 Columns: Upload & Setup */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-[#E8DCE0] bg-white p-5 space-y-4 shadow-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  เวลารวม (นาที)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={durationMinutes}
                  onChange={(e) =>
                    setDurationMinutes(Math.max(1, Number(e.target.value)))
                  }
                  className="w-full rounded-xl border border-[#D8C5CB] bg-[#FAF6F7] px-3 py-2 text-sm text-[#1F161A] focus:outline-none focus:border-[#EC3D6A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  รูปแบบงาน
                </label>
                <select
                  value={formality}
                  onChange={(e) =>
                    setFormality(e.target.value as FormalityLevel)
                  }
                  className="w-full rounded-xl border border-[#D8C5CB] bg-[#FAF6F7] px-2.5 py-2 text-xs sm:text-sm text-[#1F161A] focus:outline-none focus:border-[#EC3D6A]"
                >
                  {(Object.keys(FORMALITY_LABELS) as FormalityLevel[]).map(
                    (k) => (
                      <option key={k} value={k}>
                        {FORMALITY_LABELS[k]}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            {/* Mode Switch: Upload Slides vs Paste Script Text */}
            <div
              role="tablist"
              aria-label="วิธีนำเข้าข้อมูล"
              className="grid grid-cols-2 rounded-xl border border-[#E8DCE0] bg-[#F5EEF0] p-1 text-xs"
            >
              <button
                type="button"
                role="tab"
                aria-selected={inputMode === 'file'}
                onClick={() => setInputMode('file')}
                className={`rounded-lg py-1.5 font-semibold transition ${
                  inputMode === 'file'
                    ? 'bg-white text-[#1F161A] shadow-sm'
                    : 'text-slate-600 hover:text-[#EC3D6A]'
                }`}
              >
                อัปโหลดไฟล์สไลด์
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={inputMode === 'text'}
                onClick={() => setInputMode('text')}
                className={`rounded-lg py-1.5 font-semibold transition ${
                  inputMode === 'text'
                    ? 'bg-white text-[#1F161A] shadow-sm'
                    : 'text-slate-600 hover:text-[#EC3D6A]'
                }`}
              >
                วางบทพูด / ข้อความ
              </button>
            </div>

            {inputMode === 'file' ? (
              <>
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#D8C5CB] hover:border-[#EC3D6A] bg-[#FAF6F7] hover:bg-[#FCE8EE]/40 p-6 text-center transition">
                  {loading ? (
                    <Loader2 className="h-7 w-7 animate-spin text-[#EC3D6A]" />
                  ) : (
                    <FileUp className="h-7 w-7 text-[#EC3D6A]" />
                  )}
                  <span className="mt-2 text-sm font-semibold text-[#1F161A] truncate max-w-full">
                    {fileName || 'เลือกไฟล์ .pdf / .pptx / รูปสไลด์'}
                  </span>
                  <span className="mt-1 text-xs text-slate-500">
                    รองรับไฟล์ PDF (แสดงภาพจริงทุกหน้า), PPTX, หรือเลือกหลายรูปภาพพร้อมกัน
                  </span>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        void handleFilesUpload(e.target.files);
                      }
                    }}
                  />
                </label>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleDemoSlides()}
                  className="app-press w-full rounded-xl border border-[#D8C5CB] bg-[#FAF6F7] hover:bg-[#FCE8EE] px-4 py-2.5 text-xs font-semibold text-[#1F161A] transition"
                >
                  ใช้ชุดสไลด์ตัวอย่าง (3 หน้า พร้อมภาพและสคริปต์)
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ชื่อหัวข้อ / ชื่อบทพูด (ไม่บังคับ)
                  </label>
                  <input
                    type="text"
                    value={pastedTitle}
                    onChange={(e) => setPastedTitle(e.target.value)}
                    placeholder="เช่น บทพูดนำเสนอโครงงาน 5 นาที"
                    className="w-full rounded-xl border border-[#D8C5CB] bg-[#FAF6F7] px-3 py-2 text-xs sm:text-sm text-[#1F161A] placeholder:text-slate-400 focus:outline-none focus:border-[#EC3D6A]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5 text-[#EC3D6A]" />
                      วางข้อความบทพูดที่นี่
                    </span>
                    {pastedScript.trim() && (
                      <span className="text-[11px] font-medium text-[#BE2257] tabular-nums">
                        ~{estimateThaiSyllables(pastedScript)} พยางค์ (
                        {Math.max(
                          1,
                          Math.round((estimateThaiSyllables(pastedScript) / 200) * 60)
                        )}{' '}
                        วิ)
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={7}
                    value={pastedScript}
                    onChange={(e) => setPastedScript(e.target.value)}
                    placeholder={
                      'วางบทพูดทั้งหมดที่นี่ได้เลย...\n\nเคล็ดลับ: เว้นบรรทัดว่าง (Enter 2 ครั้ง) เพื่อแบ่งบทพูดออกเป็นช่วงๆ หรือแต่ละสไลด์อัตโนมัติ'
                    }
                    className="w-full rounded-xl border border-[#D8C5CB] bg-[#FAF6F7] px-3 py-2.5 text-xs sm:text-sm leading-relaxed text-[#1F161A] placeholder:text-slate-400 focus:outline-none focus:border-[#EC3D6A]"
                  />
                </div>

                <button
                  type="button"
                  disabled={loading || !pastedScript.trim()}
                  onClick={() => void handleTextScriptSubmit()}
                  className="app-press w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#EC3D6A] hover:bg-[#E13C6C] px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm disabled:opacity-45"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                  สร้างแผนและแบ่งเวลาจากบทพูดนี้
                </button>
              </div>
            )}

            <div className="rounded-xl border border-[#E8DCE0] bg-[#FAF6F7] px-3.5 py-2.5 text-xs text-slate-600 leading-relaxed">
              ต้องการซ้อมพูดแบบไม่มีสไลด์? สามารถกดไปที่หน้า{' '}
              <button
                type="button"
                onClick={() => router.push('/practice/solo')}
                className="font-semibold text-[#EC3D6A] hover:underline"
              >
                ซ้อมเดี่ยว
              </button>{' '}
              เพื่อพูดสดหรือวางสคริปต์พูดได้ทันทีโดยไม่ต้องอัปโหลดไฟล์
            </div>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-300 p-3 text-xs text-rose-700">
                {error}
              </div>
            )}

            {savedPlans.length > 0 && (
              <div className="pt-2 border-t border-[#E8DCE0]">
                <p className="text-xs font-semibold text-slate-500 mb-2">
                  คิวสไลด์ที่บันทึกไว้ ({savedPlans.length})
                </p>
                <div className="space-y-1.5 max-h-44 overflow-y-auto">
                  {savedPlans.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectSavedPlan(p)}
                      className={`w-full text-left rounded-xl px-2.5 py-2 text-xs transition ${
                        plan?.id === p.id
                          ? 'bg-[#FCE8EE] text-[#BE2257] border border-[#F2C4D0] font-semibold'
                          : 'bg-[#FAF6F7] text-slate-700 hover:bg-[#FCE8EE]/60 border border-transparent'
                      }`}
                    >
                      <div className="font-medium truncate">{p.fileName}</div>
                      <div className="text-[11px] text-slate-500">
                        {p.slides.length} สไลด์ •{' '}
                        {Math.round(p.totalDurationSeconds / 60)} นาที
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right 8 Columns: Uncluttered Editorial Slide List */}
        <div className="lg:col-span-8 space-y-4">
          {!plan ? (
            <div className="flex flex-col min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-[#D8C5CB] bg-white/80 p-8 text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FCE8EE] text-[#EC3D6A]">
                <FileUp className="h-6 w-6" />
              </div>
              <div className="space-y-1 max-w-md">
                <p className="font-display text-base font-bold text-[#2B2135]">
                  ยังไม่มีชุดสไลด์ในคิวซ้อม
                </p>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                  เลือกไฟล์ PDF, PPTX, รูปสไลด์ หรือวางบทพูดจากกล่องด้านซ้ายเพื่อแบ่งเวลาซ้อมอัตโนมัติ
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Clean Editorial Summary Card */}
              <div className="rounded-2xl border border-[#E8DCE0] border-l-4 border-l-[#EC3D6A] bg-white p-5 space-y-3 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#BE2257] uppercase tracking-wide">
                    โครงสร้างภาพรวมการนำเสนอ
                  </span>
                  {sourceTag && (
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                        sourceTag === 'gemini'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-[#FAF6F7] border-[#E8DCE0] text-slate-600'
                      }`}
                    >
                      {sourceTag === 'gemini'
                        ? 'วิเคราะห์ด้วย Gemini'
                        : 'คำนวณเวลาอัตโนมัติ'}
                    </span>
                  )}
                </div>

                {plan.executiveSummary && (
                  <p className="text-sm text-[#1F161A] leading-relaxed">
                    {plan.executiveSummary}
                  </p>
                )}

                <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
                  <div className="rounded-xl bg-[#FAF6F7] border border-[#E8DCE0] p-3 text-xs">
                    <div className="font-semibold text-[#BE2257] mb-1">
                      ประโยคเปิดเรื่องแนะนำ
                    </div>
                    <p className="text-slate-700 leading-relaxed">
                      &ldquo;{plan.openingHook}&rdquo;
                    </p>
                  </div>
                  {plan.closingStatement && (
                    <div className="rounded-xl bg-[#FAF6F7] border border-[#E8DCE0] p-3 text-xs">
                      <div className="font-semibold text-[#047857] mb-1">
                        ประโยคปิดท้ายแนะนำ
                      </div>
                      <p className="text-slate-700 leading-relaxed">
                        &ldquo;{plan.closingStatement}&rdquo;
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Uncluttered Slide Cards (Visual Left + Tabbed Notes Right) */}
              <div className="space-y-4">
                {plan.slides.map((s) => {
                  const activeTab: SlideCardTab =
                    slideTabs[s.slideNumber] ?? 'points';
                  return (
                    <article
                      key={s.slideNumber}
                      className="rounded-2xl border border-[#E8DCE0] bg-white p-4 sm:p-5 shadow-sm"
                    >
                      <div className="grid gap-4 md:grid-cols-12 items-start">
                        {/* Left 5 cols: 16:9 Visual Slide Thumbnail */}
                        <div className="md:col-span-5 space-y-2">
                          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[#E8DCE0] bg-[#FAF6F7]">
                            {s.imageDataUrl ? (
                              <img
                                src={s.imageDataUrl}
                                alt={`ภาพสไลด์หน้า ${s.slideNumber}: ${s.title}`}
                                className="h-full w-full object-contain bg-white"
                              />
                            ) : (
                              <div className="flex h-full w-full flex-col justify-between bg-white p-3.5">
                                <span className="text-[10px] font-bold text-[#BE2257]">
                                  SLIDE {String(s.slideNumber).padStart(2, '0')}
                                </span>
                                <p className="text-xs font-bold text-[#1F161A] line-clamp-2">
                                  {s.title}
                                </p>
                                <p className="text-[11px] text-slate-400 line-clamp-2">
                                  {s.extractedText}
                                </p>
                              </div>
                            )}
                            <span className="absolute bottom-2 left-2 rounded-md border border-white/70 bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#6D28D9] shadow-sm backdrop-blur-sm tabular-nums">
                              หน้า {s.slideNumber}
                            </span>
                          </div>

                          <label className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#D8C5CB] bg-[#FAF6F7] hover:bg-[#FCE8EE] px-2.5 py-1.5 text-[11px] font-semibold text-[#1F161A] transition">
                            <ImagePlus className="h-3.5 w-3.5 text-[#EC3D6A]" />
                            {s.imageDataUrl
                              ? 'เปลี่ยนรูปสไลด์หน้านี้'
                              : 'อัปโหลดรูปสไลด์หน้านี้'}
                            <input
                              type="file"
                              accept=".png,.jpg,.jpeg,.webp"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) {
                                  void handleSlideImageReplace(s.slideNumber, f);
                                }
                              }}
                            />
                          </label>
                        </div>

                        {/* Right 7 cols: Title + Tabbed Content */}
                        <div className="md:col-span-7 space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h3 className="text-sm sm:text-base font-bold text-[#1F161A]">
                                {s.slideNumber}. {s.title}
                              </h3>
                              <p className="text-[11px] text-slate-500 tabular-nums mt-0.5">
                                {s.wordCount} คำ • ~
                                {s.estimatedSyllables ??
                                  Math.max(1, Math.round(s.wordCount * 1.65))}{' '}
                                พยางค์
                              </p>
                            </div>
                            <span className="inline-flex items-center gap-1 rounded-lg border border-[#DDD6FE] bg-[#F5F3FF] px-2.5 py-1 text-xs font-semibold text-[#6D28D9] tabular-nums shrink-0">
                              <Clock className="h-3.5 w-3.5 text-[#8B5CF6]" />
                              {s.allocatedSeconds} วินาที
                            </span>
                          </div>

                          {/* Compact Tab Switcher */}
                          <div
                            role="tablist"
                            className="inline-flex rounded-xl border border-[#E8DCE0] bg-[#F5EEF0] p-0.5 text-xs"
                          >
                            {(
                              [
                                { id: 'points', label: 'ประเด็นหลัก' },
                                { id: 'script', label: 'สคริปต์พูด' },
                                { id: 'judge', label: 'แนวคำถาม' },
                              ] as const
                            ).map((tab) => {
                              const active = activeTab === tab.id;
                              return (
                                <button
                                  key={tab.id}
                                  type="button"
                                  role="tab"
                                  aria-selected={active}
                                  onClick={() =>
                                    setSlideTabs((prev) => ({
                                      ...prev,
                                      [s.slideNumber]: tab.id,
                                    }))
                                  }
                                  className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                                    active
                                      ? 'bg-white text-[#1F161A] shadow-sm'
                                      : 'text-slate-600 hover:text-[#EC3D6A]'
                                  }`}
                                >
                                  {tab.label}
                                </button>
                              );
                            })}
                          </div>

                          {activeTab === 'points' && (
                            <div className="space-y-2.5">
                              {s.densityWarning && (
                                <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-800">
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                                  {s.densityWarning}
                                </div>
                              )}
                              <ul className="space-y-1 text-xs sm:text-sm text-slate-700">
                                {s.keyPoints.map((kp, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#EC3D6A]" />
                                    <span>{kp}</span>
                                  </li>
                                ))}
                              </ul>
                              <p className="text-xs text-slate-500 italic">
                                คำเชื่อม: &ldquo;{s.transitionPhrase}&rdquo;
                              </p>
                            </div>
                          )}

                          {activeTab === 'script' && (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span>
                                  แก้ไขบทพูดสำหรับหน้านี้ (แสดงระหว่างซ้อมในแท็บ &ldquo;สคริปต์พูด&rdquo;)
                                </span>
                                {scriptSavedTick === s.slideNumber && (
                                  <span className="font-semibold text-emerald-600">
                                    บันทึกแล้ว
                                  </span>
                                )}
                              </div>
                              <textarea
                                rows={4}
                                value={s.speakerScript ?? ''}
                                onChange={(e) =>
                                  updateSlideField(s.slideNumber, {
                                    speakerScript: e.target.value,
                                  })
                                }
                                placeholder="พิมพ์หรือวางสคริปต์คำพูดสำหรับสไลด์หน้านี้..."
                                className="w-full rounded-xl border border-[#D8C5CB] bg-[#FAF6F7] px-3 py-2 text-xs sm:text-sm leading-relaxed text-[#1F161A] focus:outline-none focus:border-[#EC3D6A]"
                              />
                            </div>
                          )}

                          {activeTab === 'judge' && (
                            <div className="space-y-2 text-xs">
                              {s.speakingGuide && (
                                <div className="rounded-xl bg-[#FAF6F7] border border-[#E8DCE0] p-2.5 text-slate-700">
                                  <span className="font-semibold text-[#1F161A]">
                                    ลำดับการเล่าหน้านี้:{' '}
                                  </span>
                                  {s.speakingGuide}
                                </div>
                              )}
                              {s.likelyJudgeQuestion && (
                                <div className="rounded-xl bg-[#FCE8EE]/60 border border-[#F2C4D0] p-2.5 text-[#1F161A]">
                                  <span className="font-semibold text-[#BE2257]">
                                    คำถามที่กรรมการอาจถาม:{' '}
                                  </span>
                                  {s.likelyJudgeQuestion}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
