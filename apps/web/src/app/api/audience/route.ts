import { NextResponse } from 'next/server';
import {
  buildAnswerEvaluationPrompt,
  buildAudienceSparringPrompt,
  buildJudgePanelPrompt,
  buildSpeechOnlyAnalysisPrompt,
  type AudienceMessage,
  type AudiencePersonaId,
  type SpeechContentAnalysis,
  type StarEvaluationFeedback,
} from '@cuepulse/shared';
import {
  generateGeminiJson,
  generateGeminiMultimodalJson,
  getAiQuotaSnapshot,
  recordGeminiError,
  recordGeminiSuccess,
  resolveGeminiApiKey,
  type GeminiInlinePart,
} from '@/services/geminiQuota';

interface AudienceRequestBody {
  personaId?: AudiencePersonaId;
  mode:
    | 'interruption'
    | 'qa_challenge'
    | 'judge_panel'
    | 'evaluate_answer'
    | 'speech_analysis'
    | 'video_star_evaluation';
  slideContext: string;
  recentTranscript?: string;
  metricsSummary?: string;
  formality?: string;
  questionTh?: string;
  userAnswer?: string;
  topicTitle?: string;
  speakerScript?: string;
  durationSeconds?: number;
  metrics?: {
    overallScore: number;
    averageSpm: number;
    fillerCount: number;
    fillerPerMinute: number;
    eyeContactRatio: number;
    goodPostureRatio: number;
  };
  stars?: {
    overall: number;
    fluency: number;
    pacing: number;
    eye: number;
    posture: number;
  };
  fillerWordsSummary?: string;
  postureIssuesSummary?: string;
  videoBase64?: { mimeType: string; data: string };
  frames?: Array<{ mimeType: string; data: string }>;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AudienceRequestBody;
    const apiKey = resolveGeminiApiKey(request);
    const hasKey = Boolean(apiKey);
    const currentQuota = getAiQuotaSnapshot(hasKey);
    let aiErrorMessage: string | undefined;

