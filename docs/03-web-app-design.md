# 03. การออกแบบ Web App (Phase 1 — Active)

เอกสารนี้ออกแบบ **CuePulse AI Web App** เพื่อใช้เป็นเวอร์ชันเริ่มต้น (Phase 1) สำหรับการฝึกซ้อมผ่านเบราว์เซอร์บนคอมพิวเตอร์/โน้ตบุ๊ก และใช้ทดสอบอัลกอริทึม AI, Data Contracts และ UX ก่อนนำไปสร้างเป็นแอป Android & Wear OS จริงใน Phase 2

---

## 1. Tech Stack สำหรับ Web App

| ส่วนประกอบ | เทคโนโลยีที่เลือกใช้ | เหตุผล |
| :--- | :--- | :--- |
| **Framework & UI** | Next.js (App Router) + TypeScript + Tailwind CSS | พัฒนาเร็ว รองรับ API Routes สำหรับซ่อน Gemini API Key |
| **Computer Vision** | `@mediapipe/tasks-vision` (WebGL / WASM) | รัน Pose (33 จุด), Face (478 จุด + Iris), Hand (21 จุด) ในเบราว์เซอร์ได้ทันทีที่ 12–15 FPS |
| **Audio & Prosody** | Web Audio API (`16kHz` PCM) + `AudioWorklet` | วิเคราะห์ Pitch (F0), Silence Gap (`150 ms`), และพลังงานเสียง (SPM) แบบ Zero-latency |
| **Thai ASR (Web)** | Web Speech API (`th-TH`) / Sherpa-ONNX WASM (Optional) | ถอดเสียงภาษาไทยแบบฟรีในเบราว์เซอร์เพื่อจับ Lexical Fillers และคำศัพท์ |
| **Slide Parser** | `pdfjs-dist` (PDF) + `jszip` (PPTX XML Extractor) | สกัดข้อความรายสไลด์บน Client เพื่อลด Token ก่อนส่ง Gemini |
| **Cloud AI** | `@google/genai` (ผ่าน Next.js Route Handlers `/api/*`) | สร้าง Presentation Plan และ AI Audience Sparring |
| **Thai TTS** | Web Speech Synthesis API (`th-TH`) | อ่านคำถามจาก AI ผู้ฟังเป็นเสียงภาษาไทยได้ทันทีโดยไม่เสียค่าใช้จ่าย |
| **Persistence** | IndexedDB (`idb`) / `localStorage` | เก็บประวัติการซ้อม แผนสไลด์ และ Cache ผล Gemini บนเครื่องผู้ใช้ |

---

## 2. การแปลงฟีเจอร์ฮาร์ดแวร์สู่หน้าเว็บ (Web Adaptation Design)

เนื่องจากเว็บเบราว์เซอร์บนคอมพิวเตอร์ไม่มีสมาร์ทวอทช์ Wear OS เชื่อมต่อโดยตรง จึงออกแบบการจำลองและปรับใช้ดังนี้:

1. **Simulated Smartwatch Haptic HUD (นาฬิกาจำลองบนหน้าจอ)**:
   - แสดงเป็น Widget หน้าปัดนาฬิกาทรงกลมมุมขวาล่างของหน้าซ้อม
   - เมื่อเกิด `HapticCueEvent` หน้าปัดจะสั่นแอนิเมชัน + เปลี่ยนสีขอบตาม Pattern:
     - `SOFT_TICK` (สีฟ้า, สั่นสั้น 1 จังหวะ): เตือนคำฟุ่มเฟือย
     - `DOUBLE_PULSE` (สีส้ม, กะพริบ 2 จังหวะ): เตือนพูดเร็วหรือหลบสายตา
     - `GENTLE_WAVE` (สีม่วง, คลื่นนุ่มนวล): เตือนท่าทางหรือเวลาสไลด์ใกล้หมด
   - แสดง **วงแหวน Cooldown 20 วินาที** รอบหน้าปัดเพื่อให้ผู้ทดสอบเห็นการทำงานของ Cooldown State Machine ชัดเจน
   - *โบนัส*: หากเปิดเว็บผ่าน Chrome บนมือถือ Android จะเรียก `navigator.vibrate([80])` / `[100, 60, 100]` / `[300]` ให้สั่นจริงด้วย
