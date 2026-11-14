import { NextResponse } from 'next/server';
import {
  buildAnswerEvaluationPrompt,
  buildAudienceSparringPrompt,
  buildJudgePanelPrompt,
  type AudienceMessage,
  type AudiencePersonaId,
} from '@cuepulse/shared';
import {
  generateGeminiJson,
  getAiQuotaSnapshot,
  recordGeminiError,
  recordGeminiSuccess,
  resolveGeminiApiKey,
} from '@/services/geminiQuota';

interface AudienceRequestBody {
  personaId?: AudiencePersonaId;
  mode: 'interruption' | 'qa_challenge' | 'judge_panel' | 'evaluate_answer';
  slideContext: string;
  recentTranscript?: string;
  metricsSummary?: string;
  formality?: string;
  questionTh?: string;
  userAnswer?: string;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AudienceRequestBody;
    const apiKey = resolveGeminiApiKey(request);
    const hasKey = Boolean(apiKey);
    const currentQuota = getAiQuotaSnapshot(hasKey);
    let aiErrorMessage: string | undefined;

    if (body.mode === 'judge_panel') {
      if (apiKey && !currentQuota.rateLimited) {
        try {
          const prompt = buildJudgePanelPrompt({
            slideContext: body.slideContext || 'การนำเสนอทั่วไป',
            transcriptText: body.recentTranscript || '',
            metricsSummary: body.metricsSummary || 'ยังไม่มีสถิติ',
            formality: body.formality,
          });

          const { data: parsed, totalTokens } = await generateGeminiJson<{
            questions?: Array<{
              personaId?: AudiencePersonaId;
              categoryTh?: string;
              questionTh?: string;
              suggestedAnalogy?: string;
              followUpTip?: string;
            }>;
          }>(apiKey, prompt);

          const updatedQuota = recordGeminiSuccess(totalTokens, true);
          const now = Date.now();
          const questions: AudienceMessage[] = (parsed.questions ?? [])
            .slice(0, 3)
            .map((q, idx) => ({
              id: `judge-${now}-${idx}`,
              role: 'audience',
              personaId:
                q.personaId && ['judge', 'advisor', 'inspirational'].includes(q.personaId)
                  ? q.personaId
                  : (['judge', 'advisor', 'inspirational'][idx] as AudiencePersonaId),
              categoryTh: q.categoryTh,
              text:
                q.questionTh ||
                'ช่วยอธิบายเพิ่มเติมถึงความแตกต่างและวิธีวัดผลของงานนี้ให้ชัดเจนขึ้นครับ',
              suggestedAnalogy: q.suggestedAnalogy,
              followUpTip: q.followUpTip,
              timestampMs: now + idx,
            }));

          if (questions.length > 0) {
            return NextResponse.json({
              questions,
              source: 'gemini',
              quota: updatedQuota,
            });
          }
        } catch (aiError) {
          console.warn('Gemini judge_panel fallback triggered:', aiError);
          const updatedQuota = recordGeminiError(aiError, true);
          aiErrorMessage =
            updatedQuota.lastError ||
            (aiError instanceof Error ? aiError.message : 'เรียกใช้ Gemini API ไม่สำเร็จ');
        }
      }

      return NextResponse.json({
        questions: buildFallbackJudgePanel(body),
        source: 'offline-fallback',
        aiError: aiErrorMessage,
        quota: getAiQuotaSnapshot(hasKey),
      });
    }

    if (body.mode === 'evaluate_answer') {
      const questionTh = body.questionTh || 'คำถามจากคณะกรรมการ';
      const userAnswer = (body.userAnswer || '').trim();

      if (!userAnswer) {
        return NextResponse.json(
          { error: 'กรุณาพิมพ์หรือพูดคำตอบก่อนส่งประเมิน' },
          { status: 400 }
        );
      }

      if (apiKey && !currentQuota.rateLimited) {
        try {
          const prompt = buildAnswerEvaluationPrompt({
            questionTh,
            userAnswer,
            slideContext: body.slideContext || '',
          });

          const { data: parsed, totalTokens } = await generateGeminiJson<{
            evaluationScore?: number;
            evaluationFeedbackTh?: string;
            improvedAnswerTh?: string;
          }>(apiKey, prompt);

          const updatedQuota = recordGeminiSuccess(totalTokens, true);
          return NextResponse.json({
            evaluationScore: Math.max(
              0,
              Math.min(100, Math.round(parsed.evaluationScore ?? 78))
            ),
            evaluationFeedbackTh:
              parsed.evaluationFeedbackTh ||
              'คำตอบสื่อสารประเด็นหลักได้ชัดเจนดี แนะนำให้เสริมตัวเลขหรือตัวอย่างจริงเพิ่มเติมครับ',
            improvedAnswerTh: parsed.improvedAnswerTh,
            source: 'gemini',
            quota: updatedQuota,
          });
        } catch (aiError) {
          console.warn('Gemini evaluate_answer fallback triggered:', aiError);
          const updatedQuota = recordGeminiError(aiError, true);
          aiErrorMessage =
            updatedQuota.lastError ||
            (aiError instanceof Error ? aiError.message : 'เรียกใช้ Gemini API ไม่สำเร็จ');
        }
      }

      return NextResponse.json({
        ...buildFallbackAnswerEvaluation(userAnswer),
        source: 'offline-fallback',
        aiError: aiErrorMessage,
        quota: getAiQuotaSnapshot(hasKey),
      });
    }

