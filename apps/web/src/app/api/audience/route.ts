import { NextResponse } from 'next/server';
import {
  buildAnswerEvaluationPrompt,
  buildAudienceSparringPrompt,
  buildJudgePanelPrompt,
  buildSpeechOnlyAnalysisPrompt,
  type AudienceMessage,
  type AudiencePersonaId,
  type SpeechContentAnalysis,
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
  mode:
    | 'interruption'
    | 'qa_challenge'
    | 'judge_panel'
    | 'evaluate_answer'
    | 'speech_analysis';
  slideContext: string;
  recentTranscript?: string;
  metricsSummary?: string;
  formality?: string;
  questionTh?: string;
  userAnswer?: string;
  topicTitle?: string;
  speakerScript?: string;
  durationSeconds?: number;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AudienceRequestBody;
    const apiKey = resolveGeminiApiKey(request);
    const hasKey = Boolean(apiKey);
    const currentQuota = getAiQuotaSnapshot(hasKey);
    let aiErrorMessage: string | undefined;

    if (body.mode === 'speech_analysis') {
      const transcriptText = (body.recentTranscript || '').trim();
      if (apiKey && !currentQuota.rateLimited && (transcriptText || body.speakerScript)) {
        try {
          const prompt = buildSpeechOnlyAnalysisPrompt({
            topicTitle: body.topicTitle,
            speakerScript: body.speakerScript,
            transcriptText:
              transcriptText || '(ไม่ได้บันทึกข้อความถอดเสียง — วิเคราะห์จากสคริปต์และหัวข้อเป็นหลัก)',
            metricsSummary: body.metricsSummary || 'ยังไม่มีสถิติ',
            durationSeconds: body.durationSeconds ?? 60,
          });

          const { data: parsed, totalTokens } = await generateGeminiJson<{
            detectedTopic?: string;
            clarityScore?: number;
            structureSummaryTh?: string;
            keyTakeaways?: string[];
            improvementsTh?: string[];
            suggestedClosingTh?: string;
          }>(apiKey, prompt);

          const updatedQuota = recordGeminiSuccess(totalTokens, true);
          const analysis: SpeechContentAnalysis = {
            detectedTopic:
              parsed.detectedTopic || body.topicTitle || 'การนำเสนอปากเปล่า (ไม่ใช้สไลด์)',
            clarityScore: Math.max(
              0,
              Math.min(100, Math.round(parsed.clarityScore ?? 78))
            ),
            structureSummaryTh:
              parsed.structureSummaryTh ||
              'ลำดับการสื่อสารโดยรวมเข้าใจง่าย แนะนำให้สรุปประเด็นสำคัญไว้ในช่วงต้นและช่วงท้ายเพิ่มเติม',
            keyTakeaways:
              parsed.keyTakeaways && parsed.keyTakeaways.length > 0
                ? parsed.keyTakeaways
                : ['สื่อสารแนวคิดหลักได้ตรงประเด็น'],
            improvementsTh:
              parsed.improvementsTh && parsed.improvementsTh.length > 0
                ? parsed.improvementsTh
                : ['เสริมตัวอย่างประกอบหรือตัวเลขจริงเพื่อเพิ่มน้ำหนักให้คำพูด'],
            suggestedClosingTh:
              parsed.suggestedClosingTh ||
              'ดังนั้น หากเรานำแนวทางนี้ไปปรับใช้จริง จะช่วยแก้ปัญหาได้อย่างชัดเจนและวัดผลได้ครับ/ค่ะ',
            source: 'gemini',
          };

          return NextResponse.json({
            analysis,
            source: 'gemini',
            quota: updatedQuota,
          });
        } catch (aiError) {
          console.warn('Gemini speech_analysis fallback triggered:', aiError);
          const updatedQuota = recordGeminiError(aiError, true);
          aiErrorMessage =
            updatedQuota.lastError ||
            (aiError instanceof Error ? aiError.message : 'เรียกใช้ Gemini API ไม่สำเร็จ');
        }
      }

      return NextResponse.json({
        analysis: buildFallbackSpeechAnalysis(body),
        source: 'offline-fallback',
        aiError: aiErrorMessage,
        quota: getAiQuotaSnapshot(hasKey),
      });
    }

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

function buildFallbackSpeechAnalysis(
  body: AudienceRequestBody
): SpeechContentAnalysis {
  const transcript = (body.recentTranscript || '').trim();
  const script = (body.speakerScript || '').trim();
  const textToInspect = transcript || script;
  const charCount = textToInspect.length;
  const hasNumbers = /\d|%/.test(textToInspect);
  const sentences = textToInspect
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);

  const clarityScore = transcript
    ? Math.min(90, 62 + Math.min(18, Math.round(charCount / 25)) + (hasNumbers ? 8 : 0))
    : script
      ? 72
      : 55;

  const takeaways =
    sentences.slice(0, 3).length > 0
      ? sentences.slice(0, 3).map((s) => s.slice(0, 110))
      : [
          body.topicTitle
            ? `นำเสนอหัวข้อ "${body.topicTitle}" ในรูปแบบพูดสด`
            : 'ซ้อมพูดปากเปล่าแบบอิสระโดยไม่ใช้สไลด์',
        ];

  const improvements: string[] = [];
  if (!transcript) {
    improvements.push(
      'รอบนี้ยังไม่มีข้อความถอดเสียงคำพูด แนะนำให้ใช้เบราว์เซอร์ Chrome และอนุญาตไมโครโฟนเพื่อให้ระบบถอดเสียงประเมินเนื้อหาได้ครบถ้วน'
    );
  } else if (charCount < 120) {
    improvements.push(
      'เนื้อหาคำพูดที่บันทึกได้ยังค่อนข้างสั้น ลองขยายเหตุผลและยกตัวอย่างประกอบเพิ่มอีก 1–2 ประโยค'
    );
  }
  if (!hasNumbers) {
    improvements.push(
      'ลองใส่ตัวเลขสถิติ ระยะเวลา หรือผลลัพธ์ที่วัดได้จริงในคำพูดเพื่อเพิ่มความน่าเชื่อถือ'
    );
  }
  if (script && transcript) {
    improvements.push(
      'เปรียบเทียบคำพูดจริงกับสคริปต์ที่เตรียมไว้ เพื่อลดช่วงหยุดคิดและทำให้คำเชื่อมระหว่างประโยคลื่นไหลขึ้น'
    );
  }
  if (improvements.length === 0) {
    improvements.push(
      'เปิดเรื่องด้วยประโยคคำถามหรือประเด็นปัญหาหลักภายใน 10 วินาทีแรก และสรุปทิ้งท้ายด้วยข้อความที่จำง่าย'
    );
  }

  return {
    detectedTopic:
      body.topicTitle || sentences[0]?.slice(0, 55) || 'การซ้อมพูดปากเปล่า (โหมดไร้สไลด์)',
    clarityScore,
    structureSummaryTh: transcript
      ? `ถอดเสียงได้ประมาณ ${charCount} ตัวอักษร ระบบประเมินความชัดเจนของเนื้อหาเบื้องต้นไว้ที่ ${clarityScore}/100 (ใส่ Gemini API Key เพื่อวิเคราะห์โครงสร้างคำพูดเชิงลึก)`
      : 'ยังไม่มีข้อความถอดเสียงในรอบนี้ จึงประเมินจากสถิติการพูด สคริปต์ และหัวข้อที่กรอกไว้เบื้องต้น',
    keyTakeaways: takeaways,
    improvementsTh: improvements,
    suggestedClosingTh:
      'โดยสรุป แนวทางนี้ช่วยแก้ปัญหาที่ต้นเหตุได้อย่างชัดเจน และพร้อมนำไปต่อยอดใช้งานจริงได้ทันทีครับ/ค่ะ',
    source: 'offline-fallback',
  };
}
