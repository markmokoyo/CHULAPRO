'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  KeyRound,
  Loader2,
  PlugZap,
  RefreshCw,
  Settings,
  Sliders,
  Trash2,
} from 'lucide-react';
import type {
  AiConnectionCheckResult,
  AiQuotaSnapshot,
} from '@/services/geminiQuota';
import {
  clearAllPlans,
  clearAllSessionReports,
  getAiRequestHeaders,
  getAppPreferences,
  getSavedGeminiApiKey,
  saveAppPreferences,
  saveGeminiApiKey,
  type AppPreferences,
} from '@/services/storage';
import { clearAllSessionVideos } from '@/services/videoStorage';
import { emitQuotaUpdated } from '@/components/AiQuotaBadge';

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 py-3 text-left"
    >
      <span className="text-sm font-medium text-[#2B2135]">{label}</span>
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-[#EC3D6A]' : 'bg-slate-200'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<AppPreferences | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [quota, setQuota] = useState<AiQuotaSnapshot | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<AiConnectionCheckResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/ai-status', {
        headers: getAiRequestHeaders(),
      });
      if (res.ok) {
        const snapshot = (await res.json()) as AiQuotaSnapshot;
        setQuota(snapshot);
        emitQuotaUpdated(snapshot);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    setPrefs(getAppPreferences());
    setApiKeyInput(getSavedGeminiApiKey());
    void fetchStatus();
  }, [fetchStatus]);

  const updatePref = (patch: Partial<AppPreferences>) => {
    const next = saveAppPreferences(patch);
    setPrefs(next);
  };

  const testConnection = async () => {
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
        messageTh: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้',
      });
    } finally {
      setChecking(false);
    }
  };

  const handleSaveKey = async () => {
    saveGeminiApiKey(apiKeyInput);
    await fetchStatus();
    await testConnection();
  };

  const showTempNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const rpmPct = quota
    ? Math.min(100, Math.round((quota.rpmUsed / quota.rpmLimit) * 100))
    : 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Header */}
      <div className="animate-fade-up flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FCE8EE] text-[#EC3D6A]">
          <Settings className="h-5 w-5" />
        </span>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-[#2B2135]">
          ตั้งค่าแอป
        </h1>
      </div>

      {notice && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          {notice}
        </div>
      )}

      {/* Group 1: Default Studio Settings */}
      {prefs && (
        <section className="animate-fade-up rounded-3xl border border-[#E8DCE0] bg-white p-5 sm:p-6 shadow-sm space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-[#E8DCE0]">
            <Sliders className="h-4 w-4 text-[#EC3D6A]" />
            <h2 className="font-display text-sm font-bold text-[#2B2135]">
              ค่าเริ่มต้นห้องซ้อม
            </h2>
          </div>

          <div className="divide-y divide-[#F5EEF0]">
            <ToggleRow
              label="บันทึกวิดีโอย้อนหลังอัตโนมัติ"
              checked={prefs.recordVideo}
              onChange={(v) => updatePref({ recordVideo: v })}
            />
            <ToggleRow
              label="แสดงเส้นโครงท่าทาง AI บนกล้อง"
              checked={prefs.showOverlay}
              onChange={(v) => updatePref({ showOverlay: v })}
            />
            <ToggleRow
              label="เปิดสั่นเตือนสมาร์ทวอทช์ (พักเตือน 20 วิ)"
              checked={prefs.liveAlerts}
              onChange={(v) => updatePref({ liveAlerts: v })}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="text-sm font-medium text-[#2B2135]">
                เสียงอ่านคำถามกรรมการ
              </span>
              <div className="inline-flex rounded-xl border border-[#E8DCE0] bg-[#F5EEF0] p-1 text-xs">
                {(
                  [
                    { id: 'gemini', label: 'เสียง AI ชัด' },
                    { id: 'browser', label: 'เสียงเบราว์เซอร์' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updatePref({ voiceMode: opt.id })}
                    className={`rounded-lg px-3 py-1 font-semibold transition ${
                      prefs.voiceMode === opt.id
                        ? 'bg-white text-[#1F161A] shadow-sm'
                        : 'text-slate-500'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span className="text-sm font-medium text-[#2B2135]">
                เวลาซ้อมสไลด์เริ่มต้น
              </span>
              <div className="inline-flex rounded-xl border border-[#E8DCE0] bg-[#F5EEF0] p-1 text-xs">
                {[3, 5, 10].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => updatePref({ defaultDurationMinutes: m })}
                    className={`rounded-lg px-3 py-1 font-semibold tabular-nums transition ${
                      prefs.defaultDurationMinutes === m
                        ? 'bg-white text-[#1F161A] shadow-sm'
                        : 'text-slate-500'
                    }`}
                  >
                    {m} นาที
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Group 2: Gemini AI & Quota */}
      <section className="animate-fade-up stagger-1 rounded-3xl border border-[#E8DCE0] bg-white p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#E8DCE0]">
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-[#EC3D6A]" />
            <h2 className="font-display text-sm font-bold text-[#2B2135]">
              การเชื่อมต่อ Gemini AI
            </h2>
          </div>
          <button
            type="button"
            onClick={() => void fetchStatus()}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-[#FCE8EE] hover:text-[#EC3D6A]"
            title="รีเฟรช"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <KeyRound className="h-3.5 w-3.5 text-[#EC3D6A]" />
            Gemini API Key (บันทึกเฉพาะในเครื่องคุณ)
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="AIzaSy..."
              className="flex-1 rounded-xl border border-[#D8C5CB] bg-[#FAF6F7] px-3 py-2 text-xs text-[#1F161A] focus:outline-none focus:border-[#EC3D6A]"
            />
            <button
              type="button"
              onClick={() => void handleSaveKey()}
              className="app-press rounded-xl bg-[#EC3D6A] hover:bg-[#E13C6C] px-4 py-2 text-xs font-bold text-white"
            >
              บันทึก & ทดสอบ
            </button>
            <button
              type="button"
              disabled={checking}
              onClick={() => void testConnection()}
              className="app-press inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#D8C5CB] bg-[#FAF6F7] hover:bg-[#FCE8EE] px-3.5 py-2 text-xs font-semibold text-[#1F161A] disabled:opacity-50"
            >
              {checking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#EC3D6A]" />
              ) : (
                <PlugZap className="h-3.5 w-3.5 text-[#EC3D6A]" />
              )}
              เช็กการเชื่อมต่อ
            </button>
          </div>
        </div>

        {checkResult && (
          <div
            className={`rounded-xl border px-3 py-2 text-xs font-medium ${
              checkResult.connected
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {checkResult.messageTh}
          </div>
        )}

        {quota && (
          <div className="space-y-2 rounded-2xl border border-[#E8DCE0] bg-[#FAF6F7] p-3.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">โมเดล: {quota.model}</span>
              <span className="font-semibold text-[#1F161A] tabular-nums">
                RPM {quota.rpmUsed}/{quota.rpmLimit} • RPD {quota.rpdUsed}/{quota.rpdLimit}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F5EEF0]">
              <div
                className="h-full rounded-full bg-[#EC3D6A] transition-all"
                style={{ width: `${rpmPct}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* Group 3: Local Data Management */}
      <section className="animate-fade-up stagger-2 rounded-3xl border border-[#E8DCE0] bg-white p-5 sm:p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-[#E8DCE0]">
          <Trash2 className="h-4 w-4 text-rose-500" />
          <h2 className="font-display text-sm font-bold text-[#2B2135]">
            จัดการข้อมูลในเครื่อง
          </h2>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => {
              clearAllPlans();
              showTempNotice('ล้างชุดสไลด์ที่บันทึกไว้แล้ว');
            }}
            className="app-press rounded-xl border border-[#E8DCE0] bg-[#FAF6F7] hover:bg-rose-50 hover:border-rose-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:text-rose-600 transition"
          >
            ล้างชุดสไลด์ทั้งหมด
          </button>

          <button
            type="button"
            onClick={() => {
              void clearAllSessionVideos().then(() =>
                showTempNotice('ล้างแคชวิดีโอย้อนหลังแล้ว')
              );
            }}
            className="app-press rounded-xl border border-[#E8DCE0] bg-[#FAF6F7] hover:bg-rose-50 hover:border-rose-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:text-rose-600 transition"
          >
            ล้างวิดีโอย้อนหลัง
          </button>

          <button
            type="button"
            onClick={() => {
              clearAllSessionReports();
              showTempNotice('ล้างประวัติคะแนนทั้งหมดแล้ว');
            }}
            className="app-press rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100 px-3 py-2.5 text-xs font-semibold text-rose-700 transition"
          >
            ล้างประวัติคะแนนทั้งหมด
          </button>
        </div>
      </section>
    </div>
  );
}
