# 02. สถาปัตยกรรมกลางและ Data Contracts (Shared Architecture & Contracts)

เอกสารนี้คือ **Single Source of Truth** สำหรับทั้ง Phase 1 (Web App) และ Phase 2 (Android & Wear OS) ทุก Agent ต้องใช้โครงสร้างข้อมูล สูตรคำนวณ และ Prompts ตามที่กำหนดในไฟล์นี้

---

## 1. สถาปัตยกรรมภาพรวม (Cross-Platform Layered Architecture)

```text
┌───────────────────────────────────────────────────────────────────────┐
│                   Presentation / UI Layer                             │
│  Web: Next.js + React + Tailwind   │  Mobile: Jetpack Compose + Wear  │
├───────────────────────────────────────────────────────────────────────┤
│                   Platform Engine Adapters                            │
│  Web: MediaPipe Web, Web Audio     │  Mobile: CameraX, Sherpa-ONNX,   │
│       PDF.js, Simulated Watch HUD  │          Wear OS MessageClient   │
├───────────────────────────────────────────────────────────────────────┤
│                   Shared Domain Core (Contract)                       │
│  • Scoring Engine (Posture, Eye Contact, Pacing, Filler Rate)         │
│  • Dual-Layer Thai Filler Rule & Cooldown State Machine (20s)         │
│  • JSON Schemas (Plan, Telemetry, SessionReport, TeamReport)          │
│  • Gemini API Prompts (Slide Planner & 3 Audience Personas)           │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 2. Shared Data Schemas (TypeScript Reference)

> ใน Phase 1 ให้สร้างไฟล์เหล่านี้ใน `packages/shared/src/types.ts` และใน Phase 2 ให้แปลงเป็น Kotlin `@Serializable data class` ที่มีชื่อ field และ type ตรงกัน 100%

### 2.1 Slide & Presentation Plan
```typescript
export type FormalityLevel = 'academic' | 'competition' | 'casual' | 'business';

export interface SlideItem {
  slideNumber: number;
  title: string;
  extractedText: string;
  wordCount: number;
  estimatedSyllables?: number;
  allocatedSeconds: number;        // Pacing Budget ต่อสไลด์
  keyPoints: string[];             // ประเด็นสำคัญ 2-4 ข้อ
  speakingGuide?: string;          // แนวทางลำดับการเล่าเรื่องหน้านี้
  speakerScript?: string;          // สคริปต์คำพูดที่ผู้ใช้กรอกหรือ AI ร่างให้
  imageDataUrl?: string;           // ภาพตัวอย่างสไลด์ 16:9 สำหรับแสดงผลระหว่างซ้อม
  likelyJudgeQuestion?: string;    // คำถามที่กรรมการมักถามจากหน้านี้
  transitionPhrase: string;        // ประโยคเชื่อมไปสไลด์ถัดไป
  emphasisCues: string[];          // คำ/วลีที่ควรเน้นเสียง
  densityWarning?: string;         // แจ้งเตือนหากตัวอักษรแน่นเกินไป
}

export interface PresentationPlan {
  id: string;
  fileName: string;
  sourceType?: 'slides' | 'freeform';
  totalDurationSeconds: number;
  formality: FormalityLevel;
  executiveSummary?: string;
  openingHook: string;
  closingStatement?: string;
  technicalHotwords: string[];     // คำศัพท์เฉพาะจากสไลด์สำหรับ ASR Boosting
  slides: SlideItem[];
  createdAt: string;               // ISO 8601
}
```

### 2.2 Real-Time Telemetry & Haptic Cues
```typescript
export type HapticPatternType =
  | 'SOFT_TICK'      // 80ms: เตือนคำฟุ่มเฟือย "อืม/อ่า"
  | 'DOUBLE_PULSE'   // 100ms x 2: เตือนพูดเร็วเกินไป หรือละสายตา > 5 วินาที
  | 'GENTLE_WAVE';   // 300ms: เตือนท่าทางห่อไหล่/กอดอก หรือใกล้หมดเวลาสไลด์

export type AlertReason =
  | 'FILLER_WORD'
  | 'SPEAKING_TOO_FAST'
  | 'EYE_CONTACT_LOST'
  | 'BAD_POSTURE'
  | 'SLIDE_TIME_WARNING';

export interface HapticCueEvent {
  id: string;
  timestampMs: number;             // เวลาสัมพัทธ์ตั้งแต่เริ่มซ้อม
  pattern: HapticPatternType;
  reason: AlertReason;
  messageTh: string;               // ข้อความสั้นๆ เช่น "ลดความเร็วการพูดลงนิดนึง"
  slideNumber: number;
}

