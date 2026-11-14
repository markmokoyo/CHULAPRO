'use client';

import { useEffect, useState } from 'react';
import { Loader2, MessageSquarePlus, Volume2 } from 'lucide-react';
import {
  AUDIENCE_PERSONAS,
  type AudienceMessage,
  type AudiencePersonaId,
} from '@cuepulse/shared';
import { emitQuotaUpdated } from '@/components/AiQuotaBadge';
import type { AiQuotaSnapshot } from '@/services/geminiQuota';
import { getAiRequestHeaders } from '@/services/storage';
import { speakQuestionNatural, stopSpeaking } from '@/services/voicePlayer';

interface AudiencePanelProps {
  personaId: AudiencePersonaId;
  onChangePersona: (id: AudiencePersonaId) => void;
  slideContext: string;
  recentTranscript: string;
  messages: AudienceMessage[];
  onNewMessage: (msg: AudienceMessage) => void;
}

export function AudiencePanel({
  personaId,
  onChangePersona,
  slideContext,
  recentTranscript,
  messages,
  onNewMessage,
}: AudiencePanelProps) {
  const [loading, setLoading] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [voiceMode, setVoiceMode] = useState<'gemini' | 'browser'>('gemini');

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const speakThai = (text: string) => {
    if (!ttsEnabled) return;
    void speakQuestionNatural({
      text,
      personaId,
      preferGemini: voiceMode === 'gemini',
    });
  };

  const askAudience = async (mode: 'interruption' | 'qa_challenge') => {
    setLoading(true);
    try {
      const res = await fetch('/api/audience', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAiRequestHeaders(),
        },
        body: JSON.stringify({
          personaId,
          mode,
          slideContext,
          recentTranscript,
        }),
      });
      const data = (await res.json()) as {
        questionTh: string;
        suggestedAnalogy?: string;
        followUpTip?: string;
        quota?: AiQuotaSnapshot;
      };
      emitQuotaUpdated(data.quota);
      const msg: AudienceMessage = {
        id: `aud-${Date.now()}`,
        role: 'audience',
        personaId,
        text: data.questionTh,
        suggestedAnalogy: data.suggestedAnalogy,
        followUpTip: data.followUpTip,
        timestampMs: Date.now(),
      };
      onNewMessage(msg);
      speakThai(data.questionTh);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#E8DCE0] bg-white p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#1F161A]">
          ซ้อมตอบคำถามผู้ฟัง
        </h3>
        <div className="flex items-center gap-1.5">
          {ttsEnabled && (
            <button
              type="button"
              onClick={() =>
                setVoiceMode((m) => (m === 'gemini' ? 'browser' : 'gemini'))
              }
              title="สลับโหมดเสียงพูด (Gemini TTS เสียงธรรมชาติ ใช้ 1 คำขอ หรือเสียงเบราว์เซอร์)"
              className="rounded-lg border border-[#E8DCE0] bg-[#FAF6F7] hover:bg-[#FCE8EE] px-2 py-1 text-[11px] font-semibold text-[#1F161A]"
            >
              {voiceMode === 'gemini' ? 'เสียง AI ชัด' : 'เสียงเบราว์เซอร์'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setTtsEnabled((v) => {
                if (v) stopSpeaking();
                return !v;
              });
            }}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${
              ttsEnabled
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            <Volume2 className="h-3.5 w-3.5" />
            {ttsEnabled ? 'เสียงพูดเปิด' : 'เสียงพูดปิด'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
        {(Object.keys(AUDIENCE_PERSONAS) as AudiencePersonaId[]).map((id) => {
          const p = AUDIENCE_PERSONAS[id];
          const active = personaId === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChangePersona(id)}
              className={`rounded-xl border p-2 text-left transition ${
                active
                  ? 'border-[#EC3D6A] bg-[#FCE8EE] text-[#BE2257]'
                  : 'border-[#E8DCE0] bg-[#FAF6F7] text-slate-600 hover:bg-[#FCE8EE]/60'
              }`}
            >
              <div className="text-xs font-semibold leading-tight">
                {p.nameTh}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => askAudience('interruption')}
          className="app-press flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-[#EC3D6A] hover:bg-[#E13C6C] px-3 py-2 text-xs font-semibold text-white transition disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MessageSquarePlus className="h-3.5 w-3.5" />
          )}
          ถามแทรกระหว่างพูด
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => askAudience('qa_challenge')}
          className="app-press flex-1 rounded-xl border border-[#D8C5CB] bg-[#FAF6F7] hover:bg-[#FCE8EE] px-3 py-2 text-xs font-semibold text-[#1F161A] transition disabled:opacity-50"
        >
          จำลองช่วง Q&A ท้ายสไลด์
        </button>
      </div>

      {messages.length > 0 && (
        <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
          {messages.map((m) => (
            <div
              key={m.id}
              className="rounded-xl border border-[#E8DCE0] bg-[#FAF6F7] p-3 text-xs space-y-1.5"
            >
              <div className="font-semibold text-[#BE2257]">
                {AUDIENCE_PERSONAS[m.personaId].nameTh}:
              </div>
              <p className="text-slate-800 leading-relaxed">{m.text}</p>
              {m.suggestedAnalogy && (
                <p className="text-emerald-700">
                  <span className="font-semibold">ตัวอย่างคำเปรียบเทียบ:</span> {m.suggestedAnalogy}
                </p>
              )}
              {m.followUpTip && (
                <p className="text-slate-600">
                  <span className="font-semibold">ข้อแนะนำเพิ่มเติม:</span> {m.followUpTip}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
