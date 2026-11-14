import { NextResponse } from 'next/server';
import {
  buildSlidePlannerPrompt,
  type FormalityLevel,
  type PresentationPlan,
  type SlideItem,
} from '@cuepulse/shared';
import {
  generateGeminiJson,
  getAiQuotaSnapshot,
  recordGeminiError,
  recordGeminiSuccess,
  resolveGeminiApiKey,
} from '@/services/geminiQuota';

interface PlanRequestSlide {
  slideNumber: number;
  extractedText: string;
  wordCount?: number;
  estimatedSyllables?: number;
}

interface PlanRequestBody {
  fileName: string;
  totalDurationSeconds: number;
  formality: FormalityLevel;
  slides: PlanRequestSlide[];
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PlanRequestBody;
    if (!body.slides || body.slides.length === 0) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลสไลด์สำหรับวางแผน' },
        { status: 400 }
      );
    }

    const totalDuration = Math.max(60, Number(body.totalDurationSeconds) || 300);
    const apiKey = resolveGeminiApiKey(request);
    const hasKey = Boolean(apiKey);
    const currentQuota = getAiQuotaSnapshot(hasKey);
    let aiErrorMessage: string | undefined;

    if (apiKey && !currentQuota.rateLimited) {
      try {
        const prompt = buildSlidePlannerPrompt({
          fileName: body.fileName,
          totalDurationSeconds: totalDuration,
          formality: body.formality,
          slides: body.slides,
        });

        const { data: parsed, totalTokens } = await generateGeminiJson<{
          executiveSummary?: string;
          openingHook?: string;
          closingStatement?: string;
          technicalHotwords?: string[];
          slides?: Partial<SlideItem>[];
        }>(apiKey, prompt);

        const updatedQuota = recordGeminiSuccess(totalTokens, true);
        const normalizedSlides = normalizeSlides(
          body.slides,
          parsed.slides ?? [],
          totalDuration
        );

        const plan: PresentationPlan = {
          id: `plan-${Date.now()}`,
          fileName: body.fileName,
          totalDurationSeconds: totalDuration,
          formality: body.formality,
          executiveSummary: parsed.executiveSummary,
          openingHook:
            parsed.openingHook ||
            'สวัสดีครับ/ค่ะ วันนี้เราจะพาทุกท่านมาดูแนวคิดสำคัญและทางออกของปัญหาที่น่าสนใจครับ',
          closingStatement: parsed.closingStatement,
          technicalHotwords: (parsed.technicalHotwords ?? []).slice(0, 30),
          slides: normalizedSlides,
          createdAt: new Date().toISOString(),
        };

        return NextResponse.json({
          plan,
          source: 'gemini',
          quota: updatedQuota,
        });
      } catch (aiError) {
        console.warn('Gemini plan fallback triggered:', aiError);
        const updatedQuota = recordGeminiError(aiError, true);
        aiErrorMessage =
          updatedQuota.lastError ||
          (aiError instanceof Error ? aiError.message : 'เรียกใช้ Gemini API ไม่สำเร็จ');
      }
    }

    // Smart Offline Fallback when GEMINI_API_KEY is not set or errors
    const fallbackPlan = buildOfflineFallbackPlan(body, totalDuration);
    return NextResponse.json({
      plan: fallbackPlan,
      source: 'offline-fallback',
      aiError: aiErrorMessage,
      quota: getAiQuotaSnapshot(hasKey),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'ไม่สามารถสร้างแผนการนำเสนอได้',
      },
      { status: 500 }
    );
  }
}

function estimateWordCount(text: string): number {
  const clean = text.trim();
  if (!clean) return 0;
  const thaiChars = (clean.match(/[\u0E00-\u0E7F]/g) ?? []).length;
  const nonThai = clean
    .replace(/[\u0E00-\u0E7F]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(thaiChars / 4.2) + nonThai);
}

