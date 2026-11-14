import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import {
  getAiQuotaSnapshot,
  MODEL_CANDIDATES,
  resolveGeminiApiKey,
  type AiConnectionCheckResult,
} from '@/services/geminiQuota';

function maskApiKey(key: string): string {
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export async function GET(request: Request) {
  const apiKey = resolveGeminiApiKey(request);
  return NextResponse.json(getAiQuotaSnapshot(Boolean(apiKey)));
}

export async function POST(request: Request) {
  const apiKey = resolveGeminiApiKey(request);

  if (!apiKey) {
    const res: AiConnectionCheckResult = {
      connected: false,
      status: 'missing_key',
      messageTh: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน apps/web/.env.local',
    };
    return NextResponse.json(res);
  }

  const startedAt = Date.now();
  try {
    const ai = new GoogleGenAI({ apiKey });
    let workingModel: string | null = null;
    let lastModelErr: unknown = null;

    for (const model of MODEL_CANDIDATES) {
      try {
        await ai.models.get({ model });
        workingModel = model;
        break;
      } catch (err) {
        lastModelErr = err;
        const lowerMsg = (err instanceof Error ? err.message : String(err)).toLowerCase();
        // If key itself is invalid or rate-limited, stop immediately
        if (
          lowerMsg.includes('api_key_invalid') ||
          lowerMsg.includes('401') ||
          lowerMsg.includes('403') ||
          lowerMsg.includes('429') ||
          lowerMsg.includes('quota')
        ) {
          throw err;
        }
      }
    }

    if (!workingModel) {
      throw lastModelErr ?? new Error('ไม่พบรุ่นโมเดล Gemini ที่คีย์นี้เข้าถึงได้');
    }

    const res: AiConnectionCheckResult = {
      connected: true,
      status: 'connected',
      messageTh: `เชื่อมต่อ Gemini API สำเร็จ! (ใช้รุ่น ${workingModel})`,
      keyPreview: maskApiKey(apiKey),
      latencyMs: Date.now() - startedAt,
    };
    return NextResponse.json(res);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();

    if (lower.includes('429') || lower.includes('quota') || lower.includes('resource_exhausted')) {
      const res: AiConnectionCheckResult = {
        connected: true,
        status: 'rate_limited',
        messageTh: 'คีย์ถูกต้อง แต่ขณะนี้ติดลิมิตการใช้งานชั่วคราว (429)',
        keyPreview: maskApiKey(apiKey),
        latencyMs: Date.now() - startedAt,
      };
      return NextResponse.json(res);
    }

    if (lower.includes('400') || lower.includes('401') || lower.includes('403') || lower.includes('api_key_invalid') || lower.includes('invalid')) {
      const res: AiConnectionCheckResult = {
        connected: false,
        status: 'invalid_key',
        messageTh: 'API Key ไม่ถูกต้อง หรือไม่มีสิทธิ์เข้าถึง Gemini API',
        keyPreview: maskApiKey(apiKey),
        latencyMs: Date.now() - startedAt,
      };
      return NextResponse.json(res);
    }

    const res: AiConnectionCheckResult = {
      connected: false,
      status: 'error',
      messageTh: `เชื่อมต่อไม่สำเร็จ: ${msg.slice(0, 100)}`,
      keyPreview: maskApiKey(apiKey),
      latencyMs: Date.now() - startedAt,
    };
    return NextResponse.json(res);
  }
}