2. **Baseline Calibration (ปรับเทียบท่าทาง 3 วินาที)**:
   - ก่อนเริ่มซ้อม ให้ผู้พูดยืน/นั่งในท่าปกติหน้าเว็บแคม 3 วินาที เพื่อเก็บค่า Baseline ของระยะไหล่-หู และมุมศีรษะ

---

## 3. โครงสร้างหน้าจอและ Routing (Pages & UX Flow)

| Route | ชื่อหน้าจอ | หน้าที่หลัก |
| :--- | :--- | :--- |
| `/` | **Dashboard & Quick Start** | เลือกโหมด (Solo / Team), ดูสถิติย้อนหลัง, ปุ่มอัปโหลดสไลด์ด่วน |
| `/planner` | **Slide Upload & AI Planner** | อัปโหลด `.pdf`/`.pptx`, ตั้งเวลา & ความเป็นทางการ, แก้ไข Pacing Budget ต่อสไลด์, ดู Opening Hook & Hotwords |
| `/practice/solo` | **Solo Practice Studio** | กล้อง + MediaPipe Skeleton Overlay (เปิด/ปิดได้), สไลด์ปัจจุบัน + ตัวนับเวลา, Live SPM Meter, Simulated Watch HUD, ปุ่มเลือก AI Audience Persona |
| `/practice/team` | **Team Practice Studio** | ขั้นตอน 1: ลงทะเบียนสมาชิก 2–5 คน (ชื่อ + สไลด์ที่รับผิดชอบ + ทดสอบเสียง/หน้า 5 วิ) → ขั้นตอน 2: ซ้อมร่วมกันพร้อม Tag ระบุผู้พูดปัจจุบันบนหน้าจอ |
| `/report/[id]` | **Analytics & AI Review** | คะแนนรวม 0–100, กราฟ Timeline คำฟุ่มเฟือย/ความเร็ว/Eye Contact, Transcript พร้อม Highlight คำติดปาก, Q&A Sparring ย้อนหลัง (และรายงานแยกแต่ละคนสำหรับ Team Mode) |

---

## 4. โครงสร้างโค้ดฝั่ง Web (`apps/web/src/`)

```text
apps/web/src/
├── app/
│   ├── api/
│   │   ├── plan/route.ts         # เรียก Gemini API สร้าง PresentationPlan
│   │   └── audience/route.ts     # เรียก Gemini API จำลองคำถาม AI Audience
│   ├── planner/page.tsx
│   ├── practice/
│   │   ├── solo/page.tsx
│   │   └── team/page.tsx
│   └── report/[id]/page.tsx
├── components/
│   ├── studio/
│   │   ├── CameraCanvas.tsx      # วาดวิดีโอ + MediaPipe Landmarks
│   │   ├── WatchSimulatorHUD.tsx # หน้าปัด Wear OS จำลอง + Cooldown Ring
│   │   ├── SlideTeleprompter.tsx # แสดงสไลด์ + เวลาที่เหลือ + Key Points
│   │   └── AudiencePanel.tsx     # แชท/เสียงโต้ตอบของ AI ผู้ฟัง
│   └── report/
│       ├── ScoreOverview.tsx
│       ├── TimelineChart.tsx
│       └── TeamBreakdown.tsx
├── engines/
│   ├── vision/
│   │   ├── mediapipeRunner.ts    # โหลด Pose/Face/Hand Landmarker @ 12-15 FPS
│   │   ├── postureGeometry.ts    # สูตรคำนวณ Slouch, ArmsCrossed, EyeContact
│   │   └── lipSyncTracker.ts     # ตรวจจับการขยับปากสำหรับ Team Mode
│   ├── audio/
│   │   ├── audioCapture.ts       # Web Audio 16kHz PCM + VAD
│   │   ├── acousticFiller.ts     # Pitch (F0) stability + 150ms silence gap
│   │   ├── spmCounter.ts         # นับพยางค์จาก Energy Peaks
│   │   └── speechRecognition.ts  # Web Speech API (th-TH) + Lexical Filler
│   └── haptic/
│       └── cooldownManager.ts    # 20s Cooldown State Machine
└── services/
    ├── slideParser.ts            # PDF.js & JSZip PPTX extractor
    └── storage.ts                # IndexedDB persistence
```

