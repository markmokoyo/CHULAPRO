'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  RefreshCw,
  Send,
  Volume2,
} from 'lucide-react';
import {
  AUDIENCE_PERSONAS,
  type AudienceMessage,
  type PresentationPlan,
  type SpeechContentAnalysis,
  type TeamSessionReport,
} from '@cuepulse/shared';
import {
  getAiRequestHeaders,
  getSessionReportById,
  listPlans,
  saveSessionReport,
  type AnySessionReport,
} from '@/services/storage';
import { emitQuotaUpdated } from '@/components/AiQuotaBadge';
import type { AiQuotaSnapshot } from '@/services/geminiQuota';
import { ScoreOverview } from '@/components/report/ScoreOverview';
import { TimelineChart } from '@/components/report/TimelineChart';
import { TeamBreakdown } from '@/components/report/TeamBreakdown';
import { SessionVideoPlayer } from '@/components/report/SessionVideoPlayer';
import { speakQuestionNatural, stopSpeaking } from '@/services/voicePlayer';

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<AnySessionReport | null>(null);
  const [plan, setPlan] = useState<PresentationPlan | null>(null);
  const [judgeLoading, setJudgeLoading] = useState(false);
  const [speechAnalysisLoading, setSpeechAnalysisLoading] = useState(false);
  const [judgeSource, setJudgeSource] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [listeningId, setListeningId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState<'gemini' | 'browser'>('gemini');

  const autoRequestedRef = useRef(false);
  const autoSpeechRequestedRef = useRef(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  useEffect(() => {
    return () => {
      stopSpeaking();
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore cleanup error
      }
    };
  }, []);

  const buildSlideContext = useCallback(
    (rep: AnySessionReport, pl: PresentationPlan | null): string => {
      if (pl && pl.slides.length > 0) {
        return pl.slides
          .map(
            (s) =>
              `Slide ${s.slideNumber} (${s.title}): ${s.keyPoints.join('; ')}\n${s.extractedText.slice(0, 300)}`
          )
          .join('\n\n');
      }
      const parts: string[] = [];
      if (rep.topicTitle) parts.push(`หัวข้อที่พูด: ${rep.topicTitle}`);
      if (rep.speakerScript) parts.push(`สคริปต์ที่เตรียม: ${rep.speakerScript.slice(0, 600)}`);
      if (rep.speechAnalysis?.detectedTopic) {
        parts.push(`ใจความหลักจากคำพูด: ${rep.speechAnalysis.detectedTopic}`);
      }
      parts.push(`การซ้อมพูดปากเปล่า ความยาว ${rep.durationSeconds} วินาที`);
      return parts.join('\n');
    },
    []
  );

  const generateSpeechAnalysis = useCallback(async (rep: AnySessionReport) => {
    setSpeechAnalysisLoading(true);
    try {
      const transcriptText = rep.transcriptSegments.map((t) => t.text).join(' ');
      const metricsSummary = `ความเร็วเฉลี่ย ${rep.metrics.averageSpm} พยางค์/นาที, คำติดปาก ${rep.metrics.fillerCount} ครั้ง, สบตาผู้ฟัง ${rep.metrics.eyeContactRatio}%, บุคลิกภาพ ${rep.metrics.goodPostureRatio}%, คะแนนรวม ${rep.overallScore}/100`;

      const res = await fetch('/api/audience', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAiRequestHeaders(),
        },
        body: JSON.stringify({
          mode: 'speech_analysis',
          slideContext: rep.topicTitle || 'ซ้อมพูดปากเปล่า',
          topicTitle: rep.topicTitle,
          speakerScript: rep.speakerScript,
          recentTranscript: transcriptText,
          metricsSummary,
          durationSeconds: rep.durationSeconds,
        }),
      });

      const data = (await res.json()) as {
        analysis?: SpeechContentAnalysis;
        quota?: AiQuotaSnapshot;
      };
      emitQuotaUpdated(data.quota);

      if (data.analysis) {
        setReport((curr) => {
          const base = curr ?? rep;
          const updated: AnySessionReport = {
            ...base,
            speechAnalysis: data.analysis,
          };
          saveSessionReport(updated);
          return updated;
        });
      }
    } catch {
      // Ignore silent failure so report remains usable
    } finally {
      setSpeechAnalysisLoading(false);
    }
  }, []);

  const generateJudgeQuestions = useCallback(
    async (rep: AnySessionReport, pl: PresentationPlan | null) => {
      setJudgeLoading(true);
      setAiNotice(null);
      try {
        const transcriptText = rep.transcriptSegments.map((t) => t.text).join(' ');
        const metricsSummary = `ความเร็วเฉลี่ย ${rep.metrics.averageSpm} พยางค์/นาที, คำติดปาก ${rep.metrics.fillerCount} ครั้ง, สบตาผู้ฟัง ${rep.metrics.eyeContactRatio}%, บุคลิกภาพ ${rep.metrics.goodPostureRatio}%, คะแนนรวม ${rep.overallScore}/100`;

        const res = await fetch('/api/audience', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAiRequestHeaders(),
          },
          body: JSON.stringify({
            mode: 'judge_panel',
            slideContext: buildSlideContext(rep, pl),
            recentTranscript: transcriptText,
            metricsSummary,
            formality: pl?.formality || 'competition',
          }),
        });

        const data = (await res.json()) as {
          questions?: AudienceMessage[];
          source?: string;
          aiError?: string;
          quota?: AiQuotaSnapshot;
        };

        emitQuotaUpdated(data.quota);
        setJudgeSource(data.source ?? null);
        if (data.aiError) {
          setAiNotice(data.aiError);
        }

        if (data.questions && data.questions.length > 0) {
          const updated: AnySessionReport = {
            ...rep,
            audienceHistory: data.questions,
          };
          saveSessionReport(updated);
          setReport(updated);
        }
      } catch (err) {
        setAiNotice(
          err instanceof Error ? err.message : 'ไม่สามารถโหลดคำถามกรรมการได้'
        );
      } finally {
        setJudgeLoading(false);
      }
    },
    [buildSlideContext]
  );

  useEffect(() => {
    if (!params.id) return;
    const found = getSessionReportById(params.id);
    if (!found) return;

    const plans = listPlans();
    const matchedPlan = found.planId
      ? (plans.find((p) => p.id === found.planId) ?? null)
      : null;

    setReport(found);
    setPlan(matchedPlan);

    const existingAnswers: Record<string, string> = {};
    found.audienceHistory?.forEach((q) => {
      if (q.userAnswer) existingAnswers[q.id] = q.userAnswer;
    });
    setDraftAnswers(existingAnswers);

    if (!matchedPlan && !found.speechAnalysis && !autoSpeechRequestedRef.current) {
      autoSpeechRequestedRef.current = true;
      void generateSpeechAnalysis(found);
    }

    if (
      (!found.audienceHistory || found.audienceHistory.length === 0) &&
      !autoRequestedRef.current
    ) {
      autoRequestedRef.current = true;
      void generateJudgeQuestions(found, matchedPlan);
    }
  }, [params.id, generateJudgeQuestions, generateSpeechAnalysis]);

  const speakQuestion = (q: AudienceMessage) => {
    if (speakingId === q.id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    void speakQuestionNatural({
      text: q.text,
      personaId: q.personaId,
      preferGemini: voiceMode === 'gemini',
      onStart: () => setSpeakingId(q.id),
      onEnd: () => setSpeakingId((curr) => (curr === q.id ? null : curr)),
    });
  };

  const toggleVoiceAnswer = (questionId: string) => {
    if (listeningId === questionId) {
      recognitionRef.current?.stop();
      setListeningId(null);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognition;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
    };
    const Rec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!Rec) {
      setAiNotice('เบราว์เซอร์นี้ไม่รองรับการรับเสียงพูด กรุณาพิมพ์คำตอบในช่องข้อความแทนครับ');
      return;
    }

    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }

    const rec = new Rec();
    rec.lang = 'th-TH';
    rec.continuous = true;
    rec.interimResults = false;

    rec.onresult = (e) => {
      const latestIdx = e.results.length - 1;
      const phrase = e.results[latestIdx]?.[0]?.transcript?.trim();
      if (phrase) {
        setDraftAnswers((prev) => ({
          ...prev,
          [questionId]: prev[questionId] ? `${prev[questionId]} ${phrase}` : phrase,
        }));
      }
    };
    rec.onerror = () => setListeningId(null);
    rec.onend = () => setListeningId(null);

    recognitionRef.current = rec;
    setListeningId(questionId);
    rec.start();
  };

  const submitAnswerForEvaluation = async (question: AudienceMessage) => {
    if (!report) return;
    const answerText = (draftAnswers[question.id] ?? '').trim();
    if (!answerText) return;

    setEvaluatingId(question.id);
    setAiNotice(null);
    try {
      const res = await fetch('/api/audience', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAiRequestHeaders(),
        },
        body: JSON.stringify({
          mode: 'evaluate_answer',
          questionTh: question.text,
          userAnswer: answerText,
          slideContext: buildSlideContext(report, plan),
        }),
      });
      const data = (await res.json()) as {
        evaluationScore?: number;
        evaluationFeedbackTh?: string;
        improvedAnswerTh?: string;
        source?: string;
        aiError?: string;
        quota?: AiQuotaSnapshot;
      };

      emitQuotaUpdated(data.quota);
      if (data.aiError) setAiNotice(data.aiError);

      const updatedHistory = (report.audienceHistory ?? []).map((item) =>
        item.id === question.id
          ? {
              ...item,
              userAnswer: answerText,
              evaluationScore: data.evaluationScore,
              evaluationFeedbackTh: data.evaluationFeedbackTh,
              improvedAnswerTh: data.improvedAnswerTh,
            }
          : item
      );

      const updatedReport: AnySessionReport = {
        ...report,
        audienceHistory: updatedHistory,
      };
      saveSessionReport(updatedReport);
      setReport(updatedReport);
    } finally {
      setEvaluatingId(null);
    }
  };

  if (!report) {
    return (
      <div className="rounded-2xl border border-[#E8DCE0] bg-white p-8 text-center space-y-3 shadow-sm">
        <p className="text-slate-600">ไม่พบข้อมูลรายงานเซสชันนี้</p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#EC3D6A] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          กลับหน้าหลัก
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#EC3D6A] mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            กลับหน้าหลัก
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1F161A]">
            รายงานผลการฝึกซ้อม ({report.mode === 'team' ? 'ซ้อมกลุ่ม' : 'ซ้อมเดี่ยว'})
          </h1>
          <p className="text-xs text-slate-500">
            ระยะเวลา {report.durationSeconds} วินาที •{' '}
            {new Date(report.createdAt).toLocaleString('th-TH')}
            {plan
              ? ` • สไลด์: ${plan.fileName}`
              : report.topicTitle
                ? ` • หัวข้อ: ${report.topicTitle}`
                : ' • โหมดพูดอิสระ (ไม่ใช้สไลด์)'}
          </p>
        </div>
      </div>

      <ScoreOverview report={report} />

      <SessionVideoPlayer
        sessionId={report.sessionId}
        hapticCues={report.hapticCues}
        fillers={report.fillers}
      />

      {/* Slide-Free Speech Structure Analysis Card */}
      {(!plan || report.speechAnalysis) && (
        <section className="rounded-2xl border border-[#E8DCE0] bg-white p-5 sm:p-6 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8DCE0] pb-3.5">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#BE2257]">
                การวิเคราะห์เนื้อหาจากคำพูดจริง
              </span>
              <h2 className="text-base sm:text-lg font-bold text-[#1F161A]">
                {report.speechAnalysis?.detectedTopic ||
                  report.topicTitle ||
                  'สรุปโครงสร้างคำพูด (โหมดไร้สไลด์)'}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {report.speechAnalysis && (
                <span className="rounded-lg bg-[#FCE8EE] px-2.5 py-1 text-xs font-bold text-[#BE2257] tabular-nums">
                  ความชัดเจนเนื้อหา {report.speechAnalysis.clarityScore}/100
                </span>
              )}
              <button
                type="button"
                disabled={speechAnalysisLoading}
                onClick={() => void generateSpeechAnalysis(report)}
                className="app-press inline-flex items-center gap-1.5 rounded-xl border border-[#D8C5CB] bg-[#FAF6F7] hover:bg-[#FCE8EE] px-3 py-1.5 text-xs font-semibold text-[#1F161A] disabled:opacity-50"
              >
                {speechAnalysisLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#EC3D6A]" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 text-[#EC3D6A]" />
                )}
                วิเคราะห์คำพูดใหม่
              </button>
            </div>
          </div>

          {speechAnalysisLoading && !report.speechAnalysis ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-[#EC3D6A]" />
              กำลังสรุปและประเมินโครงสร้างคำพูดของคุณ...
            </div>
          ) : report.speechAnalysis ? (
            <div className="space-y-4">
              <p className="text-sm text-slate-700 leading-relaxed">
                {report.speechAnalysis.structureSummaryTh}
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#E8DCE0] bg-[#FAF6F7] p-4 space-y-2">
                  <h3 className="text-xs font-bold text-[#1F161A]">
                    ประเด็นหลักที่ผู้ฟังจับใจความได้
                  </h3>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {report.speechAnalysis.keyTakeaways.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="font-mono text-[11px] font-bold text-[#EC3D6A] mt-0.5">
                          0{idx + 1}
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-[#E8DCE0] bg-[#FAF6F7] p-4 space-y-2">
                  <h3 className="text-xs font-bold text-[#BE2257]">
                    คำแนะนำเพื่อปรับปรุงบทพูด
                  </h3>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {report.speechAnalysis.improvementsTh.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#EC3D6A]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-xl border border-[#F2C4D0] bg-[#FCE8EE]/45 px-4 py-3 text-xs text-[#1F161A]">
                <span className="font-semibold text-[#BE2257]">
                  ตัวอย่างประโยคปิดท้ายที่คมขึ้น:{' '}
                </span>
                &ldquo;{report.speechAnalysis.suggestedClosingTh}&rdquo;
              </div>
            </div>
          ) : null}
        </section>
      )}

      {report.mode === 'team' && (
        <TeamBreakdown report={report as TeamSessionReport} />
      )}

      {/* Post-Presentation Judge Panel Simulation */}
      <section className="rounded-2xl border border-[#E8DCE0] border-l-4 border-l-[#EC3D6A] bg-white p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8DCE0] pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-[#1F161A] flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-[#EC3D6A]" />
                จำลองคณะกรรมการถาม-ตอบหลังนำเสนอเสร็จ
              </h2>
              {judgeSource && (
                <span
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                    judgeSource === 'gemini'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-[#FAF6F7] border-[#E8DCE0] text-slate-600'
                  }`}
                >
                  {judgeSource === 'gemini' ? 'ถามโดย Gemini AI' : 'ชุดคำถามมาตรฐาน'}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              กรรมการวิเคราะห์จากเนื้อหาสไลด์ คำพูดที่บันทึกได้ และจังหวะการนำเสนอของคุณ แล้วตั้งคำถามให้ฝึกตอบจริง
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setVoiceMode((m) => (m === 'gemini' ? 'browser' : 'gemini'))
              }
              title="สลับโหมดเสียงพูด (Gemini TTS เสียงธรรมชาติ ใช้ 1 คำขอ หรือเสียงเบราว์เซอร์)"
              className="app-press inline-flex items-center gap-1.5 rounded-xl border border-[#D8C5CB] bg-[#FAF6F7] hover:bg-[#FCE8EE] px-3 py-2 text-xs font-semibold text-[#1F161A]"
            >
              <Volume2 className="h-3.5 w-3.5 text-[#EC3D6A]" />
              {voiceMode === 'gemini' ? 'เสียง AI ธรรมชาติ' : 'เสียงเบราว์เซอร์'}
            </button>

            <button
              type="button"
              disabled={judgeLoading}
              onClick={() => void generateJudgeQuestions(report, plan)}
              className="app-press inline-flex items-center gap-1.5 rounded-xl bg-[#EC3D6A] hover:bg-[#E13C6C] px-3.5 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-50"
            >
              {judgeLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              ตั้งคำถามชุดใหม่จากกรรมการ (AI)
            </button>
          </div>
        </div>

        {aiNotice && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-800">
            {aiNotice}
          </div>
        )}

        {judgeLoading && (!report.audienceHistory || report.audienceHistory.length === 0) ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-[#EC3D6A]" />
            คณะกรรมการกำลังอ่านสไลด์และเตรียมคำถามให้คุณ...
          </div>
        ) : !report.audienceHistory || report.audienceHistory.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#D8C5CB] bg-[#FAF6F7] p-6 text-center text-xs text-slate-500">
            กดปุ่ม &ldquo;ตั้งคำถามชุดใหม่จากกรรมการ (AI)&rdquo; เพื่อเริ่มช่วงถาม-ตอบ
          </div>
        ) : (
          <div className="space-y-4">
            {report.audienceHistory.map((q, idx) => {
              const isListening = listeningId === q.id;
              const isEvaluating = evaluatingId === q.id;
              return (
                <div
                  key={q.id}
                  className="rounded-2xl border border-[#E8DCE0] bg-[#FAF6F7] p-4 sm:p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-[#FCE8EE] px-2.5 py-0.5 text-xs font-bold text-[#BE2257]">
                        ข้อที่ {idx + 1} • {AUDIENCE_PERSONAS[q.personaId]?.nameTh ?? 'กรรมการ'}
                      </span>
                      {q.categoryTh && (
                        <span className="rounded-md bg-white border border-[#E8DCE0] px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          {q.categoryTh}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => speakQuestion(q)}
                      className={`app-press inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                        speakingId === q.id
                          ? 'border-[#EC3D6A] bg-[#FCE8EE] text-[#C82D57]'
                          : 'border-[#D8C5CB] bg-white hover:bg-[#FCE8EE] text-[#1F161A]'
                      }`}
                    >
                      <Volume2 className="h-3.5 w-3.5 text-[#EC3D6A]" />
                      {speakingId === q.id ? 'กำลังอ่าน... (กดหยุด)' : 'ฟังเสียงคำถาม'}
                    </button>
                  </div>

                  <p className="text-sm sm:text-base font-semibold text-[#1F161A] leading-relaxed">
                    {q.text}
                  </p>

                  {(q.suggestedAnalogy || q.followUpTip) && (
                    <div className="grid gap-2 sm:grid-cols-2 text-xs">
                      {q.suggestedAnalogy && (
                        <div className="rounded-xl border border-[#E8DCE0] bg-white p-2.5 text-slate-700">
                          <span className="font-semibold text-[#BE2257]">แนวทางเปรียบเทียบ: </span>
                          {q.suggestedAnalogy}
                        </div>
                      )}
                      {q.followUpTip && (
                        <div className="rounded-xl border border-[#E8DCE0] bg-white p-2.5 text-slate-700">
                          <span className="font-semibold text-[#1F161A]">ทริคตอบกรรมการ: </span>
                          {q.followUpTip}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Interactive Answer & Evaluation */}
                  <div className="space-y-2 pt-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label
                        htmlFor={`answer-${q.id}`}
                        className="text-xs font-semibold text-slate-700"
                      >
                        ลองตอบคำถามนี้ด้วยเสียงหรือพิมพ์ข้อความ:
                      </label>
                      <button
                        type="button"
                        onClick={() => toggleVoiceAnswer(q.id)}
                        className={`app-press inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                          isListening
                            ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                            : 'bg-white text-[#1F161A] border-[#D8C5CB] hover:bg-[#FCE8EE]'
                        }`}
                      >
                        {isListening ? (
                          <>
                            <MicOff className="h-3.5 w-3.5" />
                            หยุดอัดเสียง
                          </>
                        ) : (
                          <>
                            <Mic className="h-3.5 w-3.5 text-[#EC3D6A]" />
                            พูดตอบด้วยไมค์
                          </>
                        )}
                      </button>
                    </div>

                    <textarea
                      id={`answer-${q.id}`}
                      rows={2}
                      value={draftAnswers[q.id] ?? ''}
                      onChange={(e) =>
                        setDraftAnswers((prev) => ({
                          ...prev,
                          [q.id]: e.target.value,
                        }))
                      }
                      placeholder="พิมพ์หรือพูดคำตอบของคุณที่นี่ เพื่อให้กรรมการประเมินคะแนนและช่วยเกลาคำพูด..."
                      className="w-full rounded-xl border border-[#D8C5CB] bg-white px-3 py-2 text-xs sm:text-sm text-[#1F161A] placeholder:text-slate-400 focus:outline-none focus:border-[#EC3D6A]"
                    />

                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={isEvaluating || !(draftAnswers[q.id] ?? '').trim()}
                        onClick={() => void submitAnswerForEvaluation(q)}
                        className="app-press inline-flex items-center gap-1.5 rounded-xl bg-[#EC3D6A] hover:bg-[#E13C6C] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm disabled:opacity-45"
                      >
                        {isEvaluating ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        ส่งคำตอบให้กรรมการประเมิน
                      </button>
                    </div>
                  </div>

                  {q.evaluationScore !== undefined && (
                    <div className="rounded-xl border border-emerald-200 bg-white p-3.5 space-y-1.5 text-xs">
                      <div className="flex items-center gap-2 font-bold text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        คะแนนการตอบคำถาม: {q.evaluationScore} / 100
                      </div>
                      {q.evaluationFeedbackTh && (
                        <p className="text-slate-700 leading-relaxed">
                          <span className="font-semibold text-[#1F161A]">ความเห็นกรรมการ: </span>
                          {q.evaluationFeedbackTh}
                        </p>
                      )}
                      {q.improvedAnswerTh && (
                        <p className="text-[#1F161A] leading-relaxed bg-[#FAF6F7] rounded-lg border border-[#E8DCE0] p-2.5">
                          <span className="font-semibold text-[#BE2257]">
                            ตัวอย่างคำตอบที่กระชับขึ้น:{' '}
                          </span>
                          &ldquo;{q.improvedAnswerTh}&rdquo;
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <TimelineChart
        timeline={report.telemetryTimeline}
        fillers={report.fillers}
        hapticCues={report.hapticCues}
      />

      <div className="rounded-2xl border border-[#E8DCE0] bg-white p-5 space-y-3 shadow-sm">
        <h3 className="text-base font-bold text-[#1F161A]">
          บันทึกคำพูด (Transcript)
        </h3>
        {report.transcriptSegments.length === 0 ? (
          <p className="text-xs text-slate-500">
            ไม่มีข้อความถอดเสียงในเซสชันนี้ (แนะนำใช้ Google Chrome เพื่อเปิดใช้งาน Thai Web Speech)
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {report.transcriptSegments.map((seg, idx) => (
              <div
                key={idx}
                className="rounded-xl bg-[#FAF6F7] border border-[#E8DCE0] p-3 text-xs"
              >
                <span className="text-[#EC3D6A] font-semibold">
                  [{Math.round(seg.startMs / 1000)}s • {seg.speakerId}]
                </span>{' '}
                <span className="text-slate-700">{seg.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
