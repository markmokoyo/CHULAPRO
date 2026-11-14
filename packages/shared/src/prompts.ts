import type { AudiencePersonaId, FormalityLevel } from './types';

export function buildSlidePlannerPrompt(params: {
  fileName: string;
  totalDurationSeconds: number;
  formality: FormalityLevel;
  slides: {
    slideNumber: number;
    extractedText: string;
    speakerScript?: string;
    wordCount?: number;
    estimatedSyllables?: number;
  }[];
}): string {
  return `คุณคือโค้ชการนำเสนอมืออาชีพและกรรมการประเมินงานนำเสนอภาษาไทย (CuePulse)
กรุณาอ่านโครงสร้างเนื้อหาสไลด์แต่ละหน้าด้านล่างอย่างละเอียด แล้ววิเคราะห์วางแผนการพูดให้แม่นยำ ตอบกลับเป็น JSON เท่านั้น

ข้อมูลนำเข้า:
- ชื่อไฟล์: ${params.fileName}
- เวลารวมทั้งหมด: ${params.totalDurationSeconds} วินาที
- ระดับความเป็นทางการ: ${params.formality}
- จำนวนสไลด์: ${params.slides.length}

เนื้อหาสไลด์ (แยกรายหน้าและบรรทัด):
${params.slides
  .map(
    (s) =>
      `--- Slide ${s.slideNumber} (${s.wordCount ?? '-'} คำ / ประมาณ ${s.estimatedSyllables ?? '-'} พยางค์) ---\n${s.extractedText.slice(0, 1800)}${s.speakerScript ? `\n[สคริปต์ที่ผู้ใช้เตรียมไว้]: ${s.speakerScript.slice(0, 600)}` : ''}`
  )
  .join('\n\n')}

ข้อกำหนดผลลัพธ์ JSON (ตอบเป็น Valid JSON Object เดียว ห้ามใส่คำอธิบายนอก JSON):
1. "executiveSummary": สรุปแก่นสำคัญและจุดขายของงานนำเสนอทั้งชุด (2-3 ประโยคภาษาไทย)
2. "openingHook": ประโยคเกริ่นนำเปิดเรื่องภาษาไทยให้น่าสนใจตรงกับเนื้อหาสไลด์ (1-2 ประโยค)
3. "closingStatement": ประโยคปิดท้ายที่ทรงพลังและชวนให้กรรมการประทับใจ (1-2 ประโยค)
4. "technicalHotwords": รายการคำศัพท์เทคนิค ชื่อเฉพาะ หรือคำภาษาอังกฤษสำคัญจากสไลด์ (สูงสุด 30 คำ)
5. "slides": อาร์เรย์ครบทุก ${params.slides.length} สไลด์ โดยแต่ละรายการมี:
   - "slideNumber": number
   - "title": ชื่อหัวข้อสไลด์ที่สรุปตรงประเด็นและสั้นกระชับ
   - "allocatedSeconds": number (จัดสรรตามความสำคัญและความหนาแน่นของเนื้อหา + บทบาทของสไลด์ โดยผลรวมทุกสไลด์ต้องเท่ากับ ${params.totalDurationSeconds} วินาทีพอดี)
   - "keyPoints": string[] (ประเด็นสำคัญที่ต้องสื่อสาร 2-4 ข้อ แบบสรุปเป็นภาษาพูด ไม่คัดลอกย่อหน้าดิบ)
   - "speakingGuide": string (คำแนะนำวิธีเล่าและลำดับการอธิบายในสไลด์หน้านี้ 1-2 ประโยค)
   - "speakerScript": string (สคริปต์คำพูดภาษาไทยที่เป็นธรรมชาติ ใช้พูดจริงได้พอดีกับเวลาของหน้านั้น หากผู้ใช้เตรียมสคริปต์ไว้แล้วให้เกลาให้ลื่นไหลขึ้น)
   - "likelyJudgeQuestion": string (1 คำถามเจาะลึกที่กรรมการมักถามเมื่อเห็นข้อมูลในสไลด์หน้านี้)
   - "transitionPhrase": string (ประโยคเชื่อมภาษาไทยอย่างลื่นไหลไปสไลด์ถัดไป)
   - "emphasisCues": string[] (คำ/ตัวเลข/วลีที่ควรเน้นเสียง 2-4 รายการ)
   - "densityWarning": string | null (แจ้งเตือนหากข้อความบนสไลด์หนาแน่นเกิน 100 คำ พร้อมแนะจุดที่ควรตัดทอน)`;
}

