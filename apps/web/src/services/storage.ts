import type { PresentationPlan, SessionReport, TeamSessionReport } from '@cuepulse/shared';

const PLANS_KEY = 'cuepulse_plans_v1';
const ACTIVE_PLAN_KEY = 'cuepulse_active_plan_id_v1';
const REPORTS_KEY = 'cuepulse_reports_v1';
const GEMINI_KEY_STORAGE = 'cuepulse_gemini_api_key_v1';
const PREFERENCES_KEY = 'cuepulse_preferences_v1';

export interface AppPreferences {
  recordVideo: boolean;
  showOverlay: boolean;
  liveAlerts: boolean;
  voiceMode: 'gemini' | 'browser';
  defaultDurationMinutes: number;
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  recordVideo: true,
  showOverlay: true,
  liveAlerts: true,
  voiceMode: 'gemini',
  defaultDurationMinutes: 5,
};

export type AnySessionReport = SessionReport | TeamSessionReport;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function getSavedGeminiApiKey(): string {
  if (!isBrowser()) return '';
  return localStorage.getItem(GEMINI_KEY_STORAGE)?.trim() ?? '';
}

export function saveGeminiApiKey(key: string): void {
  if (!isBrowser()) return;
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem(GEMINI_KEY_STORAGE, trimmed);
  } else {
    localStorage.removeItem(GEMINI_KEY_STORAGE);
  }
}

export function getAiRequestHeaders(): Record<string, string> {
  const key = getSavedGeminiApiKey();
  return key ? { 'x-gemini-api-key': key } : {};
}

export function savePlan(plan: PresentationPlan): void {
  if (!isBrowser()) return;
  const existing = listPlans().filter((p) => p.id !== plan.id);
  const updated = [plan, ...existing].slice(0, 12);
  try {
    localStorage.setItem(PLANS_KEY, JSON.stringify(updated));
    localStorage.setItem(ACTIVE_PLAN_KEY, plan.id);
  } catch {
    // If QuotaExceededError happens due to base64 slide images on older plans, strip images from older plans first
    const trimmedOld = updated.map((p, idx) =>
      idx === 0
        ? p
        : {
            ...p,
            slides: p.slides.map((s) => ({ ...s, imageDataUrl: undefined })),
          }
    );
    try {
      localStorage.setItem(PLANS_KEY, JSON.stringify(trimmedOld.slice(0, 6)));
      localStorage.setItem(ACTIVE_PLAN_KEY, plan.id);
    } catch {
      const barePlan: PresentationPlan = {
        ...plan,
        slides: plan.slides.map((s) => ({ ...s, imageDataUrl: undefined })),
      };
      localStorage.setItem(PLANS_KEY, JSON.stringify([barePlan]));
      localStorage.setItem(ACTIVE_PLAN_KEY, plan.id);
    }
  }
}

export function listPlans(): PresentationPlan[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(PLANS_KEY);
    return raw ? (JSON.parse(raw) as PresentationPlan[]) : [];
  } catch {
    return [];
  }
}

export function getActivePlan(): PresentationPlan | null {
  if (!isBrowser()) return null;
  const plans = listPlans();
  if (plans.length === 0) return null;
  const activeId = localStorage.getItem(ACTIVE_PLAN_KEY);
  return plans.find((p) => p.id === activeId) ?? plans[0];
}

export function setActivePlanId(planId: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(ACTIVE_PLAN_KEY, planId);
}

export function saveSessionReport(report: AnySessionReport): void {
  if (!isBrowser()) return;
  const existing = listSessionReports().filter(
    (r) => r.sessionId !== report.sessionId
  );
  const updated = [report, ...existing].slice(0, 50);
  try {
    localStorage.setItem(REPORTS_KEY, JSON.stringify(updated));
  } catch {
    // If QuotaExceededError occurs due to long telemetry timelines, downsample older reports
    const compacted = updated.map((r, idx) =>
      idx === 0
        ? r
        : {
            ...r,
            telemetryTimeline: r.telemetryTimeline.filter((_, i) => i % 4 === 0),
          }
    );
    try {
      localStorage.setItem(REPORTS_KEY, JSON.stringify(compacted.slice(0, 25)));
    } catch {
      localStorage.setItem(REPORTS_KEY, JSON.stringify([report]));
    }
  }
}

export function patchSessionReport(
  sessionId: string,
  patcher: (current: AnySessionReport) => AnySessionReport
): AnySessionReport | null {
  if (!isBrowser()) return null;
  const current = getSessionReportById(sessionId);
  if (!current) return null;
  const updated = patcher(current);
  saveSessionReport(updated);
  return updated;
}

export function listSessionReports(): AnySessionReport[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    return raw ? (JSON.parse(raw) as AnySessionReport[]) : [];
  } catch {
    return [];
  }
}

export function getSessionReportById(sessionId: string): AnySessionReport | null {
  if (!isBrowser()) return null;
  return listSessionReports().find((r) => r.sessionId === sessionId) ?? null;
}

export function deleteSessionReport(sessionId: string): void {
  if (!isBrowser()) return;
  const remaining = listSessionReports().filter((r) => r.sessionId !== sessionId);
  localStorage.setItem(REPORTS_KEY, JSON.stringify(remaining));
}

export function clearAllSessionReports(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(REPORTS_KEY);
}

export function clearAllPlans(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(PLANS_KEY);
  localStorage.removeItem(ACTIVE_PLAN_KEY);
}

export function getAppPreferences(): AppPreferences {
  if (!isBrowser()) return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    return {
      recordVideo: parsed.recordVideo ?? DEFAULT_PREFERENCES.recordVideo,
      showOverlay: parsed.showOverlay ?? DEFAULT_PREFERENCES.showOverlay,
      liveAlerts: parsed.liveAlerts ?? DEFAULT_PREFERENCES.liveAlerts,
      voiceMode: parsed.voiceMode === 'browser' ? 'browser' : 'gemini',
      defaultDurationMinutes:
        typeof parsed.defaultDurationMinutes === 'number' &&
        parsed.defaultDurationMinutes >= 1 &&
        parsed.defaultDurationMinutes <= 60
          ? parsed.defaultDurationMinutes
          : DEFAULT_PREFERENCES.defaultDurationMinutes,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveAppPreferences(patch: Partial<AppPreferences>): AppPreferences {
  const next = { ...getAppPreferences(), ...patch };
  if (isBrowser()) {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
  }
  return next;
}
