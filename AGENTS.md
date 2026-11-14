# AGENTS.md — คู่มือการทำงานร่วมกันของ AI Agents

เอกสารนี้กำหนดกติกา โครงสร้างบทบาท และมาตรฐานการสื่อสารสำหรับ AI Agents ที่ทำงานร่วมกันในโปรเจกต์ **CuePulse AI** ทั้งใน Phase 1 (Web App) และ Phase 2 (Android & Wear OS)

---

## 1. กฎเหล็กของการทำงานร่วมกัน (Core Rules for All Agents)

1. **Web-First, Contract-Driven**:
   - ปัจจุบันโปรเจกต์อยู่ใน **Phase 1 (Web App)** ห้ามสร้างโค้ด Android/Kotlin ก่อนได้รับคำสั่งเปลี่ยน Phase เว้นแต่เป็นการอัปเดตเอกสารสเปค
   - ทุกฟีเจอร์ที่สร้างบน Web App ต้องยึด **Data Contracts และ Scoring Formulas** ใน [docs/02-shared-architecture-and-contracts.md](docs/02-shared-architecture-and-contracts.md) เป็นหลัก เพื่อให้ Phase 2 (Android) นำตรรกะเดียวกันไปใช้ได้ทันทีโดยไม่ต้องออกแบบใหม่
2. **Single Source of Truth**:
   - ห้ามฮาร์ดโค้ด Schema, Prompt หรือเกณฑ์คะแนนแยกกันเองในหลายไฟล์ ให้เก็บไว้ที่ `shared/` (หรือกำหนดใน `docs/02-shared-architecture-and-contracts.md` ก่อนเขียนโค้ด)
3. **Thai Language First**:
   - ระบบตรวจจับคำฟุ่มเฟือย, ตัวนับพยางค์ (180–220 SPM), และ AI ผู้ฟังจำลอง ต้องรองรับภาษาไทยและคำทับศัพท์ภาษาอังกฤษ (Code-Switching) เป็นลำดับแรก
4. **Non-Intrusive Feedback Principle**:
   - ระบบแจ้งเตือนระหว่างพูด (ทั้ง Haptic Simulator บนเว็บ และ Wear OS บนมือถือ) ต้องมี **Cooldown อย่างน้อย 20 วินาที** เสมอ เพื่อไม่ให้ผู้พูดเกิดความตื่นตระหนก (Anxiety Loop)
5. **Update Task Status**:
   - เมื่อ Agent ทำงานชิ้นใดเสร็จ ให้กลับมาอัปเดตสถานะ `[x]` ใน [docs/05-roadmap-and-tasks.md](docs/05-roadmap-and-tasks.md) พร้อมระบุไฟล์ที่สร้าง/แก้ไข

---

## 2. บทบาทของ AI Agents (Agent Roster)

เมื่อแบ่งงานให้ Subagents หรือ Swarm ให้มอบหมายตามบทบาทดังนี้:

| Agent Role | ขอบเขตความรับผิดชอบ | ไฟล์/โฟลเดอร์ที่ดูแล |
| :--- | :--- | :--- |
| **Architect / Coordinator** | วางแผน แตกงาน ตรวจสอบความสอดคล้องของ Shared Contracts และรีวิว PR/Diff | `README.md`, `AGENTS.md`, `docs/*` |
| **Web Frontend Agent** | พัฒนา UI/UX ด้วย Next.js + React + Tailwind, หน้าจอซ้อม, Simulated Smartwatch HUD, กราฟรายงานผล | `apps/web/src/app/**`, `apps/web/src/components/**` |
| **Web Vision & Audio Agent** | พัฒนา MediaPipe Web (Pose/Face/Hand), Web Audio API (16kHz PCM, Acoustic Filler, SPM), Speaker/Lip-sync บนเว็บ | `apps/web/src/engines/**` |
| **AI & Prompt Agent** | พัฒนา Slide Parser (PDF/PPTX), Gemini API Integration (Planner + AI Audience Sparring), Prompt Engineering, Shared Schemas | `packages/shared/**`, `apps/web/src/services/ai/**` |
| **Mobile & Wear OS Agent** *(Phase 2)* | พัฒนา Android (Kotlin/Compose), CameraX, Sherpa-ONNX Android, Wear OS Data Layer + Haptics | `apps/android/**`, `apps/wear/**` |
| **ML Training Agent** *(Phase 2)* | เตรียม Dataset และเทรน Micro-Models (Thai Filler Net, Temporal Posture Net, Gesture, LoRA ASR) | `ml/**` |
| **QA / Verification Agent** | เขียนและรัน Unit Tests (Scoring, Filler Rules, Cooldown), E2E Flow, ตรวจสอบ TypeScript/Lint/Build | `**/*.test.*`, `tests/**` |

---

## 3. โครงสร้างโฟลเดอร์มาตรฐาน (Recommended Monorepo Layout)

```text
CHULAPROJECT/
├── README.md
├── AGENTS.md
├── docs/
│   ├── 01-project-overview.md
│   ├── 02-shared-architecture-and-contracts.md
│   ├── 03-web-app-design.md
│   ├── 04-mobile-app-design.md
│   └── 05-roadmap-and-tasks.md
├── packages/
│   └── shared/                 # TypeScript types, scoring rules, prompts, constants (ใช้ร่วมกัน)
├── apps/
│   ├── web/                    # Phase 1: Next.js Web Application
│   ├── android/                # Phase 2: Kotlin + Jetpack Compose (สร้างเมื่อเข้า Phase 2)
│   └── wear/                   # Phase 2: Compose for Wear OS (สร้างเมื่อเข้า Phase 2)
└── ml/                         # Phase 2: Python scripts สำหรับเทรน Micro-models
```

---

## 4. ขั้นตอนการส่งต่องานระหว่าง Agent (Handoff Protocol)

1. **ก่อนเริ่มงาน**: อ่าน `docs/02-shared-architecture-and-contracts.md` และส่วนที่เกี่ยวข้องใน `docs/03-web-app-design.md` (หรือ `04`)
2. **ระหว่างทำงาน**:
   - หากต้องเพิ่ม field ใหม่ใน JSON Schema (เช่น `SessionReport` หรือ `HapticCue`) ต้องอัปเดตใน `docs/02-shared-architecture-and-contracts.md` และ `packages/shared/` ก่อน
   - ห้ามแก้ไฟล์นอกขอบเขตที่ได้รับมอบหมายโดยไม่จำเป็น
3. **หลังจบงาน**:
   - รันคำสั่งตรวจสอบ (`npm run lint`, `npm run typecheck`, `npm test` หรือ `npm run build`)
   - สรุปผลลัพธ์เป็นรายการ: (1) สิ่งที่ทำเสร็จ, (2) ไฟล์ที่เปลี่ยน, (3) ผลทดสอบที่รันจริง, (4) สิ่งที่ Agent ถัดไปต้องทำต่อ
