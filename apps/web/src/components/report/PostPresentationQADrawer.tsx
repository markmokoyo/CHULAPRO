'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Mic,
  MicOff,
  PanelRightClose,
  RefreshCw,
  Send,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { AUDIENCE_PERSONAS, type AudienceMessage, type AudiencePersonaId } from '@cuepulse/shared';
import { ThaiSpeechRecognizer } from '@/engines/audio/speechRecognition';

interface PostPresentationQADrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questions: AudienceMessage[];
  judgeLoading: boolean;
  judgeSource: string | null;
  aiNotice: string | null;
  voiceMode: 'gemini' | 'browser';
  onToggleVoiceMode: () => void;
  speakingId: string | null;
  onSpeakQuestion: (q: AudienceMessage) => void;
  onRegenerateQuestions: () => void;
  draftAnswers: Record<string, string>;
  onChangeDraftAnswer: (questionId: string, value: string) => void;
  evaluatingId: string | null;
  onSubmitAnswer: (q: AudienceMessage, overrideAnswer?: string) => void;
  hotwords?: string[];
}

const PERSONA_THEME: Record<
  AudiencePersonaId,
  {
    pillActive: string;
    badge: string;
    cardBorder: string;
    accentText: string;
  }
> = {
  judge: {
    pillActive: 'bg-[#FEF3C7] border-[#F59E0B] text-[#B45309]',
    badge: 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]',
    cardBorder: 'border-[#FDE68A]',
    accentText: 'text-[#B45309]',
  },
  advisor: {
    pillActive: 'bg-[#E0F2FE] border-[#0EA5E9] text-[#0369A1]',
    badge: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]',
    cardBorder: 'border-[#BAE6FD]',
    accentText: 'text-[#0369A1]',
  },
  inspirational: {
    pillActive: 'bg-[#D1FAE5] border-[#10B981] text-[#047857]',
    badge: 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]',
    cardBorder: 'border-[#A7F3D0]',
    accentText: 'text-[#047857]',
  },
};

