# 05. แผนการดำเนินงานและ Task Backlog (Roadmap & Tasks)

เอกสารนี้แบ่งงานออกเป็น **Phase 1 (Web App — ทำก่อน)** และ **Phase 2 (Android & Wear OS — ทำทีหลัง)** เพื่อให้ AI Agents สามารถหยิบงานไปทำแบบขนานและตรวจสอบ Acceptance Criteria ร่วมกันได้

---

## Phase 1: Web App Development (Active)

### Milestone 1.1: Project Setup & Shared Core
- [x] **T1.1.1** `[Architect]` ตั้งค่า Monorepo (`package.json` workspaces) + `packages/shared` + `apps/web` (Next.js App Router, TypeScript, Tailwind CSS)
- [x] **T1.1.2** `[AI & Prompt]` สร้าง TypeScript interfaces ใน `packages/shared/src/types.ts` ตาม [docs/02-shared-architecture-and-contracts.md](02-shared-architecture-and-contracts.md)
- [x] **T1.1.3** `[AI & Prompt]` สร้าง Scoring Engine (`calculateOverallScore`, `calculatePacingScore`, `CooldownManager` 20 วินาที) ใน `packages/shared/src/scoring.ts` พร้อม Unit Tests (`packages/shared/src/scoring.test.ts` — รอติดตั้ง Node.js เพื่อรัน `npm test`)

### Milestone 1.2: Slide Upload & AI Presentation Planner
- [x] **T1.2.1** `[AI & Prompt]` สร้าง `apps/web/src/services/slideParser.ts` สำหรับสกัดข้อความจาก `.pdf` (`pdfjs-dist`) และ `.pptx` (`jszip`)
- [x] **T1.2.2** `[AI & Prompt]` สร้าง API Route `POST /api/plan` (`apps/web/src/app/api/plan/route.ts`) เชื่อมต่อ Gemini API (`gemini-2.5-flash`) พร้อม Offline Fallback
- [x] **T1.2.3** `[Web Frontend]` สร้างหน้า `/planner` (`apps/web/src/app/planner/page.tsx`) พร้อมระบบบันทึกใน `localStorage`

### Milestone 1.3: Solo Practice Studio (Vision + Audio + Simulated Watch HUD)
- [x] **T1.3.1** `[Web Vision & Audio]` สร้าง `apps/web/src/engines/vision/mediapipeRunner.ts` โหลด `@mediapipe/tasks-vision` (Pose, Face, Hand) ที่ `12 FPS`
- [x] **T1.3.2** `[Web Vision & Audio]` สร้าง `apps/web/src/engines/vision/postureGeometry.ts` (Baseline 3 วินาที, Slouch, ArmsCrossed, Swaying, Eye Contact Ratio)
- [x] **T1.3.3** `[Web Vision & Audio]` สร้าง `apps/web/src/engines/audio/audioAnalyzer.ts` (`16kHz` PCM, Pitch F0, Silence gap, SPM) และ `speechRecognition.ts` (`th-TH` Lexical Fillers)
- [x] **T1.3.4** `[Web Frontend]` สร้าง `apps/web/src/components/studio/WatchSimulatorHUD.tsx` (3 Patterns + Cooldown 20s + `navigator.vibrate()`)
- [x] **T1.3.5** `[Web Frontend]` ประกอบหน้า `/practice/solo` (`apps/web/src/app/practice/solo/page.tsx`)

### Milestone 1.4: AI Audience Sparring & Analytics Report
- [x] **T1.4.1** `[AI & Prompt]` สร้าง `POST /api/audience` (`apps/web/src/app/api/audience/route.ts`) รองรับ 3 Personas (`judge`, `advisor`, `inspirational`)
- [x] **T1.4.2** `[Web Frontend]` สร้าง `apps/web/src/components/studio/AudiencePanel.tsx` พร้อม Web Speech Synthesis (`th-TH`)
- [x] **T1.4.3** `[Web Frontend]` สร้างหน้า `/report/[id]` (`apps/web/src/app/report/[id]/page.tsx`) และ Components (`ScoreOverview`, `TimelineChart`, `TeamBreakdown`)

