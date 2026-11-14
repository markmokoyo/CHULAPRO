import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import type { AudiencePersonaId } from '@cuepulse/shared';
import {
  getAiQuotaSnapshot,
  recordGeminiError,
  recordGeminiSuccess,
  resolveGeminiApiKey,
} from '@/services/geminiQuota';

interface TtsRequestBody {
  text: string;
  personaId?: AudiencePersonaId;
  voiceName?: string;
}

const PERSONA_VOICE_CONFIG: Record<
  AudiencePersonaId,
  { voiceName: string; styleInstruction: string }
> = {
  judge: {
    voiceName: 'Charon',
    styleInstruction:
      'อ่านออกเสียงภาษาไทยอย่างเป็นธรรมชาติ ชัดถ้อยชัดคำ จังหวะพอดี ด้วยน้ำเสียงกรรมการที่สุขุม จริงจัง และสุภาพ',
  },
  advisor: {
    voiceName: 'Aoede',
    styleInstruction:
      'อ่านออกเสียงภาษาไทยอย่างเป็นธรรมชาติ ชัดถ้อยชัดคำ ด้วยน้ำเสียงอาจารย์ที่ปรึกษาที่อบอุ่น สุภาพ และชวนคิด',
  },
  inspirational: {
    voiceName: 'Puck',
    styleInstruction:
      'อ่านออกเสียงภาษาไทยอย่างเป็นธรรมชาติ ชัดถ้อยชัดคำ ด้วยน้ำเสียงสดใส เป็นกันเอง และให้กำลังใจ',
  },
};

function parseSampleRateFromMime(mimeType: string): number {
  const match = mimeType.match(/rate=(\d+)/i);
  return match ? Number(match[1]) || 24000 : 24000;
}

function wrapPcmAsWav(pcmBytes: Buffer, sampleRate: number): Buffer {
  // If already a RIFF/WAV file, return as-is
  if (
    pcmBytes.length >= 12 &&
    pcmBytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    pcmBytes.subarray(8, 12).toString('ascii') === 'WAVE'
  ) {
    return pcmBytes;
  }

  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBytes.length;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBytes]);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TtsRequestBody;
    const text = (body.text ?? '').trim();
    if (!text) {
      return NextResponse.json({ error: 'ไม่มีข้อความสำหรับอ่านออกเสียง' }, { status: 400 });
    }

    const apiKey = resolveGeminiApiKey(request);
    const hasKey = Boolean(apiKey);
    const currentQuota = getAiQuotaSnapshot(hasKey);

    if (!apiKey || currentQuota.rateLimited) {
      return NextResponse.json({
        fallback: true,
        reason: currentQuota.rateLimited ? 'rate_limited' : 'missing_key',
        quota: currentQuota,
      });
    }

    const persona: AudiencePersonaId = body.personaId ?? 'judge';
    const config = PERSONA_VOICE_CONFIG[persona] ?? PERSONA_VOICE_CONFIG.judge;
    const voiceName = body.voiceName || config.voiceName;
    const ttsPrompt = `${config.styleInstruction}:\n"${text.slice(0, 600)}"`;

    const ai = new GoogleGenAI({ apiKey });
    const ttsModels = ['gemini-2.5-flash-preview-tts'] as const;

    for (const model of ttsModels) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: ttsPrompt,
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName,
                },
              },
            },
          },
        });

        const part = response.candidates?.[0]?.content?.parts?.find(
          (p) => p.inlineData?.data
        );
        const rawBase64 = part?.inlineData?.data ?? response.data;
        const rawMime = part?.inlineData?.mimeType ?? 'audio/L16;rate=24000';

        if (!rawBase64) {
          throw new Error('Gemini TTS ไม่ได้ส่งข้อมูลเสียงกลับมา');
        }

        const rawBuf = Buffer.from(rawBase64, 'base64');
        const wavBuf = rawMime.includes('mp3') || rawMime.includes('mpeg')
          ? rawBuf
          : wrapPcmAsWav(rawBuf, parseSampleRateFromMime(rawMime));
        const outMime =
          rawMime.includes('mp3') || rawMime.includes('mpeg')
            ? 'audio/mpeg'
            : 'audio/wav';

        const totalTokens = response.usageMetadata?.totalTokenCount ?? 0;
        const updatedQuota = recordGeminiSuccess(totalTokens, true);

        return NextResponse.json({
          fallback: false,
          audioBase64: wavBuf.toString('base64'),
          mimeType: outMime,
          voiceName,
          modelUsed: model,
          quota: updatedQuota,
        });
      } catch (err) {
        console.warn(`Gemini TTS (${model}) fallback triggered:`, err);
        const updatedQuota = recordGeminiError(err, true);
        return NextResponse.json({
          fallback: true,
          reason: 'tts_error',
          error: err instanceof Error ? err.message : 'TTS failed',
          quota: updatedQuota,
        });
      }
    }

    return NextResponse.json({ fallback: true, quota: getAiQuotaSnapshot(hasKey) });
  } catch (error) {
    return NextResponse.json(
      {
        fallback: true,
        error: error instanceof Error ? error.message : 'ไม่สามารถสร้างเสียงพูดได้',
      },
      { status: 500 }
    );
  }
}