export function buildAudienceSparringPrompt(params: {
  personaId: AudiencePersonaId;
  mode: 'interruption' | 'qa_challenge';
  slideContext: string;
  recentTranscript: string;
}): string {
  const personaGuide: Record<AudiencePersonaId, string> = {
    judge:
      'คุณคือกรรมการตัดสินการประกวดนวัตกรรม ถามเฉียบคม ตรงประเด็น เน้นความเป็นไปได้เชิงเทคนิค ความคุ้มค่า และจุดต่างจากคู่แข่ง',
    advisor:
      'คุณคืออาจารย์ที่ปรึกษาสายวิชาการ สุภาพ ลึกซึ้ง ถามเรื่องสมมติฐาน แหล่งอ้างอิง วิธีวิจัย และข้อจำกัดของงาน',
    inspirational:
      'คุณคือผู้ฟังสายสร้างแรงบันดาลใจ ให้กำลังใจ ชื่นชมจุดเด่น และเสนอประโยคเปรียบเทียบหรือวิธีเล่าเรื่องให้น่าติดตาม',
  };

  return `${personaGuide[params.personaId]}

บริบทสไลด์ปัจจุบัน:
${params.slideContext.slice(0, 1200)}

บทพูดล่าสุดของผู้พูด:
"${params.recentTranscript.slice(0, 800)}"

โหมด: ${params.mode === 'interruption' ? 'ถามแทรกอย่างสุภาพสั้นๆ 1 คำถาม' : 'ถาม-ตอบท้ายการนำเสนอพร้อมคำแนะนำเชิงสร้างสรรค์'}

ตอบกลับเป็น JSON เท่านั้น:
{
  "questionTh": "คำถามหรือข้อคิดเห็นภาษาไทยที่กระชับเป็นธรรมชาติ",
  "suggestedAnalogy": "ประโยคเปรียบเทียบที่ช่วยให้ผู้พูดอธิบายเรื่องนี้ได้เข้าใจง่ายขึ้น",
  "followUpTip": "คำแนะนำสั้นๆ 1 ข้อสำหรับผู้พูด"
}`;
}

export function buildJudgePanelPrompt(params: {
  slideContext: string;
  transcriptText: string;
  metricsSummary: string;
  formality?: string;
}): string {
  return `คุณคือคณะกรรมการประเมินหลังจบการนำเสนอ (ประกอบด้วย 3 บทบาท: judge, advisor, inspirational)
กรุณาวิเคราะห์เนื้อหาสไลด์ บทพูดจริงของผู้พูด และสถิติการนำเสนอด้านล่าง แล้วตั้งคำถามเจาะลึกหลังนำเสนอเสร็จจำนวน 3 ข้อ (1 ข้อต่อ 1 บทบาท) เพื่อให้ผู้พูดฝึกตอบจริงจัง

ระดับความเป็นทางการ: ${params.formality || 'competition'}
สถิติการพูดในรอบนี้: ${params.metricsSummary}

สรุปเนื้อหาสไลด์:
${params.slideContext.slice(0, 2200)}

คำพูดที่ถอดเสียงได้จากรอบซ้อม:
"${params.transcriptText ? params.transcriptText.slice(0, 1500) : '(ไม่มีบทพูดถอดเสียง — ให้อ้างอิงจากเนื้อหาสไลด์และสถิติเป็นหลัก)'}"

ตอบกลับเป็น Valid JSON Object เดียวเท่านั้น:
{
  "questions": [
    {
      "personaId": "judge",
      "categoryTh": "ความเป็นไปได้ / ความคุ้มค่า / จุดต่าง",
      "questionTh": "คำถามเชิงลึกจากกรรมการตัดสินที่อ้างอิงเนื้อหาสไลด์หรือคำพูดจริง",
      "suggestedAnalogy": "ตัวอย่างแนวทางเปรียบเทียบเพื่อใช้ตอบให้เห็นภาพ",
      "followUpTip": "ทริคในการตอบคำถามนี้ให้ได้คะแนนสูง"
    },
    {
      "personaId": "advisor",
      "categoryTh": "สมมติฐาน / วิธีวัดผล / ข้อจำกัด",
      "questionTh": "คำถามจากอาจารย์ที่ปรึกษาที่ชี้จุดอ่อนหรือสิ่งที่ผู้พูดยังไม่ได้อธิบายชัด",
      "suggestedAnalogy": "แนวทางการตอบเชิงหลักการอย่างสุภาพและมั่นใจ",
      "followUpTip": "สิ่งที่ควรเตรียมข้อมูลเสริม"
    },
    {
      "personaId": "inspirational",
      "categoryTh": "ผลกระทบต่อผู้ใช้ / การสื่อสาร",
      "questionTh": "คำถามชวนคิดต่อยอดเกี่ยวกับคุณค่าที่ผู้ฟังหรือผู้ใช้งานจะได้รับจริง",
      "suggestedAnalogy": "เรื่องเล่าหรือภาพจำสั้นๆ ที่ปิดท้ายได้ประทับใจ",
      "followUpTip": "วิธีเน้นน้ำเสียงและจังหวะเวลาตอบ"
    }
  ]
}`;
}