    // Standard single interruption / qa_challenge mode (used in live Practice Studio)
    const personaId: AudiencePersonaId = body.personaId ?? 'judge';
    if (apiKey && !currentQuota.rateLimited) {
      try {
        const prompt = buildAudienceSparringPrompt({
          personaId,
          mode: body.mode,
          slideContext: body.slideContext || 'การนำเสนอทั่วไป',
          recentTranscript: body.recentTranscript || '',
        });

        const { data: parsed, totalTokens } = await generateGeminiJson<{
          questionTh?: string;
          suggestedAnalogy?: string;
          followUpTip?: string;
        }>(apiKey, prompt);

        const updatedQuota = recordGeminiSuccess(totalTokens, true);

        return NextResponse.json({
          questionTh:
            parsed.questionTh ||
            'ช่วยขยายความจุดเด่นหลักของแนวคิดนี้ให้ชัดเจนขึ้นอีกนิดได้ไหมครับ?',
          suggestedAnalogy: parsed.suggestedAnalogy,
          followUpTip: parsed.followUpTip,
          source: 'gemini',
          quota: updatedQuota,
        });
      } catch (aiError) {
        console.warn('Gemini audience fallback triggered:', aiError);
        const updatedQuota = recordGeminiError(aiError, true);
        aiErrorMessage =
          updatedQuota.lastError ||
          (aiError instanceof Error ? aiError.message : 'เรียกใช้ Gemini API ไม่สำเร็จ');
      }
    }

    const fallbackResponses: Record<
      AudiencePersonaId,
      { questionTh: string; suggestedAnalogy: string; followUpTip: string }
    > = {
      judge: {
        questionTh:
          'ในเชิงเทคนิคและความคุ้มค่า จุดที่ทำให้งานนี้แตกต่างจากโซลูชันที่มีอยู่แล้วในตลาดคืออะไรครับ?',
        suggestedAnalogy:
          'ลองเปรียบเทียบเหมือน "เข็มทิศส่วนตัวบนข้อมือ" ที่เตือนเบาๆ เฉพาะเวลาหลงทาง แทนที่จะเปิดเสียง GPS ดังรบกวน',
        followUpTip: 'ตอบด้วยตัวเลขหรือข้อเปรียบเทียบที่จับต้องได้ภายใน 30 วินาที',
      },
      advisor: {
        questionTh:
          'สมมติฐานหลักในส่วนนี้มีข้อจำกัดอะไรบ้างครับ และเราจะวัดผลความแม่นยำอย่างไรให้เชื่อถือได้?',
        suggestedAnalogy:
          'อธิบายการตรวจสอบ 2 ชั้นเหมือนการคัดกรองน้ำ 2 ขั้นตอน เพื่อลดความผิดพลาดก่อนนำไปใช้งานจริง',
        followUpTip: 'อ้างอิงเกณฑ์วัดผลหรือกลุ่มตัวอย่างที่ชัดเจนจะช่วยเพิ่มความน่าเชื่อถือ',
      },
      inspirational: {
        questionTh:
          'ประเด็นนี้มีพลังมากเลยครับ! ถ้าอยากให้ผู้ฟังรู้สึกอินตั้งแต่ 15 วินาทีแรก ลองเล่าผ่านปัญหาจริงที่คนใกล้ตัวเจอดีไหมครับ?',
        suggestedAnalogy:
          'เริ่มด้วยภาพจำง่ายๆ เช่น "เคยไหมครับที่ซ้อมพูดคนเดียวคล่องมาก แต่พอขึ้นเวทีจริงกลับลืมบทเพราะตื่นเต้น"',
        followUpTip: 'เว้นจังหวะหยุดหายใจ 1 วินาทีหลังประโยคสำคัญเพื่อให้ผู้ฟังซึมซับ',
      },
    };

    return NextResponse.json({
      ...fallbackResponses[personaId],
      source: 'offline-fallback',
      aiError: aiErrorMessage,
      quota: getAiQuotaSnapshot(hasKey),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'ไม่สามารถสร้างคำถามผู้ฟังจำลองได้',
      },
      { status: 500 }
    );
  }
}