---

## 5. แผน API Routes (Backend-for-Frontend)

1. `POST /api/plan`
   - **Input**: `{ fileName, totalDurationSeconds, formality, slides: [{ slideNumber, extractedText }] }`
   - **Process**: เรียก `gemini-2.5-flash` ด้วย `responseMimeType: "application/json"` ตาม Schema `PresentationPlan`
   - **Safety**: จำกัดความยาว Text ต่อสไลด์ไม่เกิน 1,500 ตัวอักษร เพื่อป้องกัน Rate Limit
2. `POST /api/audience`
   - **Input**: `{ personaId, slideContext, recentTranscript, mode: 'interruption' | 'qa_challenge' }`
   - **Output**: `{ questionTh, suggestedAnalogy, followUpTip }`

---

## 6. UI/UX & Brand Theme Specification (Chula Pastel Pink & White + Phra Kiao Emblem + Multi-Device Responsive Design)

Phase 1 (Web App) ใช้ธีม **Chula Pastel Pink & White** ที่สว่าง สะอาดตา เป็นมิตร และสื่อถึงอัตลักษณ์จุฬาฯ พร้อมตราสัญลักษณ์พระเกี้ยว เพื่อให้ผู้ใช้งานทุกอุปกรณ์รู้สึกมั่นใจและผ่อนคลายขณะซ้อมพูด

### 6.1 ระบบสีมาตรฐาน (Chula Pastel Pink & White Palette)
กำหนดไว้ใน `apps/web/tailwind.config.ts` (`theme.extend.colors.chula`) และ `apps/web/src/app/globals.css`:

| Token / บทบาท | Hex Code | การใช้งานหลัก |
| :--- | :--- | :--- |
| **Background Surface** | `#FFEFF4` | พื้นหลังหลักของทั้งแอป (`bg-[#FFEFF4]`), Light color-scheme |
| **Card Surface** | `#FFFFFF` | การ์ดเนื้อหา, Navbar, Watch HUD, Teleprompter, Dropdowns |
| **Soft Tint / Pill** | `#FFD1DF` / `#FFE0EA` | พื้นหลัง Badge, Emphasized keyword pills, Hover states |
| **Pastel Border** | `#F2C4D0` / `#FF9EB8` | เส้นขอบการ์ด, เส้นแบ่งส่วน, Hover borders |
| **Soft Pastel Pink** | `#FF8FAB` / `#FFC7CF` / `#F2B5D4` | Status highlights, Empty states, Gradient accents, Soft badges |
| **Secondary Accent** | `#FB6F92` | MediaPipe joint dots, Secondary chart bars, Cooldown progress |
| **Hover / Mid Pink** | `#E13C6C` | Hover state ของปุ่มหลัก, Active tab highlights |
| **Primary CTA (Chula Coral Pink)** | `#EC3D6A` | ปุ่มหลัก (`เริ่มซ้อมเดี่ยว`, `บันทึก`, `เปิดไมค์ถามผู้ฟัง`), Pose skeleton overlay, Active indicator dots |
| **Tertiary Mauve Pink** | `#CC6B92` | Secondary metrics, Score gradient end, Quota progress bars |
| **Primary Text** | `#2D1B24` | ข้อความหลักบนพื้นขาว/ชมพูอ่อน เพื่อคง Contrast ชัดเจนอ่านง่าย |

### 6.2 การจัดวางตราสัญลักษณ์พระเกี้ยว (Phra Kiao Emblem)
- **ไฟล์ต้นฉบับ**: `apps/web/public/logo-chula.jpg`
- **Navbar (`apps/web/src/components/Navbar.tsx`)**: แสดงในกรอบขาวขอบชมพูพาสเทล (`#FF9EB8`) คู่กับชื่อแบรนด์ `CuePulse AI` และคำโปรยสั้นบนหัวเว็บ
- **Dashboard Hero (`apps/web/src/app/page.tsx`)**: แสดงตราสัญลักษณ์พระเกี้ยวขนาดเด่นใน Badge สีขาวตัดขอบ `#FFD1DF` ข้างหัวข้อต้อนรับ พร้อมคง Contrast ให้อ่านตัวอักษรภาษาไทยได้คมชัด