### Milestone 1.5: Isolated Team Analysis Mode (Web)
- [x] **T1.5.1** `[Web Vision & Audio]` สร้าง `apps/web/src/engines/vision/lipSyncTracker.ts` รองรับหลายใบหน้า (2–5 คน)
- [x] **T1.5.2** `[Web Frontend]` สร้างหน้า `/practice/team` (`apps/web/src/app/practice/team/page.tsx`)

### Milestone 1.6: Web QA & Stabilization
- [ ] **T1.6.1** `[QA]` ติดตั้ง Dependencies (`npm install`) และทดสอบ E2E Flow บนเบราว์เซอร์จริง
- [ ] **T1.6.2** `[QA]` รัน `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` ให้ผ่าน 100%

### Milestone 1.7: Editorial UI Polish, Slide Visuals, Speaker Scripts & Slide-Free Analysis
- [x] **T1.7.1** `[Architect & AI]` อัปเดต `docs/02-shared-architecture-and-contracts.md`, `packages/shared/src/types.ts`, `packages/shared/src/prompts.ts`, `packages/shared/src/scoring.ts` รองรับภาพสไลด์ (`imageDataUrl`), สคริปต์คำพูด (`speakerScript`), และผลวิเคราะห์คำพูดอิสระ (`SpeechContentAnalysis`)
- [x] **T1.7.2** `[Web Frontend]` ปรับดีไซน์ Editorial Studio ไร้ Emoji พร้อมภาพประกอบ SVG (`apps/web/public/images/*`) และจัดหน้าต่างแบบแท็บไม่รกใน `/`, `/planner`, `/practice/solo`, `/practice/team`, `/report/[id]`
- [x] **T1.7.3** `[AI & Prompt]` เพิ่มการเรนเดอร์ภาพสไลด์ 16:9 ใน `slideParser.ts` + ปุ่มซ่อน/แสดงรูปสไลด์ + แก้ไขสคริปต์พูดใน `SlideTeleprompter.tsx` & `/planner` และโหมดวิเคราะห์คำพูดอัตโนมัติเมื่อไม่ได้เพิ่มสไลด์ (`POST /api/audience` `speech_analysis`)

---

## Phase 2: Native Mobile App — Android & Wear OS (Upcoming)

> **เงื่อนไขเริ่ม Phase 2**: Milestone 1.1 – 1.6 ของ Web App ต้องเสร็จสมบูรณ์และผ่าน QA แล้ว

### Milestone 2.1: Android & Wear OS Foundation
- [ ] **T2.1.1** `[Mobile]` สร้างโปรเจกต์ Kotlin + Jetpack Compose + Compose for Wear OS พร้อม Port `packages/shared` เป็น `core/domain`
- [ ] **T2.1.2** `[Mobile]` ตั้งค่า Room Database และ PdfBox-Android + Gemini API Slide Planner

### Milestone 2.2: On-Device Edge AI & Wear OS Haptics
- [ ] **T2.2.1** `[Mobile]` ผสาน CameraX (720p @ 12–15 FPS) + MediaPipe Android (GPU Delegate)
- [ ] **T2.2.2** `[Mobile]` ผสาน `AudioRecord` 16kHz + Sherpa-ONNX (`zipformer-thai-2024-06-20`) + Hotwords จากสไลด์
- [ ] **T2.2.3** `[Mobile]` พัฒนา Wear OS `MessageClient` + `VibrationEffect` (80ms / 100ms×2 / 300ms) + Cooldown 20s
- [ ] **T2.2.4** `[Mobile]` พัฒนา Team Mode ด้วย Sherpa-ONNX Speaker Diarization + Lip-Sync + Android Native TTS (`th-TH`)

### Milestone 2.3: Custom Micro-Models Training (`ml/`)
- [ ] **T2.3.1** `[ML]` เก็บข้อมูลและเทรน **Thai Filler Audio Net** (MFCC 40 + 1D Depthwise CNN INT8 < 300 KB → LiteRT)
- [ ] **T2.3.2** `[ML]` เทรน **Temporal Posture Net** (30-frame window TCN/Bi-LSTM < 500 KB → LiteRT/ONNX)
- [ ] **T2.3.3** `[ML]` เทรน **Custom Hand Gesture Recognizer** (MediaPipe Model Maker) และ **Slide-Aware Hotword / LoRA Whisper**