    if (body.mode === 'video_star_evaluation') {
      const hasMedia = Boolean(body.videoBase64 || (body.frames && body.frames.length > 0));
      if (apiKey && !currentQuota.rateLimited) {
        try {
          const stars = body.stars ?? {
            overall: 3,
            fluency: 3,
            pacing: 3,
            eye: 3,
            posture: 3,
          };
          const m = body.metrics ?? {
            overallScore: 70,
            averageSpm: 0,
            fillerCount: 0,
            fillerPerMinute: 0,
            eyeContactRatio: 0,
            goodPostureRatio: 0,
          };

          const promptText = `คุณคือโค้ชฝึกพูดภาษาไทยมืออาชีพที่กำลังดูวิดีโอการซ้อมนำเสนอจริงของผู้พูด
จงวิเคราะห์จากวิดีโอ/ภาพจากวิดีโอจริง (หากแนบมา) ร่วมกับข้อความถอดเสียงและสถิติจริงของรอบนี้ แล้วเขียนคำชมและข้อเสนอแนะเชิงบวกเป็นภาษาไทยความยาว 1-2 ประโยคต่อหัวข้อ โดยอ้างอิงสิ่งที่เกิดขึ้นจริงในวิดีโอหรือสถิติรอบนี้ (ห้ามเขียนคำกว้างๆ แบบทั่วไป ให้ระบุรายละเอียดจริง เช่น ท่าทางในภาพ คำพูดจริงที่พูด ความเร็ว SPM หรือคำฟุ่มเฟือยที่พบ) และคุมโทนเสียงให้ตรงกับระดับดาวของแต่ละหัวข้อ:
- 1 ดาว: ชื่นชมความตั้งใจและจุดเริ่มต้นที่ดี พร้อมชี้แนะจุดที่ต้องปรับปรุงอย่างสุภาพและให้กำลังใจ
- 2 ดาว: ชื่นชมการวางพื้นฐานและโครงสร้างหลัก แนะนำให้เติมรายละเอียดหรือฝึกเพิ่ม
- 3 ดาว: ชื่นชมที่ได้มาตรฐาน ครบถ้วน เข้าใจง่าย แนะนำจุดเล็กๆ ที่จะทำให้น่าสนใจยิ่งขึ้น
- 4 ดาว: ชื่นชมความยอดเยี่ยม คุณภาพระดับมืออาชีพ เหลือเพียงขัดเกลาอีกนิดเดียว
- 5 ดาว: ชื่นชมความสมบูรณ์แบบ ระดับมาสเตอร์พีซ ครบถ้วนและทรงพลัง

ข้อมูลจริงของการซ้อมรอบนี้:
- ระยะเวลา: ${body.durationSeconds ?? 0} วินาที
- คะแนนรวม: ${m.overallScore}/100 (${stars.overall}/5 ดาว)
- ความลื่นไหลและคำฟุ่มเฟือย (${stars.fluency}/5 ดาว): พบ ${m.fillerCount} ครั้ง (${m.fillerPerMinute} ครั้ง/นาที) ${body.fillerWordsSummary ? `| คำที่พบ: ${body.fillerWordsSummary}` : ''}
- ความเร็วในการพูด (${stars.pacing}/5 ดาว): เฉลี่ย ${m.averageSpm} พยางค์/นาที (เกณฑ์เหมาะสม 180-220)
- การสบตาผู้ฟัง (${stars.eye}/5 ดาว): ${m.eyeContactRatio}%
- บุคลิกภาพและท่าทาง (${stars.posture}/5 ดาว): ${m.goodPostureRatio}% ${body.postureIssuesSummary ? `| อาการที่ตรวจพบ: ${body.postureIssuesSummary}` : ''}
- ข้อความที่พูดจริง: ${body.recentTranscript?.trim() ? body.recentTranscript.slice(0, 1200) : '(ไม่มีข้อความถอดเสียง)'}

ตอบกลับเป็น JSON เท่านั้น ตามโครงสร้างนี้:
{
  "overall": "คำชมและข้อเสนอแนะสำหรับคะแนนรวม (1-2 ประโยค)",
  "fluency": "คำชมและข้อเสนอแนะด้านความลื่นไหลและคำฟุ่มเฟือย (1-2 ประโยค)",
  "pacing": "คำชมและข้อเสนอแนะด้านความเร็วในการพูด (1-2 ประโยค)",
  "eye": "คำชมและข้อเสนอแนะด้านการสบตาจากภาพ/วิดีโอจริง (1-2 ประโยค)",
  "posture": "คำชมและข้อเสนอแนะด้านบุคลิกท่าทางจากภาพ/วิดีโอจริง (1-2 ประโยค)"
}`;

          const parts: GeminiInlinePart[] = [];
          if (body.videoBase64) {
            parts.push({ inlineData: body.videoBase64 });
          } else if (body.frames && body.frames.length > 0) {
            for (const frame of body.frames.slice(0, 5)) {
              parts.push({ inlineData: frame });
            }
          }
          parts.push({ text: promptText });

          const { data: parsed, totalTokens } = hasMedia
            ? await generateGeminiMultimodalJson<Partial<StarEvaluationFeedback>>(apiKey, parts)
            : await generateGeminiJson<Partial<StarEvaluationFeedback>>(apiKey, promptText);

          const updatedQuota = recordGeminiSuccess(totalTokens, true);
          const fallback = buildTelemetryStarFallback(body);
          const evaluation: StarEvaluationFeedback = {
            overall: parsed.overall?.trim() || fallback.overall,
            fluency: parsed.fluency?.trim() || fallback.fluency,
            pacing: parsed.pacing?.trim() || fallback.pacing,
            eye: parsed.eye?.trim() || fallback.eye,
            posture: parsed.posture?.trim() || fallback.posture,
            source: hasMedia ? 'gemini-video' : 'gemini-telemetry',
          };

          return NextResponse.json({
            evaluation,
            source: evaluation.source,
            quota: updatedQuota,
          });
        } catch (aiError) {
          console.warn('Gemini video_star_evaluation fallback triggered:', aiError);
          const updatedQuota = recordGeminiError(aiError, true);
          aiErrorMessage =
            updatedQuota.lastError ||
            (aiError instanceof Error ? aiError.message : 'วิเคราะห์วิดีโอไม่สำเร็จ');
        }
      }

      return NextResponse.json({
        evaluation: buildTelemetryStarFallback(body),
        source: 'telemetry-fallback',
        aiError: aiErrorMessage,
        quota: getAiQuotaSnapshot(hasKey),
      });
    }

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

function buildTelemetryStarFallback(body: AudienceRequestBody): StarEvaluationFeedback {
  const m = body.metrics ?? {
    overallScore: 70,
    averageSpm: 0,
    fillerCount: 0,
    fillerPerMinute: 0,
    eyeContactRatio: 0,
    goodPostureRatio: 0,
  };

  const overall = `ทำคะแนนรวมได้ ${m.overallScore}/100 จากการซ้อมความยาว ${body.durationSeconds ?? 0} วินาที — ${
    m.overallScore >= 85
      ? 'ภาพรวมยอดเยี่ยมมาก รักษาความสม่ำเสมอของจังหวะและการสื่อสารได้ดีเยี่ยม'
      : m.overallScore >= 65
        ? 'วางพื้นฐานการนำเสนอได้ดีแล้ว ลองฝึกเพิ่มความมั่นใจในจุดที่คะแนนยังต่ำกว่า 75% จะช่วยให้โดดเด่นขึ้นมาก'
        : 'เป็นจุดเริ่มต้นที่ดีในการฝึกซ้อม แนะนำให้โฟกัสแก้ทีละจุด เช่น ลดคำติดปากและสบตากล้องให้ต่อเนื่องขึ้น'
  }`;

  const fluency =
    m.fillerCount === 0
      ? 'พูดได้ต่อเนื่องลื่นไหลมาก ตลอดการซ้อมไม่พบคำฟุ่มเฟือยรบกวนผู้ฟังเลย'
      : `ตรวจพบคำฟุ่มเฟือย ${m.fillerCount} ครั้ง (${m.fillerPerMinute} ครั้ง/นาที)${
          body.fillerWordsSummary ? ` เช่น ${body.fillerWordsSummary}` : ''
        } — ลองหยุดหายใจสั้นๆ แทนคำเชื่อมเหล่านี้จะช่วยให้ประโยคคมชัดขึ้น`;

  const pacing =
    m.averageSpm === 0
      ? 'รอบนี้ยังจับจังหวะความเร็วการพูดได้น้อย แนะนำให้พูดใกล้ไมโครโฟนด้วยน้ำเสียงชัดเจนขึ้น'
      : m.averageSpm > 220
        ? `ความเร็วเฉลี่ยอยู่ที่ ${m.averageSpm} พยางค์/นาที ซึ่งเร็วกว่าเกณฑ์ 180–220 เล็กน้อย ลองเว้นวรรคหายใจท้ายประโยคจะฟังสบายขึ้น`
        : m.averageSpm < 180
          ? `ความเร็วเฉลี่ยอยู่ที่ ${m.averageSpm} พยางค์/นาที ค่อนข้างช้าสบายๆ ลองเพิ่มจังหวะให้กระชับเข้าช่วง 180–220 จะดูมีพลังขึ้น`
          : `คุมจังหวะได้ดีเยี่ยมที่ ${m.averageSpm} พยางค์/นาที อยู่ในเกณฑ์มาตรฐาน 180–220 ฟังชัดเจนกำลังดี`;

  const eye =
    m.eyeContactRatio >= 80
      ? `สบตากล้องได้สม่ำเสมอถึง ${m.eyeContactRatio}% สร้างความน่าเชื่อถือและการเชื่อมโยงกับผู้ฟังได้ดีมาก`
      : `ระดับการสบตากล้องอยู่ที่ ${m.eyeContactRatio}% — แนะนำให้มองตรงเข้าเลนส์มากขึ้นและลดการเหลือบมองบนหรือก้มมองโพยนานเกินไป`;

  const posture =
    m.goodPostureRatio >= 85
      ? `บุคลิกท่าทางมั่นคงถึง ${m.goodPostureRatio}% ดูสง่าและเป็นธรรมชาติตลอดคลิป`
      : `คะแนนบุคลิกภาพอยู่ที่ ${m.goodPostureRatio}%${
          body.postureIssuesSummary ? ` (พบ${body.postureIssuesSummary})` : ''
        } — ลองยืดไหล่ตรงและผ่อนคลายช่วงแขนจะช่วยเสริมความมั่นใจขึ้นทันที`;

  return {
    overall,
    fluency,
    pacing,
    eye,
    posture,
    source: 'telemetry-fallback',
  };
}