export function PostPresentationQADrawer({
  open,
  onOpenChange,
  questions,
  judgeLoading,
  judgeSource,
  aiNotice,
  voiceMode,
  onToggleVoiceMode,
  speakingId,
  onSpeakQuestion,
  onRegenerateQuestions,
  draftAnswers,
  onChangeDraftAnswer,
  evaluatingId,
  onSubmitAnswer,
  hotwords = [],
}: PostPresentationQADrawerProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [listeningId, setListeningId] = useState<string | null>(null);
  const [interimVoiceText, setInterimVoiceText] = useState('');
  const [micNotice, setMicNotice] = useState<string | null>(null);

  const recognizerRef = useRef<ThaiSpeechRecognizer | null>(null);
  const latestDraftsRef = useRef(draftAnswers);

  useEffect(() => {
    latestDraftsRef.current = draftAnswers;
  }, [draftAnswers]);

  useEffect(() => {
    if (selectedIdx >= questions.length && questions.length > 0) {
      setSelectedIdx(0);
    }
  }, [questions.length, selectedIdx]);

  useEffect(() => {
    return () => {
      recognizerRef.current?.stop();
    };
  }, []);

  const qaAnalytics = useMemo(() => {
    const answered = questions.filter((q) => q.evaluationScore !== undefined);
    const avgScore =
      answered.length > 0
        ? Math.round(
            answered.reduce((sum, q) => sum + (q.evaluationScore ?? 0), 0) /
              answered.length
          )
        : null;
    return {
      total: questions.length,
      answeredCount: answered.length,
      avgScore,
    };
  }, [questions]);

  const activeQuestion = questions[selectedIdx] ?? questions[0] ?? null;

  const stopMic = () => {
    recognizerRef.current?.stop();
    setListeningId(null);
    setInterimVoiceText('');
  };

  const toggleVoiceAnswer = (questionId: string) => {
    setMicNotice(null);
    if (listeningId === questionId) {
      stopMic();
      return;
    }

    const recognizer = new ThaiSpeechRecognizer();
    if (!recognizer.isSupported()) {
      setMicNotice('เบราว์เซอร์นี้ไม่รองรับการรับเสียงพูด กรุณาพิมพ์คำตอบในช่องข้อความแทนครับ');
      return;
    }

    recognizerRef.current?.stop();
    recognizerRef.current = recognizer;

    const started = recognizer.start({
      hotwords,
      onFinalTranscript: (text) => {
        const current = latestDraftsRef.current[questionId] ?? '';
        const merged = current.trim() ? `${current.trim()} ${text}` : text;
        latestDraftsRef.current = {
          ...latestDraftsRef.current,
          [questionId]: merged,
        };
        onChangeDraftAnswer(questionId, merged);
        setInterimVoiceText('');
      },
      onInterimTranscript: (text) => {
        setInterimVoiceText(text);
      },
      onError: () => {
        setListeningId(null);
        setInterimVoiceText('');
      },
      onStatusChange: (active) => {
        if (!active) {
          setListeningId((curr) => (curr === questionId ? null : curr));
        }
      },
    });

    if (started) {
      setListeningId(questionId);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="app-press fixed right-4 bottom-20 sm:bottom-6 z-40 inline-flex items-center gap-2.5 rounded-full border border-[#F9A8D4] bg-gradient-to-r from-[#EC3D6A] to-[#8B5CF6] px-4 py-3 text-xs sm:text-sm font-bold text-white shadow-xl shadow-[#EC3D6A]/25 hover:brightness-105"
      >
        <MessageSquare className="h-4 w-4" />
        <span>
          ถาม-ตอบกรรมการ ({qaAnalytics.answeredCount}/{qaAnalytics.total || 3})
        </span>
        {qaAnalytics.avgScore !== null && (
          <span className="rounded-full bg-white/25 px-2 py-0.5 text-[11px] tabular-nums">
            {qaAnalytics.avgScore} คะแนน
          </span>
        )}
      </button>
    );
  }

  const personaTheme = activeQuestion
    ? PERSONA_THEME[activeQuestion.personaId]
    : PERSONA_THEME.judge;

  return (
    <aside
      aria-label="กล่องถาม-ตอบหลังนำเสนอจบ"
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col border-l border-[#E8DCE0] bg-[#FDF8FA]/95 backdrop-blur-xl shadow-2xl"
    >
      {/* Drawer Header + Separated Q&A Analysis Strip */}
      <div className="border-b border-[#E8DCE0] bg-white/90 px-4 py-3.5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#EC3D6A] to-[#8B5CF6] text-white shadow-sm">
              <MessageSquare className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#2B2135] truncate">
                ถาม-ตอบหลังนำเสนอจบ (Q&A)
              </h2>
              <p className="text-[11px] text-slate-500 truncate">
                แยกวิเคราะห์การตอบคำถามจากคะแนนนำเสนอ
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopMic();
              onOpenChange(false);
            }}
            aria-label="พับกล่องคำถาม"
            className="app-press inline-flex items-center gap-1 rounded-xl border border-[#E8DCE0] bg-[#FAF6F7] hover:bg-[#FCE8EE] px-2.5 py-1.5 text-xs font-semibold text-slate-600"
          >
            <PanelRightClose className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">พับเก็บ</span>
            <X className="h-3.5 w-3.5 sm:hidden" />
          </button>
        </div>

        {/* Dedicated Q&A Analytics Card */}
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-[#DDD6FE] bg-gradient-to-r from-[#FFF0F5] via-[#F5F3FF] to-[#F0F9FF] p-2.5 text-center">
          <div>
            <div className="text-[10px] font-medium text-slate-500">คะแนน Q&A</div>
            <div className="text-base font-extrabold text-[#7C3AED] tabular-nums">
              {qaAnalytics.avgScore !== null ? `${qaAnalytics.avgScore}/100` : 'รอตอบ'}
            </div>
          </div>
          <div className="border-x border-[#E8DCE0]">
            <div className="text-[10px] font-medium text-slate-500">ตอบแล้ว</div>
            <div className="text-base font-extrabold text-[#EC3D6A] tabular-nums">
              {qaAnalytics.answeredCount}/{qaAnalytics.total || 0}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-medium text-slate-500">แหล่งคำถาม</div>
            <div className="text-[11px] font-bold text-[#0369A1] mt-1 truncate">
              {judgeSource === 'gemini' ? 'Gemini AI' : 'ชุดมาตรฐาน'}
            </div>
          </div>
        </div>

        {/* Controls: Voice Mode + Regenerate */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onToggleVoiceMode}
            className="app-press inline-flex items-center gap-1.5 rounded-lg border border-[#BAE6FD] bg-[#F0F9FF] hover:bg-[#E0F2FE] px-2.5 py-1.5 text-[11px] font-semibold text-[#0369A1]"
          >
            <Volume2 className="h-3.5 w-3.5" />
            {voiceMode === 'gemini' ? 'เสียง AI ธรรมชาติ' : 'เสียงเบราว์เซอร์'}
          </button>

          <button
            type="button"
            disabled={judgeLoading}
            onClick={() => {
              stopMic();
              onRegenerateQuestions();
            }}
            className="app-press inline-flex items-center gap-1.5 rounded-lg bg-[#EC3D6A] hover:bg-[#E13C6C] px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm disabled:opacity-50"
          >
            {judgeLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            สุ่มคำถามชุดใหม่
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {(aiNotice || micNotice) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {micNotice || aiNotice}
          </div>
        )}

        {judgeLoading && questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-xs text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-[#EC3D6A]" />
            <span>คณะกรรมการกำลังอ่านเนื้อหาและเตรียมคำถามให้คุณ...</span>
          </div>
        ) : questions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#D8C5CB] bg-white p-6 text-center text-xs text-slate-500 space-y-2">
            <p>ยังไม่มีคำถามจากคณะกรรมการ</p>
            <button
              type="button"
              onClick={onRegenerateQuestions}
              className="app-press inline-flex items-center gap-1.5 rounded-xl bg-[#EC3D6A] px-3.5 py-2 text-xs font-bold text-white"
            >
              <Sparkles className="h-3.5 w-3.5" />
              สร้างคำถามจำลอง
            </button>
          </div>
        ) : (
          <>
            {/* Question Selector Pills */}
            <div className="grid grid-cols-3 gap-1.5">
              {questions.map((q, idx) => {
                const active = idx === selectedIdx;
                const theme = PERSONA_THEME[q.personaId];
                const isDone = q.evaluationScore !== undefined;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      if (listeningId && listeningId !== q.id) stopMic();
                      setSelectedIdx(idx);
                    }}
                    className={`app-press rounded-xl border px-2 py-2 text-left transition ${
                      active
                        ? `${theme.pillActive} shadow-sm`
                        : 'border-[#E8DCE0] bg-white text-slate-600 hover:bg-[#FAF6F7]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span>ข้อที่ {idx + 1}</span>
                      {isDone && (
                        <span className="rounded bg-emerald-100 px-1 text-[10px] text-emerald-700 tabular-nums">
                          {q.evaluationScore}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-[10px] opacity-85">
                      {AUDIENCE_PERSONAS[q.personaId]?.nameTh ?? 'กรรมการ'}
                    </div>
                  </button>
                );
              })}
            </div>

            {activeQuestion && (
              <div
                className={`rounded-2xl border bg-white p-4 space-y-3.5 shadow-sm ${personaTheme.cardBorder}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${personaTheme.badge}`}
                    >
                      {AUDIENCE_PERSONAS[activeQuestion.personaId]?.nameTh ?? 'กรรมการ'}
                    </span>
                    {activeQuestion.categoryTh && (
                      <span className="rounded-md border border-[#E8DCE0] bg-[#FAF6F7] px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {activeQuestion.categoryTh}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onSpeakQuestion(activeQuestion)}
                    className={`app-press inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                      speakingId === activeQuestion.id
                        ? 'border-[#EC3D6A] bg-[#FCE8EE] text-[#BE2257]'
                        : 'border-[#BAE6FD] bg-[#F0F9FF] text-[#0369A1] hover:bg-[#E0F2FE]'
                    }`}
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    {speakingId === activeQuestion.id ? 'หยุดอ่าน' : 'ฟังคำถาม'}
                  </button>
                </div>

                <p className="text-sm font-semibold text-[#2B2135] leading-relaxed">
                  {activeQuestion.text}
                </p>

                {(activeQuestion.suggestedAnalogy || activeQuestion.followUpTip) && (
                  <div className="space-y-1.5 rounded-xl bg-[#FAF6F7] border border-[#E8DCE0] p-2.5 text-[11px] text-slate-600">
                    {activeQuestion.suggestedAnalogy && (
                      <p>
                        <span className={`font-semibold ${personaTheme.accentText}`}>
                          แนวทางเปรียบเทียบ:{' '}
                        </span>
                        {activeQuestion.suggestedAnalogy}
                      </p>
                    )}
                    {activeQuestion.followUpTip && (
                      <p>
                        <span className="font-semibold text-[#2B2135]">ทริคตอบ: </span>
                        {activeQuestion.followUpTip}
                      </p>
                    )}
                  </div>
                )}

                {/* Answer Input: Voice + Text */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <label
                      htmlFor={`drawer-answer-${activeQuestion.id}`}
                      className="text-xs font-semibold text-slate-700"
                    >
                      คำตอบของคุณ:
                    </label>
                    <button
                      type="button"
                      onClick={() => toggleVoiceAnswer(activeQuestion.id)}
                      className={`app-press inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold border ${
                        listeningId === activeQuestion.id
                          ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                          : 'bg-[#FFF0F5] text-[#BE2257] border-[#FBCFE8] hover:bg-[#FCE8EE]'
                      }`}
                    >
                      {listeningId === activeQuestion.id ? (
                        <>
                          <MicOff className="h-3.5 w-3.5" />
                          หยุดอัดเสียง
                        </>
                      ) : (
                        <>
                          <Mic className="h-3.5 w-3.5" />
                          พูดตอบด้วยไมค์
                        </>
                      )}
                    </button>
                  </div>

                  {listeningId === activeQuestion.id && interimVoiceText && (
                    <div className="rounded-lg border border-[#FBCFE8] bg-[#FFF0F5] px-2.5 py-1.5 text-[11px] text-[#BE2257]">
                      กำลังฟัง: {interimVoiceText}
                    </div>
                  )}

                  <textarea
                    id={`drawer-answer-${activeQuestion.id}`}
                    rows={3}
                    value={draftAnswers[activeQuestion.id] ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      latestDraftsRef.current = {
                        ...latestDraftsRef.current,
                        [activeQuestion.id]: val,
                      };
                      onChangeDraftAnswer(activeQuestion.id, val);
                    }}
                    placeholder="กดปุ่มพูดตอบด้วยไมค์ หรือพิมพ์คำตอบของคุณที่นี่..."
                    className="w-full rounded-xl border border-[#D8C5CB] bg-[#FDF8FA] px-3 py-2 text-xs sm:text-sm text-[#2B2135] placeholder:text-slate-400 focus:outline-none focus:border-[#EC3D6A]"
                  />

                  <button
                    type="button"
                    disabled={
                      evaluatingId === activeQuestion.id ||
                      (!(draftAnswers[activeQuestion.id] ?? '').trim() &&
                        !(listeningId === activeQuestion.id && interimVoiceText.trim()))
                    }
                    onClick={() => {
                      if (listeningId === activeQuestion.id) {
                        stopMic();
                      }
                      const finalAnswer =
                        latestDraftsRef.current[activeQuestion.id] ??
                        draftAnswers[activeQuestion.id] ??
                        '';
                      onSubmitAnswer(activeQuestion, finalAnswer);
                    }}
                    className="app-press w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#EC3D6A] to-[#8B5CF6] hover:brightness-105 px-4 py-2 text-xs font-bold text-white shadow-sm disabled:opacity-45"
                  >
                    {evaluatingId === activeQuestion.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    ส่งคำตอบให้กรรมการวิเคราะห์คะแนน
                  </button>
                </div>

                {/* Separated Q&A Evaluation Result */}
                {activeQuestion.evaluationScore !== undefined && (
                  <div className="rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] p-3.5 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-bold text-[#047857]">
                        <CheckCircle2 className="h-4 w-4" />
                        ผลวิเคราะห์คำตอบข้อนี้
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white border border-[#A7F3D0] px-2.5 py-0.5 text-xs font-extrabold text-[#047857] tabular-nums">
                        <Award className="h-3.5 w-3.5" />
                        {activeQuestion.evaluationScore} / 100
                      </span>
                    </div>
                    {activeQuestion.evaluationFeedbackTh && (
                      <p className="text-slate-700 leading-relaxed">
                        {activeQuestion.evaluationFeedbackTh}
                      </p>
                    )}
                    {activeQuestion.improvedAnswerTh && (
                      <div className="rounded-lg border border-[#A7F3D0] bg-white p-2.5 text-[#2B2135] leading-relaxed">
                        <span className="font-semibold text-[#7C3AED]">
                          ตัวอย่างคำตอบที่คมขึ้น:{' '}
                        </span>
                        &ldquo;{activeQuestion.improvedAnswerTh}&rdquo;
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