function normalizeSlides(
  sourceSlides: PlanRequestSlide[],
  aiSlides: Partial<SlideItem>[],
  totalDuration: number
): SlideItem[] {
  const merged: SlideItem[] = sourceSlides.map((src, idx) => {
    const ai =
      aiSlides.find((s) => s.slideNumber === src.slideNumber) ?? aiSlides[idx];
    const wordCount = src.wordCount ?? estimateWordCount(src.extractedText);
    const estimatedSyllables =
      src.estimatedSyllables ?? Math.max(wordCount, Math.round(wordCount * 1.65));

    const lines = src.extractedText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    return {
      slideNumber: src.slideNumber,
      title: ai?.title || lines[0]?.slice(0, 60) || `สไลด์ที่ ${src.slideNumber}`,
      extractedText: src.extractedText,
      wordCount,
      estimatedSyllables,
      allocatedSeconds: Math.max(
        15,
        Math.round(ai?.allocatedSeconds ?? totalDuration / sourceSlides.length)
      ),
      keyPoints:
        ai?.keyPoints && ai.keyPoints.length > 0
          ? ai.keyPoints
          : lines.slice(0, 3).length > 0
            ? lines.slice(0, 3)
            : [`ประเด็นหลักหน้า ${src.slideNumber}`],
      speakingGuide: ai?.speakingGuide,
      likelyJudgeQuestion: ai?.likelyJudgeQuestion,
      transitionPhrase:
        ai?.transitionPhrase ||
        (idx < sourceSlides.length - 1
          ? `จากจุดนี้ เรามาดูต่อในสไลด์ถัดไปกันครับ`
          : `และนี่คือบทสรุปทั้งหมดของการนำเสนอวันนี้ครับ`),
      emphasisCues: ai?.emphasisCues ?? [],
      densityWarning:
        ai?.densityWarning ??
        (wordCount > 110
          ? 'สไลด์นี้มีข้อความค่อนข้างแน่น แนะนำให้พูดสรุปเป็นหัวข้อแทนการอ่านตามสไลด์'
          : undefined),
    };
  });

  // Adjust allocatedSeconds so sum === totalDuration
  const currentSum = merged.reduce((acc, s) => acc + s.allocatedSeconds, 0);
  const diff = totalDuration - currentSum;
  if (diff !== 0 && merged.length > 0) {
    merged[merged.length - 1].allocatedSeconds = Math.max(
      10,
      merged[merged.length - 1].allocatedSeconds + diff
    );
  }
  return merged;
}

