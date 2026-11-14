import { GoogleGenAI } from '@google/genai';

export interface AiConnectionCheckResult {
  connected: boolean;
  status: 'connected' | 'missing_key' | 'invalid_key' | 'rate_limited' | 'error';
  messageTh: string;
  keyPreview?: string;
  latencyMs?: number;
}

export interface AiQuotaSnapshot {
  configured: boolean;
  model: string;
  rpmUsed: number;
  rpmLimit: number;
  rphUsed: number;
  rphLimit: number;
  rpdUsed: number;
  rpdLimit: number;
  rpwUsed: number;
  rpwLimit: number;
  tokensToday: number;
  tokensThisWeek: number;
  rateLimited: boolean;
  retryAfterSec: number;
  lastError?: string;
}

interface QuotaState {
  dayKey: string;
  minuteTimestamps: number[];
  hourTimestamps: number[];
  weekEvents: Array<{ ts: number; tokens: number }>;
  rpdUsed: number;
  tokensToday: number;
  rateLimitedUntilMs: number;
  lastError?: string;
}

const globalForQuota = globalThis as unknown as {
  __cuepulseGeminiQuota?: QuotaState;
};

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getState(): QuotaState {
  const today = getTodayKey();
  const prev = globalForQuota.__cuepulseGeminiQuota;
  if (!prev) {
    const initial: QuotaState = {
      dayKey: today,
      minuteTimestamps: [],
      hourTimestamps: [],
      weekEvents: [],
      rpdUsed: 0,
      tokensToday: 0,
      rateLimitedUntilMs: 0,
    };
    globalForQuota.__cuepulseGeminiQuota = initial;
    return initial;
  }
  if (prev.dayKey !== today) {
    prev.dayKey = today;
    prev.rpdUsed = 0;
    prev.tokensToday = 0;
    prev.rateLimitedUntilMs = 0;
    prev.lastError = undefined;
  }
  return prev;
}

export function resolveGeminiApiKey(request?: Request): string {
  const fromHeader = request?.headers.get('x-gemini-api-key')?.trim();
  if (fromHeader) return fromHeader;
  return (
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    ''
  );
}

export const MODEL_CANDIDATES = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
] as const;

export function getAiQuotaSnapshot(hasKeyOverride?: boolean): AiQuotaSnapshot {
  const state = getState();
  const now = Date.now();
  const weekCutoff = now - 7 * 86_400_000;
  state.minuteTimestamps = state.minuteTimestamps.filter((t) => now - t < 60_000);
  state.hourTimestamps = (state.hourTimestamps ?? []).filter(
    (t) => now - t < 3_600_000
  );
  state.weekEvents = (state.weekEvents ?? []).filter((e) => e.ts >= weekCutoff);

  const configured =
    hasKeyOverride !== undefined
      ? hasKeyOverride
      : Boolean(
          process.env.GEMINI_API_KEY?.trim() ||
            process.env.NEXT_PUBLIC_GEMINI_API_KEY?.trim() ||
            process.env.GOOGLE_API_KEY?.trim()
        );
  const rpmLimit = Number(process.env.GEMINI_RPM_LIMIT) || 15;
  const rpdLimit = Number(process.env.GEMINI_RPD_LIMIT) || 1500;
  const rphLimit =
    Number(process.env.GEMINI_RPH_LIMIT) || Math.min(rpmLimit * 60, rpdLimit);
  const rpwLimit = Number(process.env.GEMINI_RPW_LIMIT) || rpdLimit * 7;

  const retryAfterSec =
    state.rateLimitedUntilMs > now
      ? Math.ceil((state.rateLimitedUntilMs - now) / 1000)
      : 0;

  const tokensThisWeek = state.weekEvents.reduce((acc, e) => acc + e.tokens, 0);

  return {
    configured,
    model: 'gemini-3.5-flash-lite',
    rpmUsed: state.minuteTimestamps.length,
    rpmLimit,
    rphUsed: state.hourTimestamps.length,
    rphLimit,
    rpdUsed: state.rpdUsed,
    rpdLimit,
    rpwUsed: state.weekEvents.length,
    rpwLimit,
    tokensToday: state.tokensToday,
    tokensThisWeek,
    rateLimited: retryAfterSec > 0,
    retryAfterSec,
    lastError: state.lastError,
  };
}

export function recordGeminiSuccess(
  totalTokens: number = 0,
  hasKeyOverride: boolean = true
): AiQuotaSnapshot {
  const state = getState();
  const now = Date.now();
  const safeTokens = Math.max(0, totalTokens);
  state.minuteTimestamps.push(now);
  state.hourTimestamps.push(now);
  state.weekEvents.push({ ts: now, tokens: safeTokens });
  state.rpdUsed += 1;
  state.tokensToday += safeTokens;
  state.rateLimitedUntilMs = 0;
  state.lastError = undefined;
  return getAiQuotaSnapshot(hasKeyOverride);
}

export function recordGeminiError(
  error: unknown,
  hasKeyOverride: boolean = true
): AiQuotaSnapshot {
  const state = getState();
  const now = Date.now();
  state.minuteTimestamps.push(now);
  state.hourTimestamps.push(now);
  state.weekEvents.push({ ts: now, tokens: 0 });
  state.rpdUsed += 1;

  const message = error instanceof Error ? error.message : String(error);
  const isRateLimit =
    message.includes('429') ||
    message.toLowerCase().includes('quota') ||
    message.toLowerCase().includes('resource_exhausted') ||
    message.toLowerCase().includes('rate');

  if (isRateLimit) {
    state.rateLimitedUntilMs = now + 60_000;
    state.lastError =
      'เกินโควตาชั่วคราว (429 Rate Limit) — สลับใช้โหมดสำรองอัตโนมัติ 60 วินาที';
  } else {
    state.lastError = message.slice(0, 140);
  }
  return getAiQuotaSnapshot(hasKeyOverride);
}

export function extractJsonFromText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : trimmed).trim();

  const firstObj = candidate.indexOf('{');
  const lastObj = candidate.lastIndexOf('}');
  if (firstObj !== -1 && lastObj > firstObj) {
    return candidate.slice(firstObj, lastObj + 1);
  }
  return candidate;
}

export async function generateGeminiJson<T>(
  apiKey: string,
  prompt: string
): Promise<{ data: T; totalTokens: number; modelUsed: string }> {
  const ai = new GoogleGenAI({ apiKey });
  let lastErr: unknown;

  for (const model of MODEL_CANDIDATES) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });
      const jsonStr = extractJsonFromText(response.text ?? '');
      const parsed = JSON.parse(jsonStr) as T;
      return {
        data: parsed,
        totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
        modelUsed: model,
      };
    } catch (err) {
      lastErr = err;
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
      // Stop immediately on invalid API key or explicit 429 rate-limit
      if (
        msg.includes('api_key_invalid') ||
        msg.includes('401') ||
        msg.includes('403') ||
        msg.includes('429') ||
        msg.includes('quota')
      ) {
        throw err;
      }
    }
  }

  throw lastErr ?? new Error('Gemini JSON generation failed');
}