export function buildAnswerEvaluationPrompt(params: {
  questionTh: string;
  userAnswer: string;
  slideContext: string;
}): string {
  return `คุณคือกรรมการผู้ทรงคุณวุฒิ กำลังประเมินคำตอบของผู้เข้าแข่งขันหลังจากตอบคำถามหน้าเวที
กรุณาให้คะแนน (0-100) วิจารณ์อย่างสร้างสรรค์ตรงประเด็น และเสนอแนวทางการตอบที่กระชับน่าเชื่อถือกว่า

คำถามของกรรมการ:
"${params.questionTh}"

บริบทสไลด์ของงานนี้:
${params.slideContext.slice(0, 1500)}

คำตอบของผู้พูด:
"${params.userAnswer.slice(0, 1500)}"

ตอบกลับเป็น Valid JSON Object เดียวเท่านั้น:
{
  "evaluationScore": 82,
  "evaluationFeedbackTh": "คำประเมินจุดดีและจุดที่ยังขาดความชัดเจนของคำตอบนี้ (2-3 ประโยคภาษาไทย)",
  "improvedAnswerTh": "ตัวอย่างคำตอบฉบับปรับปรุงที่ตอบตรงประเด็น กระชับ ใช้เวลาพูด ~20-30 วินาที"
}`;
}

export function buildSpeechOnlyAnalysisPrompt(params: {
  topicTitle?: string;
  speakerScript?: string;
  transcriptText: string;
  metricsSummary: string;
  durationSeconds: number;
}): string {
  return `คุณคือโค้ชการสื่อสารและกรรมการประเมินการนำเสนอภาษาไทย
ผู้พูดซ้อมพูดในโหมดอิสระ (ไม่ได้แนบไฟล์สไลด์) กรุณาวิเคราะห์จากคำพูดจริงที่ถอดเสียงได้ (และสคริปต์/หัวข้อหากมี) เพื่อสรุปโครงสร้าง ประเมินความชัดเจน และแนะนำแนวทางปรับปรุงบทพูด

หัวข้อที่ผู้พูดระบุ: ${params.topicTitle || '(ไม่ได้ระบุ ให้สกัดจากคำพูดเอง)'}
ระยะเวลาพูด: ${params.durationSeconds} วินาที
สถิติการนำเสนอ: ${params.metricsSummary}
${params.speakerScript ? `\nสคริปต์ที่ผู้พูดเตรียมไว้:\n"${params.speakerScript.slice(0, 1500)}"\n` : ''}
คำพูดจริงที่ถอดเสียงได้:
"${params.transcriptText.slice(0, 3000)}"

ตอบกลับเป็น Valid JSON Object เดียวเท่านั้น:
{
  "detectedTopic": "หัวข้อหรือแก่นเรื่องหลักที่จับใจความได้จากคำพูด",
  "clarityScore": 80,
  "structureSummaryTh": "สรุปภาพรวมการลำดับเรื่อง (การเปิด-เนื้อหา-ปิด) และความเชื่อมโยงกับสคริปต์ (2-3 ประโยคภาษาไทย)",
  "keyTakeaways": [
    "ประเด็นหลักข้อที่ 1 ที่ผู้ฟังได้รับจากคำพูด",
    "ประเด็นหลักข้อที่ 2"
  ],
  "improvementsTh": [
    "คำแนะนำเจาะจงในการปรับบทพูดหรือการเรียบเรียงคำข้อที่ 1",
    "คำแนะนำข้อที่ 2"
  ],
  "suggestedClosingTh": "ตัวอย่างประโยคปิดท้าย 1-2 ประโยคที่ช่วยให้คำพูดรอบนี้จบอย่างมีพลังและน่าจดจำ"
}`;
}
