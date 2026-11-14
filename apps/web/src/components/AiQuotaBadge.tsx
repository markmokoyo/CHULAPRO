'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Cpu,
  KeyRound,
  Loader2,
  PlugZap,
  RefreshCw,
} from 'lucide-react';
import type {
  AiConnectionCheckResult,
  AiQuotaSnapshot,
} from '@/services/geminiQuota';
import {
  getAiRequestHeaders,
  getSavedGeminiApiKey,
  saveGeminiApiKey,
} from '@/services/storage';

export function emitQuotaUpdated(quota?: AiQuotaSnapshot) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('cuepulse:ai-quota-updated', { detail: quota })
  );
}

export function AiQuotaBadge() {
  const [quota, setQuota] = useState<AiQuotaSnapshot | null>(null);
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<AiConnectionCheckResult | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');

  useEffect(() => {
    setApiKeyInput(getSavedGeminiApiKey());
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-status', {
        headers: getAiRequestHeaders(),
      });
      if (res.ok) {
        setQuota((await res.json()) as AiQuotaSnapshot);
      }
    } catch {
      // ignore network error
    }
  }, []);

  const testConnection = useCallback(async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/ai-status', {
        method: 'POST',
        headers: getAiRequestHeaders(),
      });
      if (res.ok) {
        setCheckResult((await res.json()) as AiConnectionCheckResult);
      }
    } catch {
      setCheckResult({
        connected: false,
        status: 'error',
        messageTh: 'ไม่สามารถติดต่อเซิร์ฟเวอร์เพื่อตรวจสอบได้',
      });
    } finally {
      setChecking(false);
    }
  }, []);

  const handleSaveKey = async () => {
    saveGeminiApiKey(apiKeyInput);
    await fetchStatus();
    await testConnection();
  };

  useEffect(() => {
    void fetchStatus();
    const handler = (e: Event) => {
      const custom = e as CustomEvent<AiQuotaSnapshot | undefined>;
      if (custom.detail) {
        setQuota(custom.detail);
      } else {
        void fetchStatus();
      }
    };
    window.addEventListener('cuepulse:ai-quota-updated', handler);
    return () => window.removeEventListener('cuepulse:ai-quota-updated', handler);
  }, [fetchStatus]);

  const statusColor = !quota?.configured
    ? 'bg-amber-400'
    : quota.rateLimited
    ? 'bg-rose-400'
    : 'bg-emerald-400';

  const label = !quota
    ? 'AI ...'
    : !quota.configured
    ? 'AI Offline'
    : quota.rateLimited
    ? `Limit (${quota.retryAfterSec}s)`
    : `Gemini ${quota.rpmUsed}/${quota.rpmLimit}`;

  const rpmPct = quota
    ? Math.min(100, Math.round((quota.rpmUsed / quota.rpmLimit) * 100))
    : 0;
  const rphPct = quota
    ? Math.min(100, Math.round((quota.rphUsed / quota.rphLimit) * 100))
    : 0;
  const rpdPct = quota
    ? Math.min(100, Math.round((quota.rpdUsed / quota.rpdLimit) * 100))
    : 0;
  const rpwPct = quota
    ? Math.min(100, Math.round((quota.rpwUsed / quota.rpwLimit) * 100))
    : 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          void fetchStatus();
        }}
        className="flex items-center gap-1.5 rounded-xl border border-[#FF9EB8] bg-white hover:bg-[#FFE0EA] px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition"
        title="ดูสถานะและลิมิตการใช้งาน Gemini API"
      >
        <span className={`h-2 w-2 rounded-full ${statusColor}`} />
        <Cpu className="h-3.5 w-3.5 text-[#EC3D6A]" />
        <span className="hidden md:inline">{label}</span>
      </button>

      {open && quota && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl border border-[#FF9EB8] bg-white p-4 shadow-xl shadow-[#FB6F92]/15 z-50 space-y-3 text-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-900">
                สถานะโควตา Gemini API
              </p>
              <p className="text-[11px] text-slate-500">
                Model: {quota.model}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void fetchStatus()}
              className="rounded-lg p-1 text-slate-400 hover:bg-[#FFE0EA] hover:text-[#EC3D6A]"
              title="รีเฟรชสถานะ"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          {!quota.configured ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-800 leading-relaxed">
              ยังไม่ได้ตั้งค่า <code className="font-semibold text-amber-900">GEMINI_API_KEY</code>{' '}
              ใน <code className="font-semibold text-amber-900">apps/web/.env.local</code>{' '}
              ระบบกำลังใช้ Smart Offline Fallback
            </div>
          ) : quota.rateLimited ? (
            <div className="flex items-start gap-1.5 rounded-xl border border-rose-300 bg-rose-50 p-2.5 text-[11px] text-rose-700">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-500" />
              <span>{quota.lastError}</span>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-700 font-medium">
              เชื่อมต่อ Gemini Key พร้อมใช้งาน
            </div>
          )}

          <div className="space-y-2.5 text-xs">
            <div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-slate-500">ความถี่ต่อนาที (RPM)</span>
                <span className="font-semibold text-slate-900">
                  {quota.rpmUsed} / {quota.rpmLimit}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#FFD1DF]">
                <div
                  className={`h-full transition-all ${
                    rpmPct >= 80 ? 'bg-rose-500' : 'bg-[#EC3D6A]'
                  }`}
                  style={{ width: `${rpmPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-slate-500">รายชั่วโมง (1 ชม.)</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {quota.rphUsed} / {quota.rphLimit.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#FFD1DF]">
                <div
                  className="h-full bg-[#FB6F92] transition-all"
                  style={{ width: `${rphPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-slate-500">รายวัน (RPD)</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {quota.rpdUsed} / {quota.rpdLimit.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#FFD1DF]">
                <div
                  className="h-full bg-[#CC6B92] transition-all"
                  style={{ width: `${rpdPct}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-[11px]">
                <span className="text-slate-500">รายสัปดาห์ (7 วัน)</span>
                <span className="font-semibold text-slate-900 tabular-nums">
                  {quota.rpwUsed} / {quota.rpwLimit.toLocaleString()}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#FFD1DF]">
                <div
                  className="h-full bg-[#9D4B70] transition-all"
                  style={{ width: `${rpwPct}%` }}
                />
              </div>
            </div>

            <div className="space-y-1 border-t border-[#F2C4D0] pt-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Tokens วันนี้ / 7 วัน</span>
                <span className="font-semibold text-[#BE2257] tabular-nums">
                  {quota.tokensToday.toLocaleString()} / {quota.tokensThisWeek.toLocaleString()}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-snug">
                Gemini API จำกัดจริงที่ RPM/RPD • ยอดรายชม. และ 7 วันนับสะสมในแอป
              </p>
            </div>

            <div className="border-t border-[#F2C4D0] pt-2.5 space-y-2">
              <div className="space-y-1.5">
                <label className="flex items-center gap-1 text-[11px] font-medium text-slate-700">
                  <KeyRound className="h-3 w-3 text-[#EC3D6A]" />
                  ใส่ Gemini API Key (ใช้งานได้ทันที)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="AIza..."
                    className="min-w-0 flex-1 rounded-lg border border-[#FF9EB8] bg-[#FFEFF4] px-2.5 py-1 text-[11px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#EC3D6A]"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSaveKey()}
                    className="rounded-lg bg-[#EC3D6A] hover:bg-[#E13C6C] px-2.5 py-1 text-[11px] font-bold text-white transition"
                  >
                    บันทึก
                  </button>
                </div>
              </div>

              <button
                type="button"
                disabled={checking}
                onClick={() => void testConnection()}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-[#FFE0EA] hover:bg-[#FFD1DF] border border-[#FF8FAB] px-3 py-1.5 text-[11px] font-semibold text-[#BE2257] transition disabled:opacity-50"
              >
                {checking ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#EC3D6A]" />
                ) : (
                  <PlugZap className="h-3.5 w-3.5 text-[#EC3D6A]" />
                )}
                {checking ? 'กำลังทดสอบ...' : 'ทดสอบเชื่อมต่อ API Key'}
              </button>

              {checkResult && (
                <div
                  className={`rounded-xl border p-2 text-[11px] leading-relaxed ${
                    checkResult.connected
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-rose-300 bg-rose-50 text-rose-800'
                  }`}
                >
                  <div className="flex items-start gap-1.5">
                    {checkResult.connected ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-600" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-600" />
                    )}
                    <div>
                      <p>{checkResult.messageTh}</p>
                      {checkResult.keyPreview && (
                        <p className="mt-0.5 text-[10px] opacity-80">
                          Key: {checkResult.keyPreview}
                          {checkResult.latencyMs !== undefined
                            ? ` • ${checkResult.latencyMs}ms`
                            : ''}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