export interface TelemetrySnapshot {
  timestampMs: number;
  currentSpm: number;              // Syllables Per Minute
  eyeContactScore: number;         // 0.0 - 1.0
  postureScore: number;            // 0.0 - 1.0
  isSlouching: boolean;
  isArmsCrossed: boolean;
  isSwaying: boolean;
  isSpeaking: boolean;
  activeSpeakerId?: string;        // ใช้ใน Team Mode
}
```

### 2.3 Session Report (Individual & Team)
```typescript
export interface FillerOccurrence {
  word: string;                    // เช่น "อืม", "อ่า", "แบบว่า"
  layer: 'acoustic' | 'lexical';
  timestampMs: number;
  slideNumber: number;
}

export interface SpeechContentAnalysis {
  detectedTopic: string;
  clarityScore: number;
  structureSummaryTh: string;
  keyTakeaways: string[];
  improvementsTh: string[];
  suggestedClosingTh: string;
  source: 'gemini' | 'offline-fallback';
}

export interface SessionReport {
  sessionId: string;
  mode: 'solo' | 'team';
  planId?: string;
  topicTitle?: string;
  speakerScript?: string;
  durationSeconds: number;
  overallScore: number;            // 0 - 100
  metrics: {
    averageSpm: number;            // เกณฑ์ปกติ 180 - 220
    fillerCount: number;
    fillerPerMinute: number;
    eyeContactRatio: number;       // 0 - 100 (%)
    goodPostureRatio: number;      // 0 - 100 (%)
  };
  fillers: FillerOccurrence[];
  hapticCues: HapticCueEvent[];
  transcriptSegments: {
    speakerId: string;
    text: string;
    startMs: number;
    endMs: number;
  }[];
  speechAnalysis?: SpeechContentAnalysis;
  aiFeedbackSummary?: string;
  createdAt: string;
}

export interface TeamMemberProfile {
  memberId: string;
  name: string;
  assignedSlides: number[];
  enrolledAt: string;
  // Web: reference face/mouth ROI & audio profile; Mobile: Sherpa voice embedding
}

export interface TeamSessionReport extends SessionReport {
  mode: 'team';
  teamBalanceScore?: number;         // คะแนนความสมดุลการแบ่งเวลาพูดในทีม (0-100)
  handoffScore?: number;             // คะแนนความลื่นไหลการส่งไม้ต่อ (0-100)
  memberReports: {
    memberId: string;
    name: string;
    individualScore?: number;        // คะแนนรวมรายบุคคล (0-100)
    speakingSeconds: number;
    speakingSharePercent: number;
    averageSpm: number;
    fillerCount: number;
    eyeContactRatio: number;
    postureRatio: number;
    attentivenessWhileListening: number; // คะแนนความตั้งใจฟังเมื่อเพื่อนพูด
  }[];
  handoffTransitions: {
    fromMemberId: string;
    toMemberId: string;
    gapSeconds: number;            // ช่วงเงียบระหว่างส่งไม้ต่อ
    timestampMs: number;
  }[];
}
```

### 2.4 AI Audience Sparring
```typescript
export type AudiencePersonaId = 'judge' | 'advisor' | 'inspirational';

