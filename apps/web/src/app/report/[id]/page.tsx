'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  Edit3,
  FileText,
  Loader2,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';
import {
  calculateFluencyScore,
  calculateOverallScore,
  calculatePacingScore,
  detectLexicalFillers,
  scoreToStars,
  type AudienceMessage,
  type PresentationPlan,
  type SpeechContentAnalysis,
  type StarEvaluationFeedback,
  type TeamSessionReport,
} from '@cuepulse/shared';
import {
  getAiRequestHeaders,
  getSessionReportById,
  listPlans,
  saveSessionReport,
  type AnySessionReport,
} from '@/services/storage';
import { extractVideoPayloadForAi, getSessionVideo } from '@/services/videoStorage';
import { emitQuotaUpdated } from '@/components/AiQuotaBadge';
import type { AiQuotaSnapshot } from '@/services/geminiQuota';
import { ScoreOverview } from '@/components/report/ScoreOverview';
import { TimelineChart } from '@/components/report/TimelineChart';
import { TeamBreakdown } from '@/components/report/TeamBreakdown';
import { SessionVideoPlayer } from '@/components/report/SessionVideoPlayer';
import { PostPresentationQADrawer } from '@/components/report/PostPresentationQADrawer';
import { speakQuestionNatural, stopSpeaking } from '@/services/voicePlayer';

type ReportTab = 'overview' | 'replay' | 'team';