### 6.3 กติกา Multi-Device Responsive Design
| Breakpoint / อุปกรณ์ | Layout & Navigation Pattern | Studio & Interactive Elements |
| :--- | :--- | :--- |
| **Mobile (`< 640px`)** | Sticky compact top header (ซ่อนลิงก์ซ้ำ, คงโลโก้ + `AiQuotaBadge`) + **Fixed Bottom Tab Bar** (`sm:hidden fixed bottom-0`) พร้อม padding ด้านล่าง `<main>` (`pb-24`) กันเนื้อหาถูกบัง | การ์ดเรียง 1 คอลัมน์ (`grid-cols-1`), Live Gauges/Audience Mode buttons Stack แนวตั้งหรือปรับเต็มความกว้าง, Touch targets สูงอย่างน้อย 44px |
| **Tablet (`640px–1023px`, `sm:`–`md:`)** | Inline Top Navigation Bar (`hidden sm:flex`) ปิด Bottom Bar, Spacing กลาง (`sm:px-6`) | Metric grids แบบ 2–3 คอลัมน์ (`sm:grid-cols-2`, `sm:grid-cols-3`), การ์ดประวัติซ้อมและกราฟ Report ขยายเต็มพื้นที่อย่างสมดุล |
| **Desktop (`>= 1024px`, `lg:`)** | Wide Workspace สูงสุด `max-w-7xl` พร้อม `lg:px-8` | **Split Studio 12-column**: ฝั่งซ้าย `lg:col-span-7` (Camera Feed + MediaPipe Pink Overlay + Live Telemetry Gauges), ฝั่งขวา `lg:col-span-5` (White Watch Simulator HUD + Slide Teleprompter + AI Audience Sparring Panel) |

### 6.4 Native-App UX/UI & Zero-Lag Micro-Interactions
เพื่อให้เว็บใช้งานลื่นไหลเหมือนแอปพลิเคชันจริงโดยไม่เพิ่มภาระ CPU ระหว่างรัน MediaPipe (15 FPS) และ Web Audio (16kHz PCM):
- **CSS-Only GPU Animations (`apps/web/src/app/globals.css`)**: ใช้เฉพาะ `transform` และ `opacity` (`floatSlow`, `fadeSlideUp`, `watchBuzz`, `.app-card`, `.app-press`) พร้อมรองรับ `@media (prefers-reduced-motion: reduce)` และลาย Dot-matrix พาสเทลแบบ Static
- **App Shell & Navigation (`layout.tsx`, `Navbar.tsx`)**: กำหนด `Viewport` (`themeColor: '#EC3D6A'`) + `appleWebApp`, ปรับเมนูบน Desktop เป็น **Segmented Pill Bar** และบนมือถือเป็น **Floating Glassmorphic Bottom Dock**
- **Interactive Dashboard (`apps/web/src/app/page.tsx`)**: เพิ่ม 3-Step Quick-Start Strip (แสดงสถานะการเตรียมสไลด์และผลซ้อมล่าสุด), แถบความคืบหน้าคะแนนเฉลี่ย/สูงสุด, ปุ่ม **Test Pulse** บนการ์ดสถานะนาฬิกา, และ Segmented Filter (`ทั้งหมด` / `ซ้อมเดี่ยว` / `ซ้อมทีม`)
- **Studio Micro-Interactions (`WatchSimulatorHUD.tsx`, `solo/page.tsx`)**: เพิ่มวงแหวน SVG Progress Ring รอบหน้าปัดนาฬิกาพร้อมปุ่มทดสอบสั่น 3 รูปแบบ (`Soft Tick`, `Double Pulse`, `Gentle Wave` + `navigator.vibrate`), Camera Floating HUD Pills (`LIVE REC • MM:SS` / `สไลด์ X/Y`), และ Live Telemetry Progress Bars + Status Badges