export interface AudienceMessage {
  id: string;
  role: 'audience' | 'speaker';
  personaId: AudiencePersonaId;
  text: string;
  categoryTh?: string;
  suggestedAnalogy?: string;
  followUpTip?: string;
  userAnswer?: string;
  evaluationScore?: number;
  evaluationFeedbackTh?: string;
  improvedAnswerTh?: string;
  timestampMs: number;
}
```

---

## 3. สูตรคำนวณและเกณฑ์มาตรฐาน (Scoring & Detection Rules)

### 3.1 เกณฑ์ความเร็วการพูด (Thai Pacing)
- **ช้าเกินไป**: `< 150 SPM`
- **เหมาะสม (Optimal)**: `180 – 220 SPM`
- **เร็วเกินไป (Trigger `DOUBLE_PULSE`)**: `> 240 SPM` ต่อเนื่องเกิน `5 วินาที`

### 3.2 Dual-Layer Thai Filler Rule
- **Acoustic Filler**:
  - ตรวจจับเสียงสระลากยาวที่ความถี่ `F0` (Pitch) คงที่ (ส่วนเบี่ยงเบน `< 15 Hz`) นานเกิน `250 ms`
  - **เงื่อนไขบังคับ**: ต้องมีช่วงเงียบ (Silence Gap `< -40 dBFS`) ทั้งก่อนหน้าและตามหลังเกิน `150 ms` เพื่อป้องกัน False Positive จากคำว่า `"อา"`, `"อ่าน"`, `"อารมณ์"`
- **Lexical Filler**:
  - รายการคำเริ่มต้น: `["แบบว่า", "คือแบบ", "อันนี้", "เอ่อ", "อ่า", "อืม", "นะฮะ", "ก็แบบ"]`
  - นับเมื่อปรากฏโดดๆ หรืออยู่ที่ต้นประโยค/หลังช่วงหยุดพูด

### 3.3 Vision Geometry Rules (MediaPipe Landmarks)
- **Eye Contact (`Face Landmarker` 478 จุด)**:
  - คำนวณ Head Pose (`Yaw` อยู่ในช่วง `±18°`, `Pitch` อยู่ในช่วง `±15°`) ร่วมกับตำแหน่ง Iris ให้อยู่กึ่งกลางดวงตา
  - หากหลบสายตาต่อเนื่อง `> 5,000 ms` → Trigger `DOUBLE_PULSE` (`EYE_CONTACT_LOST`)
- **Posture (`Pose Landmarker` 33 จุด)**:
  - **ไหล่ห่อ / หลังค่อม**: วัดระยะแนวดิ่งระหว่างจุดหู (`7, 8`) กับจุดไหล่ (`11, 12`) เทียบกับความกว้างไหล่ หากอัตราส่วนลดลงเกิน `20%` จากค่า Baseline ตอนยืนตรง → `isSlouching = true`
  - **กอดอก (`Pose + Hand`)**: ระยะห่างระหว่างข้อมือซ้าย-ขวา (`15, 16`) กับจุดศอกด้านตรงข้ามน้อยกว่า `0.25 × ความกว้างไหล่` ต่อเนื่อง `> 3 วินาที` → `isArmsCrossed = true`
  - **โยกตัว (`Swaying`)**: ค่าเบี่ยงเบนมาตรฐาน (SD) ของจุดกึ่งกลางสะโพกในแกน X เกินเกณฑ์ในหน้าต่างเวลา 3 วินาที → `isSwaying = true`
  - หากท่าทางเสียต่อเนื่อง `> 4,000 ms` → Trigger `GENTLE_WAVE` (`BAD_POSTURE`)

### 3.4 Haptic Cooldown State Machine
- **Global Cooldown**: หลังจากส่ง `HapticCueEvent` ใดๆ ออกไป ระบบต้องรออย่างน้อย **`20,000 ms` (20 วินาที)** จึงจะส่งสัญญาณถัดไปได้ (ยกเว้นผู้ใช้ปิด Live Haptics จะบันทึกเฉพาะใน Report โดยไม่แจ้งเตือนระหว่างพูด)

### 3.5 Overall Score Formula (0–100)
```text
OverallScore =
  (0.30 × EyeContactRatio) +
  (0.25 × GoodPostureRatio) +
  (0.25 × PacingScore) +        // 100 เมื่ออยู่ในช่วง 180-220 SPM, ลดหลั่นตามระยะห่าง
  (0.20 × FluencyScore)         // max(0, 100 - (FillerPerMinute × 12))
```

---

## 4. Gemini API System Prompts (ใช้ร่วมกันทั้ง Web & Mobile)

### 4.1 Slide Planner Prompt
> ส่งเฉพาะ `extractedText` รายหน้า + `totalDurationSeconds` + `formality` ให้ตอบกลับเป็น JSON ตามโครงสร้าง `PresentationPlan`
- บังคับให้คำนวณ `allocatedSeconds` รวมทุกหน้าให้เท่ากับ `totalDurationSeconds`
- ให้สกัด `technicalHotwords` (คำศัพท์ภาษาอังกฤษหรือศัพท์เทคนิคในสไลด์) สูงสุด 30 คำ
- เขียน `openingHook`, `transitionPhrase` และ `emphasisCues` เป็นภาษาไทยที่พูดแล้วเป็นธรรมชาติ

### 4.2 AI Audience Personas (3 บทบาท)
1. **`judge` (กรรมการตัดสินการประกวดนวัตกรรม)**:
   - บุคลิก: เฉียบคม ตรงประเด็น ถามเรื่องความคุ้มค่า จุดต่างจากคู่แข่ง และความเป็นไปได้เชิงเทคนิค
2. **`advisor` (อาจารย์ที่ปรึกษาสายวิชาการ)**:
   - บุคลิก: สุภาพ ลึกซึ้ง ถามเรื่องสมมติฐาน แหล่งอ้างอิง วิธีวิจัย และข้อจำกัดของงาน
3. **`inspirational` (ผู้ฟังสายสร้างแรงบันดาลใจ)**:
   - บุคลิก: เป็นกันเอง ให้กำลังใจ ชื่นชมจุดเด่น และเสนอประโยคเปรียบเทียบ (Analogy) หรือวิธีเล่าเรื่อง (Storytelling) ให้ทัชใจผู้ฟังมากขึ้น