function buildOfflineFallbackPlan(
  body: PlanRequestBody,
  totalDuration: number
): PresentationPlan {
  const hotwordSet = new Set<string>();
  const weights = body.slides.map((s) => {
    const englishWords = s.extractedText.match(/\b[A-Za-z][A-Za-z0-9-]{2,}\b/g);
    englishWords?.forEach((w) => hotwordSet.add(w));
    const wc = s.wordCount ?? estimateWordCount(s.extractedText);
    const syl = s.estimatedSyllables ?? Math.round(wc * 1.65);
    return Math.max(15, syl);
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0) || 1;

  const minPerSlide = Math.max(
    5,
    Math.min(15, Math.floor(totalDuration / body.slides.length))
  );
  let remaining = totalDuration;
  const slideTitles: string[] = [];

  const slides: SlideItem[] = body.slides.map((src, idx) => {
    const isLast = idx === body.slides.length - 1;
    const slidesLeft = body.slides.length - idx - 1;
    const maxForThis = Math.max(minPerSlide, remaining - slidesLeft * minPerSlide);
    const ideal = Math.round((weights[idx] / totalWeight) * totalDuration);
    const allocated = isLast
      ? Math.max(minPerSlide, remaining)
      : Math.min(maxForThis, Math.max(minPerSlide, ideal));
    remaining -= allocated;

    const wordCount = src.wordCount ?? estimateWordCount(src.extractedText);
    const estimatedSyllables =
      src.estimatedSyllables ?? Math.max(wordCount, Math.round(wordCount * 1.65));

    const lines = src.extractedText
      .split(/\r?\n/)
      .map((t) => t.replace(/^[-•*]\s*/, '').trim())
      .filter((t) => t.length > 2 && !t.startsWith('[โน้ตผู้พูด]:'));

    const fallbackSentences =
      lines.length > 1
        ? lines.slice(1)
        : src.extractedText
            .split(/[.!?]/)
            .map((t) => t.trim())
            .filter((t) => t.length > 4);

    const title = lines[0]?.slice(0, 65) || `สไลด์ที่ ${src.slideNumber}`;
    slideTitles.push(title);

    const localHotwords = Array.from(
      new Set(src.extractedText.match(/\b[A-Za-z][A-Za-z0-9-]{2,}\b/g) ?? [])
    ).slice(0, 3);

    return {
      slideNumber: src.slideNumber,
      title,
      extractedText: src.extractedText,
      wordCount,
      estimatedSyllables,
      allocatedSeconds: allocated,
      keyPoints:
        fallbackSentences.slice(0, 3).length > 0
          ? fallbackSentences.slice(0, 3).map((s) => s.slice(0, 120))
          : [`อธิบายประเด็นหลักเรื่อง ${title}`],
      speakingGuide:
        idx === 0
          ? 'เกริ่นนำให้เห็นภาพปัญหาและความสำคัญก่อนเข้าสู่รายละเอียด'
          : isLast
            ? 'สรุปผลลัพธ์หลัก 1-2 ประโยคและทิ้งท้ายให้ผู้ฟังจดจำ'
            : `อธิบายหัวข้อ "${title}" ภายใน ~${allocated} วินาที โดยเน้นประเด็นสำคัญไม่เกิน 3 จุด`,
      likelyJudgeQuestion: `จากข้อมูลในหน้า "${title}" มีหลักฐานหรือวิธีวัดผลอย่างไรให้มั่นใจว่าทำได้จริง?`,
      transitionPhrase: isLast
        ? 'ขอขอบคุณทุกท่านครับ/ค่ะ หากมีคำถามเพิ่มเติมยินดีแลกเปลี่ยนครับ'
        : `เชื่อมต่อไปยังประเด็นถัดไปในสไลด์ที่ ${src.slideNumber + 1} กันครับ`,
      emphasisCues:
        localHotwords.length > 0
          ? localHotwords
          : Array.from(hotwordSet).slice(0, 3),
      densityWarning:
        wordCount > 110
          ? 'ข้อความในสไลด์ค่อนข้างเยอะ แนะนำให้พูดสรุปเป็นหัวข้อแทนการอ่านตามสไลด์'
          : undefined,
    };
  });

  const topicSummary = slideTitles.slice(0, 3).join(' • ');

  return {
    id: `plan-${Date.now()}`,
    fileName: body.fileName,
    totalDurationSeconds: totalDuration,
    formality: body.formality,
    executiveSummary: `ชุดสไลด์ ${body.slides.length} หน้า ครอบคลุมประเด็นหลัก: ${topicSummary} (โหมดคำนวณอัตโนมัติ — ใส่ Gemini API Key เพื่อให้ AI วิเคราะห์เชิงลึกยิ่งขึ้น)`,
    openingHook: `สวัสดีครับ/ค่ะ วันนี้ขออนุญาตนำเสนอเรื่อง ${slideTitles[0] || body.fileName} เพื่อชี้ให้เห็นปัญหา แนวทางแก้ไข และผลลัพธ์ที่จับต้องได้ครับ`,
    closingStatement:
      'ทั้งหมดนี้คือภาพรวมและคุณค่าหลักของงานนำเสนอวันนี้ ขอบคุณทุกท่านและยินดีรับฟังข้อเสนอแนะจากคณะกรรมการครับ/ค่ะ',
    technicalHotwords: Array.from(hotwordSet).slice(0, 30),
    slides,
    createdAt: new Date().toISOString(),
  };
}
