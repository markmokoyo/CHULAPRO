'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileUp,
  HelpCircle,
  Loader2,
  MessageSquareQuote,
  Play,
  RefreshCw,
} from 'lucide-react';
import {
  FORMALITY_LABELS,
  type FormalityLevel,
  type PresentationPlan,
} from '@cuepulse/shared';
import { parseSlideFile, type ExtractedSlide } from '@/services/slideParser';
import {
  getAiRequestHeaders,
  listPlans,
  savePlan,
  setActivePlanId,
} from '@/services/storage';
import { emitQuotaUpdated } from '@/components/AiQuotaBadge';
import type { AiQuotaSnapshot } from '@/services/geminiQuota';

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
  const [lastExtractedSlides, setLastExtractedSlides] = useState<ExtractedSlide[] | null>(
    null
  );

  useEffect(() => {
    const existing = listPlans();
    setSavedPlans(existing);
    if (existing.length > 0) {
      setPlan(existing[0]);
      setFileName(existing[0].fileName);
    }
  }, []);

  const handleFileUpload = async (file: File) => {
    setError(null);
    setAiErrorNotice(null);
    setLoading(true);
    setFileName(file.name);
    try {
      const extracted = await parseSlideFile(file);
      setLastExtractedSlides(extracted);
      await generatePlan(file.name, extracted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ไม่สามารถอ่านไฟล์สไลด์ได้');
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
          extractedText:
            'ปัญหาความประหม่าบนเวทีและการควบคุมเวลาในการนำเสนอ\nนิสิตและทีมงานซ้อมคนเดียวมักพูดเร็วเกิน 220 พยางค์ต่อนาที\nเผลอใช้คำติดปาก "อืม / อ่า / แบบว่า" โดยไม่รู้ตัว',
          wordCount: 34,
          estimatedSyllables: 62,
        },
        {
          slideNumber: 2,
          extractedText:
            'แนวทางแก้ไข: CuePulse Web Studio และระบบสั่นเตือนจังหวะ\nวิเคราะห์ท่าทาง Eye Contact และจังหวะคำพูดแบบเรียลไทม์บนเบราว์เซอร์\nพักเตือนขั้นต่ำ 20 วินาที เพื่อไม่ให้รบกวนสมาธิระหว่างพูด',
          wordCount: 36,
          estimatedSyllables: 68,
        },
        {
          slideNumber: 3,
          extractedText:
            'ผลทดสอบเบื้องต้นและแผนพัฒนาสู่ Android & Wear OS\nลดคำติดปากได้ชัดเจนหลังซ้อมต่อเนื่อง 3 รอบ\nพร้อมขยายผลใช้งานจริงในห้องเรียนและการแข่งขันระดับมหาวิทยาลัย',
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
      await generatePlan(plan?.fileName || fileName || 'Presentation_Slides', slidesToUse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'วิเคราะห์ใหม่ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const generatePlan = async (name: string, slides: ExtractedSlide[]) => {
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
        slides,
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
    emitQuotaUpdated(data.quota);
    savePlan(data.plan);
    setPlan(data.plan);
    setSourceTag(data.source ?? null);
    setAiErrorNotice(data.aiError ?? null);
    setSavedPlans(listPlans());
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1F161A]">
            เตรียมสไลด์และจัดสรรเวลาพูด
          </h1>
          <p className="text-sm text-slate-500">
            แนบไฟล์สไลด์เพื่ออ่านโครงสร้างทีละหน้า วิเคราะห์คำนวณเวลาพูด ประเด็นหลัก และคำถามที่กรรมการอาจถาม
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
              className="app-press flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-[#EC3D6A] hover:bg-[#E13C6C] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition"
            >
              <Play className="h-4 w-4" />
              นำแผนนี้ไปซ้อมเดี่ยว
            </button>
          </div>
        )}
      </div>

      {aiErrorNotice && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          <span className="font-semibold">หมายเหตุการเชื่อมต่อ Gemini:</span> {aiErrorNotice}{' '}
          (ตรวจสอบคีย์ได้ที่ปุ่ม Gemini API มุมขวาบน แล้วกด &ldquo;วิเคราะห์ใหม่ด้วย Gemini&rdquo;)
        </div>
      )}

      {/* Upload & Config Card */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#E8DCE0] bg-white p-5 space-y-4 shadow-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              เวลาทั้งหมดในการนำเสนอ (นาที)
            </label>
            <input
              type="number"
              min={1}
              max={60}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Math.max(1, Number(e.target.value)))}
              className="w-full rounded-xl border border-[#D8C5CB] bg-[#FAF6F7] px-3 py-2 text-sm text-[#1F161A] focus:outline-none focus:border-[#EC3D6A]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ระดับความเป็นทางการ
            </label>
            <select
              value={formality}
              onChange={(e) => setFormality(e.target.value as FormalityLevel)}
              className="w-full rounded-xl border border-[#D8C5CB] bg-[#FAF6F7] px-3 py-2 text-sm text-[#1F161A] focus:outline-none focus:border-[#EC3D6A]"
            >
              {(Object.keys(FORMALITY_LABELS) as FormalityLevel[]).map((k) => (
                <option key={k} value={k}>
                  {FORMALITY_LABELS[k]}
                </option>
              ))}
            </select>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#D8C5CB] hover:border-[#EC3D6A] bg-[#FAF6F7] hover:bg-[#FCE8EE]/40 p-6 text-center transition">
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-[#EC3D6A]" />
            ) : (
              <FileUp className="h-8 w-8 text-[#EC3D6A]" />
            )}
            <span className="mt-2 text-sm font-semibold text-[#1F161A]">
              {fileName || 'เลือกไฟล์ .pdf / .pptx / .txt'}
            </span>
            <span className="mt-1 text-xs text-slate-500">
              อ่านแยกบรรทัด + โน้ตผู้พูด + นับคำไทยบนเครื่อง
            </span>
            <input
              type="file"
              accept=".pdf,.pptx,.txt,.md"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFileUpload(f);
              }}
            />
          </label>

          <button
            type="button"
            disabled={loading}
            onClick={() => void handleDemoSlides()}
            className="app-press w-full rounded-xl border border-[#D8C5CB] bg-[#FAF6F7] hover:bg-[#FCE8EE] px-4 py-2.5 text-xs font-semibold text-[#1F161A] transition"
          >
            ใช้สไลด์ตัวอย่าง (3 หน้า)
          </button>

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
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
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
                      {p.slides.length} สไลด์ • {Math.round(p.totalDurationSeconds / 60)} นาที
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Plan Output */}
        <div className="lg:col-span-2 space-y-4">
          {!plan ? (
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-[#D8C5CB] bg-white p-8 text-center text-sm text-slate-500">
              แนบไฟล์สไลด์หรือลองกด &ldquo;ใช้สไลด์ตัวอย่าง&rdquo; เพื่อดูตารางแบ่งเวลาพูด
            </div>
          ) : (
            <>
              {plan.executiveSummary && (
                <div className="rounded-2xl border border-[#E8DCE0] bg-white p-5 space-y-2 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    สรุปแก่นสำคัญของชุดสไลด์
                  </div>
                  <p className="text-sm text-[#1F161A] leading-relaxed">
                    {plan.executiveSummary}
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-[#E8DCE0] border-l-4 border-l-[#EC3D6A] bg-white p-5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-bold text-[#BE2257]">
                    แนวทางเกริ่นนำเปิดเรื่อง
                  </div>
                  {sourceTag && (
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                        sourceTag === 'gemini'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-[#FAF6F7] border-[#E8DCE0] text-slate-600'
                      }`}
                    >
                      {sourceTag === 'gemini' ? 'วิเคราะห์ด้วย Gemini' : 'จัดสรรเวลาอัตโนมัติ'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-800 leading-relaxed">
                  &ldquo;{plan.openingHook}&rdquo;
                </p>
                {plan.technicalHotwords.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-xs text-slate-500">คำสำคัญในสไลด์:</span>
                    {plan.technicalHotwords.map((hw) => (
                      <span
                        key={hw}
                        className="rounded-md bg-[#FAF6F7] border border-[#E8DCE0] px-2 py-0.5 text-xs text-[#BE2257] font-medium"
                      >
                        {hw}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {plan.slides.map((s) => (
                  <div
                    key={s.slideNumber}
                    className="rounded-2xl border border-[#E8DCE0] bg-white p-5 space-y-3 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-bold text-[#1F161A]">
                        สไลด์ {s.slideNumber}: {s.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500 tabular-nums">
                          {s.wordCount} คำ • ~
                          {s.estimatedSyllables ?? Math.max(1, Math.round(s.wordCount * 1.65))}{' '}
                          พยางค์
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-lg bg-[#FCE8EE] px-2.5 py-1 text-xs font-semibold text-[#BE2257] tabular-nums">
                          <Clock className="h-3.5 w-3.5 text-[#EC3D6A]" />
                          {s.allocatedSeconds} วินาที
                        </span>
                      </div>
                    </div>

                    {s.densityWarning && (
                      <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs text-amber-800">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        {s.densityWarning}
                      </div>
                    )}

                    <ul className="space-y-1 text-sm text-slate-700">
                      {s.keyPoints.map((kp, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#EC3D6A]" />
                          <span>{kp}</span>
                        </li>
                      ))}
                    </ul>

                    {s.speakingGuide && (
                      <div className="rounded-xl bg-[#FAF6F7] border border-[#E8DCE0] px-3 py-2 text-xs text-slate-700">
                        <span className="inline-flex items-center gap-1 font-semibold text-[#1F161A] mr-1">
                          <MessageSquareQuote className="h-3.5 w-3.5 text-[#EC3D6A]" />
                          แนวทางเล่าหน้านี้:
                        </span>
                        {s.speakingGuide}
                      </div>
                    )}

                    {s.likelyJudgeQuestion && (
                      <div className="rounded-xl bg-[#FCE8EE]/50 border border-[#F2C4D0] px-3 py-2 text-xs text-[#1F161A]">
                        <span className="inline-flex items-center gap-1 font-semibold text-[#BE2257] mr-1">
                          <HelpCircle className="h-3.5 w-3.5 text-[#EC3D6A]" />
                          คำถามที่กรรมการอาจถาม:
                        </span>
                        {s.likelyJudgeQuestion}
                      </div>
                    )}

                    {s.emphasisCues.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-slate-500">คำเน้นเสียง:</span>
                        {s.emphasisCues.map((cue, cIdx) => (
                          <span
                            key={cIdx}
                            className="rounded-md bg-[#FCE8EE] px-2 py-0.5 text-[11px] font-medium text-[#BE2257]"
                          >
                            {cue}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-slate-500 italic">
                      ประโยคเชื่อม: &ldquo;{s.transitionPhrase}&rdquo;
                    </p>
                  </div>
                ))}
              </div>

              {plan.closingStatement && (
                <div className="rounded-2xl border border-[#E8DCE0] bg-white p-5 space-y-2 shadow-sm">
                  <div className="text-xs font-bold text-[#BE2257]">
                    แนวทางประโยคปิดท้าย
                  </div>
                  <p className="text-sm text-slate-800 leading-relaxed">
                    &ldquo;{plan.closingStatement}&rdquo;
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