export default function ReportDetailPage() {
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<AnySessionReport | null>(null);
  const [plan, setPlan] = useState<PresentationPlan | null>(null);
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [qaDrawerOpen, setQaDrawerOpen] = useState(false);

  const [judgeLoading, setJudgeLoading] = useState(false);
  const [speechAnalysisLoading, setSpeechAnalysisLoading] = useState(false);
  const [starEvalLoading, setStarEvalLoading] = useState(false);
  const [judgeSource, setJudgeSource] = useState<string | null>(null);
  const [aiNotice, setAiNotice] = useState<string | null>(null);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [voiceMode, setVoiceMode] = useState<'gemini' | 'browser'>('gemini');

  const [isEditingTranscript, setIsEditingTranscript] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState('');

  const lastLoadedIdRef = useRef<string | null>(null);
  const autoRequestedRef = useRef(false);
  const autoSpeechRequestedRef = useRef(false);
  const autoStarEvalRequestedRef = useRef(false);

  useEffect(() => {
    return () => {
      stopSpeaking();
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

  const generateStarEvaluation = useCallback(async (rep: AnySessionReport) => {
    setStarEvalLoading(true);
    try {
      const videoBlob = await getSessionVideo(rep.sessionId);
      const videoPayload = videoBlob ? await extractVideoPayloadForAi(videoBlob) : {};

      const transcriptText = rep.transcriptSegments.map((t) => t.text).join(' ');
      const fillerWords = Array.from(new Set(rep.fillers.map((f) => f.word))).slice(0, 6);
      const postureIssues: string[] = [];
      if (rep.telemetryTimeline.some((t) => t.isSlouching)) postureIssues.push('ไหล่ห่อ/หลังค่อม');
      if (rep.telemetryTimeline.some((t) => t.isArmsCrossed)) postureIssues.push('กอดอก');
      if (rep.telemetryTimeline.some((t) => t.isSwaying)) postureIssues.push('โยกตัวไปมา');

      const stars = {
        overall: scoreToStars(rep.overallScore),
        fluency: scoreToStars(calculateFluencyScore(rep.metrics.fillerPerMinute)),
        pacing: scoreToStars(calculatePacingScore(rep.metrics.averageSpm)),
        eye: scoreToStars(rep.metrics.eyeContactRatio),
        posture: scoreToStars(rep.metrics.goodPostureRatio),
      };

      const res = await fetch('/api/audience', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAiRequestHeaders(),
        },
        body: JSON.stringify({
          mode: 'video_star_evaluation',
          slideContext: rep.topicTitle || 'การซ้อมนำเสนอ',
          recentTranscript: transcriptText,
          durationSeconds: rep.durationSeconds,
          metrics: {
            overallScore: rep.overallScore,
            averageSpm: rep.metrics.averageSpm,
            fillerCount: rep.metrics.fillerCount,
            fillerPerMinute: rep.metrics.fillerPerMinute,
            eyeContactRatio: rep.metrics.eyeContactRatio,
            goodPostureRatio: rep.metrics.goodPostureRatio,
          },
          stars,
          fillerWordsSummary: fillerWords.join(', '),
          postureIssuesSummary: postureIssues.join(', '),
          ...videoPayload,
        }),
      });

      const data = (await res.json()) as {
        evaluation?: StarEvaluationFeedback;
        quota?: AiQuotaSnapshot;
      };
      emitQuotaUpdated(data.quota);

      if (data.evaluation) {
        setReport((curr) => {
          const base = curr ?? rep;
          const updated: AnySessionReport = {
            ...base,
            starEvaluation: data.evaluation,
          };
          saveSessionReport(updated);
          return updated;
        });
      }
    } catch {
      // Keep data-driven fallback if network fails
    } finally {
      setStarEvalLoading(false);
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
          setReport((curr) => {
            const base = curr ?? rep;
            const updated: AnySessionReport = {
              ...base,
              audienceHistory: data.questions,
            };
            saveSessionReport(updated);
            return updated;
          });
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
    if (lastLoadedIdRef.current !== params.id) {
      lastLoadedIdRef.current = params.id;
      autoRequestedRef.current = false;
      autoSpeechRequestedRef.current = false;
      autoStarEvalRequestedRef.current = false;
    }

    const found = getSessionReportById(params.id);
    if (!found) return;

    const plans = listPlans();
    const matchedPlan = found.planId
      ? (plans.find((p) => p.id === found.planId) ?? null)
      : null;

    setReport(found);
    setPlan(matchedPlan);
    setTranscriptDraft(found.transcriptSegments.map((s) => s.text).join('\n'));

    const existingAnswers: Record<string, string> = {};
    found.audienceHistory?.forEach((q) => {
      if (q.userAnswer) existingAnswers[q.id] = q.userAnswer;
    });
    setDraftAnswers(existingAnswers);

    if (!matchedPlan && !found.speechAnalysis && !autoSpeechRequestedRef.current) {
      autoSpeechRequestedRef.current = true;
      void generateSpeechAnalysis(found);
    }

    if (!found.starEvaluation && !autoStarEvalRequestedRef.current) {
      autoStarEvalRequestedRef.current = true;
      void generateStarEvaluation(found);
    }

    if (
      (!found.audienceHistory || found.audienceHistory.length === 0) &&
      !autoRequestedRef.current
    ) {
      autoRequestedRef.current = true;
      void generateJudgeQuestions(found, matchedPlan);
    }
  }, [params.id, generateJudgeQuestions, generateSpeechAnalysis, generateStarEvaluation]);

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

  const submitAnswerForEvaluation = async (
    question: AudienceMessage,
    overrideAnswer?: string
  ) => {
    if (!report) return;
    const answerText = (overrideAnswer ?? draftAnswers[question.id] ?? '').trim();
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

      setReport((curr) => {
        if (!curr) return curr;
        const updatedHistory = (curr.audienceHistory ?? []).map((item) =>
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
          ...curr,
          audienceHistory: updatedHistory,
        };
        saveSessionReport(updatedReport);
        return updatedReport;
      });
    } finally {
      setEvaluatingId(null);
    }
  };

  const saveEditedTranscript = () => {
    if (!report) return;
    const lines = transcriptDraft
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const totalMs = report.durationSeconds * 1000;
    const stepMs = lines.length > 0 ? Math.floor(totalMs / lines.length) : totalMs;

    const updatedSegments = lines.map((text, i) => ({
      speakerId: report.transcriptSegments[i]?.speakerId ?? (report.mode === 'team' ? 'm1' : 'solo'),
      text,
      startMs: report.transcriptSegments[i]?.startMs ?? i * stepMs,
      endMs: report.transcriptSegments[i]?.endMs ?? (i + 1) * stepMs,
    }));

    setReport((curr) => {
      const base = curr ?? report;
      const acousticFillers = base.fillers.filter((f) => f.layer === 'acoustic');
      const lexicalFillers = updatedSegments.flatMap((seg) =>
        detectLexicalFillers(seg.text, seg.endMs, 1, seg.speakerId)
      );
      const mergedFillers = [...acousticFillers, ...lexicalFillers].sort(
        (a, b) => a.timestampMs - b.timestampMs
      );
      const durationMin = Math.max(0.25, base.durationSeconds / 60);
      const fillerPerMinute = Number((mergedFillers.length / durationMin).toFixed(1));
      const updatedMetrics = {
        ...base.metrics,
        fillerCount: mergedFillers.length,
        fillerPerMinute,
      };
      const updatedOverall = calculateOverallScore({
        averageSpm: updatedMetrics.averageSpm,
        fillerPerMinute: updatedMetrics.fillerPerMinute,
        eyeContactRatio: updatedMetrics.eyeContactRatio,
        goodPostureRatio: updatedMetrics.goodPostureRatio,
      });

      const updatedReport: AnySessionReport = {
        ...base,
        transcriptSegments: updatedSegments,
        fillers: mergedFillers,
        metrics: updatedMetrics,
        overallScore: updatedOverall,
      };
      saveSessionReport(updatedReport);
      return updatedReport;
    });
    setIsEditingTranscript(false);
  };

  const qaSummary = useMemo(() => {
    const list = report?.audienceHistory ?? [];
    const answered = list.filter((q) => q.evaluationScore !== undefined);
    const avg =
      answered.length > 0
        ? Math.round(
            answered.reduce((s, q) => s + (q.evaluationScore ?? 0), 0) /
              answered.length
          )
        : null;
    return { total: list.length, answeredCount: answered.length, avg };
  }, [report?.audienceHistory]);

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
    <div
      className={`space-y-5 transition-all duration-300 ${
        qaDrawerOpen ? 'lg:pr-[440px]' : ''
      }`}
    >
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/"
            className="app-press inline-flex items-center gap-1.5 rounded-full border border-[#E8DCE0] bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-[#EC3D6A] hover:text-[#EC3D6A] shadow-sm mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            กลับหน้าหลัก
          </Link>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-[#2B2135]">
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

        <button
          type="button"
          onClick={() => setQaDrawerOpen((v) => !v)}
          className="app-press inline-flex items-center gap-2 rounded-xl border border-[#DDD6FE] bg-gradient-to-r from-[#FFF0F5] to-[#F5F3FF] hover:brightness-95 px-3.5 py-2 text-xs font-bold text-[#6D28D9] shadow-sm"
        >
          <MessageSquare className="h-4 w-4 text-[#EC3D6A]" />
          {qaDrawerOpen ? 'ซ่อนกล่องคำถามข้างจอ' : 'เปิดกล่องถาม-ตอบกรรมการ'}
          {qaSummary.avg !== null && (
            <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-[#047857] border border-[#A7F3D0] tabular-nums">
              Q&A {qaSummary.avg}
            </span>
          )}
        </button>
      </div>

      {/* Clean Sub-Tab Navigation to Prevent Clutter */}
      <div
        role="tablist"
        aria-label="หมวดหมู่รายงานผล"
        className="flex w-full sm:w-fit overflow-x-auto no-scrollbar gap-1.5 rounded-2xl border border-[#E8DCE0] bg-white/80 p-1.5 shadow-sm"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
          className={`app-press inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition ${
            activeTab === 'overview'
              ? 'bg-gradient-to-r from-[#EC3D6A] to-[#F472B6] text-white shadow-sm'
              : 'text-slate-600 hover:bg-[#FFF0F5] hover:text-[#EC3D6A]'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          ภาพรวม & วิเคราะห์เนื้อหา
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'replay'}
          onClick={() => setActiveTab('replay')}
          className={`app-press inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition ${
            activeTab === 'replay'
              ? 'bg-gradient-to-r from-[#0EA5E9] to-[#38BDF8] text-white shadow-sm'
              : 'text-slate-600 hover:bg-[#F0F9FF] hover:text-[#0284C7]'
          }`}
        >
          <Video className="h-3.5 w-3.5" />
          วิดีโอ & บันทึกคำพูด ({report.transcriptSegments.length})
        </button>

        {report.mode === 'team' && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'team'}
            onClick={() => setActiveTab('team')}
            className={`app-press inline-flex min-h-[42px] shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition ${
              activeTab === 'team'
                ? 'bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] text-white shadow-sm'
                : 'text-slate-600 hover:bg-[#F5F3FF] hover:text-[#7C3AED]'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            ผลวิเคราะห์รายบุคคล
          </button>
        )}
      </div>

      {/* Tab 1: Overview & Speech Content Analysis */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          <ScoreOverview
            report={report}
            starEvalLoading={starEvalLoading}
            onRegenerateStarEval={() => void generateStarEvaluation(report)}
          />

          {/* Speech Content Analysis Card */}
          {(!plan || report.speechAnalysis) && (
            <section className="rounded-2xl border border-[#BAE6FD] bg-white p-5 sm:p-6 space-y-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E0F2FE] pb-3.5">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0284C7]">
                    การวิเคราะห์เนื้อหาจากคำพูดจริง
                  </span>
                  <h2 className="text-base sm:text-lg font-bold text-[#2B2135]">
                    {report.speechAnalysis?.detectedTopic ||
                      report.topicTitle ||
                      'สรุปโครงสร้างคำพูด (โหมดไร้สไลด์)'}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  {report.speechAnalysis && (
                    <span className="rounded-lg bg-[#E0F2FE] px-2.5 py-1 text-xs font-bold text-[#0369A1] tabular-nums">
                      ความชัดเจนเนื้อหา {report.speechAnalysis.clarityScore}/100
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={speechAnalysisLoading}
                    onClick={() => void generateSpeechAnalysis(report)}
                    className="app-press inline-flex items-center gap-1.5 rounded-xl border border-[#BAE6FD] bg-[#F0F9FF] hover:bg-[#E0F2FE] px-3 py-1.5 text-xs font-semibold text-[#0369A1] disabled:opacity-50"
                  >
                    {speechAnalysisLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    วิเคราะห์คำพูดใหม่
                  </button>
                </div>
              </div>

              {speechAnalysisLoading && !report.speechAnalysis ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-[#0EA5E9]" />
                  กำลังสรุปและประเมินโครงสร้างคำพูดของคุณ...
                </div>
              ) : report.speechAnalysis ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {report.speechAnalysis.structureSummaryTh}
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5]/60 p-4 space-y-2">
                      <h3 className="text-xs font-bold text-[#047857]">
                        ประเด็นหลักที่ผู้ฟังจับใจความได้
                      </h3>
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {report.speechAnalysis.keyTakeaways.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="font-mono text-[11px] font-bold text-[#059669] mt-0.5">
                              0{idx + 1}
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB]/70 p-4 space-y-2">
                      <h3 className="text-xs font-bold text-[#B45309]">
                        คำแนะนำเพื่อปรับปรุงบทพูด
                      </h3>
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {report.speechAnalysis.improvementsTh.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#F59E0B]" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#DDD6FE] bg-[#F5F3FF]/60 px-4 py-3 text-xs text-[#2B2135]">
                    <span className="font-semibold text-[#6D28D9]">
                      ตัวอย่างประโยคปิดท้ายที่คมขึ้น:{' '}
                    </span>
                    &ldquo;{report.speechAnalysis.suggestedClosingTh}&rdquo;
                  </div>
                </div>
              ) : null}
            </section>
          )}
        </div>
      )}

      {/* Tab 2: Video Replay, Timeline & Editable Transcript */}
      {activeTab === 'replay' && (
        <div className="space-y-5">
          <SessionVideoPlayer
            sessionId={report.sessionId}
            hapticCues={report.hapticCues}
            fillers={report.fillers}
          />

          <TimelineChart
            timeline={report.telemetryTimeline}
            fillers={report.fillers}
            hapticCues={report.hapticCues}
          />

          <div className="rounded-2xl border border-[#E8DCE0] bg-white p-5 space-y-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-[#2B2135] flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#0EA5E9]" />
                บันทึกคำพูด (Transcript)
              </h3>
              <button
                type="button"
                onClick={() => {
                  if (isEditingTranscript) {
                    saveEditedTranscript();
                  } else {
                    setTranscriptDraft(
                      report.transcriptSegments.map((s) => s.text).join('\n')
                    );
                    setIsEditingTranscript(true);
                  }
                }}
                className={`app-press inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                  isEditingTranscript
                    ? 'border-[#A7F3D0] bg-[#ECFDF5] text-[#047857]'
                    : 'border-[#BAE6FD] bg-[#F0F9FF] text-[#0369A1]'
                }`}
              >
                {isEditingTranscript ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    บันทึกข้อความที่แก้ไข
                  </>
                ) : (
                  <>
                    <Edit3 className="h-3.5 w-3.5" />
                    แก้ไขข้อความถอดเสียง
                  </>
                )}
              </button>
            </div>

            {isEditingTranscript ? (
              <textarea
                rows={6}
                value={transcriptDraft}
                onChange={(e) => setTranscriptDraft(e.target.value)}
                placeholder="พิมพ์หรือแก้ไขข้อความถอดเสียงให้ถูกต้องมากขึ้น (1 บรรทัดต่อ 1 ช่วงพูด)..."
                className="w-full rounded-xl border border-[#BAE6FD] bg-[#F0F9FF]/40 p-3 text-xs sm:text-sm text-[#2B2135] focus:outline-none focus:border-[#0EA5E9]"
              />
            ) : report.transcriptSegments.length === 0 ? (
              <p className="text-xs text-slate-500">
                ไม่มีข้อความถอดเสียงในเซสชันนี้ (แนะนำใช้ Google Chrome เพื่อเปิดใช้งาน Thai Web Speech หรือกดปุ่ม &ldquo;แก้ไขข้อความถอดเสียง&rdquo; เพื่อพิมพ์เพิ่ม)
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {report.transcriptSegments.map((seg, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl bg-[#FDF8FA] border border-[#E8DCE0] p-3 text-xs"
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
      )}

      {/* Tab 3: Team Member Breakdown */}
      {activeTab === 'team' && report.mode === 'team' && (
        <TeamBreakdown report={report as TeamSessionReport} />
      )}

      {/* Pop-Out Floating Side Q&A Drawer */}
      <PostPresentationQADrawer
        open={qaDrawerOpen}
        onOpenChange={setQaDrawerOpen}
        questions={report.audienceHistory ?? []}
        judgeLoading={judgeLoading}
        judgeSource={judgeSource}
        aiNotice={aiNotice}
        voiceMode={voiceMode}
        onToggleVoiceMode={() =>
          setVoiceMode((m) => (m === 'gemini' ? 'browser' : 'gemini'))
        }
        speakingId={speakingId}
        onSpeakQuestion={speakQuestion}
        onRegenerateQuestions={() => void generateJudgeQuestions(report, plan)}
        draftAnswers={draftAnswers}
        onChangeDraftAnswer={(id, value) =>
          setDraftAnswers((prev) => ({ ...prev, [id]: value }))
        }
        evaluatingId={evaluatingId}
        onSubmitAnswer={(q, overrideAnswer) =>
          void submitAnswerForEvaluation(q, overrideAnswer)
        }
        hotwords={plan?.technicalHotwords ?? []}
      />
    </div>
  );
}