function buildFallbackJudgePanel(body: AudienceRequestBody): AudienceMessage[] {
  const now = Date.now();
  const topicLine =
    body.slideContext
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 6 && !l.startsWith('---'))
      ?.slice(0, 60) || 'โปรเจกต์นี้';

  return [
    {
      id: `judge-${now}-0`,
      role: 'audience',
      personaId: 'judge',
      categoryTh: 'ความเป็นไปได้และความคุ้มค่า',
      text: `จากส่วน "${topicLine}" หากนำไปใช้งานจริงกับกลุ่มผู้ใช้จำนวนมาก อะไรคือความท้าทายหลักและจุดต่างที่ทำให้งานนี้คุ้มค่ากว่าวิธีเดิมครับ?`,
      suggestedAnalogy:
        'ชูความประหยัดเวลา/ต้นทุนเป็นตัวเลขเปรียบเทียบก่อน-หลังใช้งานภายใน 1 ประโยคแรก',
      followUpTip: 'ตอบแบบโครงสร้าง 3 ส่วน: ปัญหาเดิม → วิธีแก้ของเรา → ตัวเลขผลลัพธ์',
      timestampMs: now,
    },
    {
      id: `judge-${now}-1`,
      role: 'audience',
      personaId: 'advisor',
      categoryTh: 'สมมติฐานและการวัดผล',
      text: `ในแง่ระเบียบวิธีและการประเมินผล เรามีเกณฑ์หรือตัวชี้วัดใดบ้างที่พิสูจน์ว่าแนวทางใน "${topicLine}" มีความแม่นยำและไม่มีอคติครับ?`,
      suggestedAnalogy:
        'อธิบายเกณฑ์วัดผลหลัก (Metric) พร้อมยกตัวอย่างข้อจำกัดที่ทีมทราบและเตรียมแผนรองรับไว้แล้ว',
      followUpTip: 'อย่ากลัวที่จะยอมรับข้อจำกัด แต่ให้ปิดท้ายด้วยวิธีแก้ไขที่วางแผนไว้',
      timestampMs: now + 1,
    },
    {
      id: `judge-${now}-2`,
      role: 'audience',
      personaId: 'inspirational',
      categoryTh: 'คุณค่าต่อผู้ใช้งานจริง',
      text: 'ถ้ามีเวลาบอกเล่าเพียง 20 วินาทีให้ผู้ฟังจำได้ขึ้นใจ ชีวิตของผู้ใช้กลุ่มเป้าหมายจะดีขึ้นอย่างไรหลังจากใช้นวัตกรรมนี้ครับ?',
      suggestedAnalogy:
        'เล่าเป็นภาพจำของคนจริง 1 สถานการณ์ เช่น "จากเดิมต้องใช้เวลา X ชั่วโมง ตอนนี้เหลือแค่ Y นาที"',
      followUpTip: 'สบตากรรมการและเน้นน้ำเสียงที่ประโยคผลลัพธ์สุดท้าย',
      timestampMs: now + 2,
    },
  ];
}

function buildFallbackAnswerEvaluation(answer: string): {
  evaluationScore: number;
  evaluationFeedbackTh: string;
  improvedAnswerTh: string;
} {
  const words = answer.trim().split(/\s+/).length;
  const hasConcreteNumbers = /\d|%/.test(answer);
  const score = Math.min(
    88,
    58 + Math.min(20, Math.round(words * 1.2)) + (hasConcreteNumbers ? 10 : 0)
  );

  return {
    evaluationScore: score,
    evaluationFeedbackTh:
      words < 12
        ? 'คำตอบยังสั้นเกินไปครับ กรรมการอาจอยากได้เหตุผลหรือตัวอย่างประกอบเพิ่มเติม (ใส่ Gemini API Key ด้านบนเพื่อให้ AI ประเมินเนื้อหาเชิงลึก)'
        : hasConcreteNumbers
          ? 'โครงสร้างคำตอบดีและมีการอ้างอิงตัวเลขชัดเจน ควรสรุปประเด็นหลักไว้ในประโยคแรกสุดเพื่อให้กรรมการจับใจความได้ทันทีครับ'
          : 'ตอบได้ตรงแนวทางแล้วครับ แนะนำให้เสริมตัวเลขสถิติ หรือกรณีศึกษาที่วัดผลได้จริงเพื่อเพิ่มน้ำหนักให้คำตอบ',
    improvedAnswerTh:
      'ประเด็นหลักคือเราแก้ปัญหาด้วยการ [ระบุกลไกหลัก] ซึ่งช่วยลดขั้นตอนเดิมลงได้ [ระบุตัวเลข/ผลลัพธ์] โดยทีมได้ทดสอบเบื้องต้นและมีแผนขยายผลในระยะถัดไปครับ',
  };
}
