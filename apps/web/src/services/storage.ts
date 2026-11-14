import type { PresentationPlan, SessionReport, TeamSessionReport } from '@cuepulse/shared';

const PLANS_KEY = 'cuepulse_plans_v1';
const ACTIVE_PLAN_KEY = 'cuepulse_active_plan_id_v1';
const REPORTS_KEY = 'cuepulse_reports_v1';
const GEMINI_KEY_STORAGE = 'cuepulse_gemini_api_key_v1';

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
  localStorage.setItem(REPORTS_KEY, JSON.stringify(updated));
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
