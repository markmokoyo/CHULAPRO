# 04. การออกแบบ Mobile App — Android & Wear OS (Phase 2)

เอกสารนี้วางแผนสถาปัตยกรรมสำหรับ **Phase 2** เมื่อเวอร์ชัน Web App (Phase 1) ผ่านการทดสอบอัลกอริทึมและ UX เรียบร้อยแล้ว โดยจะย้ายตรรกะจาก `packages/shared` มาทำงานแบบ **100% On-Device Edge AI** บน Android และส่งสัญญาณสั่นจริงไปยังสมาร์ทวอทช์ Wear OS

---

## 1. Tech Stack สำหรับ Android & Wear OS

| ส่วนประกอบ | เทคโนโลยี / ไลบรารี | บทบาท |
| :--- | :--- | :--- |
| **UI & App** | Kotlin + Jetpack Compose + Compose for Wear OS | พัฒนาแอปมือถือและแอปนาฬิกาในโปรเจกต์ Multi-module |
| **Camera** | Android CameraX (`720p`, `12–15 FPS`) | ส่งภาพเข้า MediaPipe โดยควบคุมความร้อนและแบตเตอรี่ |
| **Vision AI** | MediaPipe Tasks Vision SDK (GPU Delegate) | Pose (33), Face (478), Hand (21) Landmarkers แบบออฟไลน์ |
| **Speech & Diarization** | Sherpa-ONNX Android (`zipformer-thai-2024-06-20`) | ถอดเสียงภาษาไทยออฟไลน์ + VAD + Speaker Diarization ในโหมดทีม |
| **Watch Communication** | Wear OS `MessageClient` API + `VibrationEffect` | ส่งสัญญาณสั่นความหน่วงต่ำจากมือถือไปนาฬิกา |
| **Slide & Storage** | PdfBox-Android + Room Database | สกัดข้อความ PDF บนเครื่องและ Cache แผนจาก Gemini |
| **Cloud AI & TTS** | Gemini API + Android Native TTS (`th-TH`) | วางแผนสไลด์, AI Audience Sparring และอ่านออกเสียงภาษาไทย |

---

## 2. โครงสร้างโมดูล Android (`apps/android` & `apps/wear`)

```text
apps/
├── android/ (Mobile App)
│   ├── core/domain/          # Port สูตร Scoring, Cooldown (20s), Data Models จาก Phase 1
│   ├── core/database/        # Room Entities & DAOs (PresentationPlan, SessionReport)
│   ├── feature/planner/      # PdfBox-Android + Gemini Client
│   ├── feature/vision/       # CameraX + MediaPipe Holistic/Pose/Face/Hand
│   ├── feature/audio/        # AudioRecord 16kHz + Sherpa-ONNX + Acoustic Filler
│   ├── feature/team/         # Voice Enrollment (5s) + Speaker Diarization + Lip-Sync
│   ├── feature/audience/     # Gemini Sparring + Android TTS (th-TH)
│   └── data/wear-bridge/     # Wear OS MessageClient Sender
└── wear/ (Wear OS App)
    ├── service/              # WearableListenerService รับ HapticCueEvent
    └── haptic/               # VibrationEffect Builder (80ms / 100ms×2 / 300ms)
```

---

## 3. สเปคการสั่นเตือนบน Wear OS (Haptic Mapping)

| `HapticPatternType` | `VibrationEffect` API | ความหมาย |
| :--- | :--- | :--- |
| `SOFT_TICK` | `createOneShot(80, 120)` | เตือนคำฟุ่มเฟือย ("อืม/อ่า") |
| `DOUBLE_PULSE` | `createWaveform([0, 100, 80, 100], [0, 180, 0, 180], -1)` | เตือนพูดเร็วเกินไป หรือละสายตา > 5 วิ |
| `GENTLE_WAVE` | `createOneShot(300, 150)` | เตือนท่าทางห่อไหล่/กอดอก หรือใกล้หมดเวลาสไลด์ |

---

## 4. แผนการเทรน Custom Micro-Models (`ml/`)

เพื่อยกระดับความแม่นยำเหนือกว่ากฎคณิตศาสตร์พื้นฐานใน Phase 1 ให้พัฒนาโมเดลขนาดเล็กรันบนอุปกรณ์ใน Phase 2 ดังนี้:

1. **Thai Filler Audio Net (`< 300 KB`, INT8 LiteRT)**:
   - เก็บข้อมูลเสียง 1.0 วินาที (16kHz) 4 คลาส × 500 ตัวอย่าง ("อืม/อ่า/เอ่อ", คำสระยาวปกติ เช่น "อ่าน/อา", ประโยคพูดทั่วไป, เสียงรบกวน)
   - สกัด Librosa MFCC 40 มิติ + Pitch → เทรน 1D Depthwise Separable CNN
2. **Temporal Posture Net (`< 500 KB`, ONNX Runtime Mobile / LiteRT)**:
   - ใช้พิกัด Pose (33) + Hand (42) แบบ Sliding Window 30 เฟรม (2 วินาที @ 15 FPS)
   - เทรน TCN หรือ Bi-LSTM จับอาการโยกตัว (Body Swaying) และบีบมือต่อเนื่อง
3. **Custom Hand Gesture Recognizer**:
   - ใช้ MediaPipe Model Maker Gesture Recognizer แยกแยะภาษามือเปิด (Open Gesture) กับท่ากุมมือแน่น
4. **Slide-Aware Hotword ASR**:
   - ใช้ Custom Lexicon Boosting ของ Sherpa-ONNX Zipformer Thai จาก `technicalHotwords` ที่สกัดได้จากสไลด์
   - (ทางเลือกหลังซ้อม) ใช้ LoRA บน `nectec/Pathumma-whisper-th-large-v3` สำหรับถอดเสียงละเอียด

---

## 5. UI/UX & Brand Theme Specification (Chula Pastel Pink & White + Phra Kiao Emblem + Mobile & Wear OS Responsive Design)

เพื่อให้ประสบการณ์ของ **Phase 2 (Android & Wear OS)** สอดคล้องเป็นหนึ่งเดียวกับ Phase 1 Web App ทั้งด้านความสวยงาม อัตลักษณ์จุฬาฯ และหลักสรีรศาสตร์การมองระหว่างพูด ต้องใช้ระบบธีม **Chula Pastel Pink & White** ร่วมกับ Material 3 และ Wear OS Compose ดังนี้

### 5.1 Material 3 Color Tokens (`CuePulseTheme`)
กำหนดใน `apps/android/app/src/main/java/.../ui/theme/Color.kt` โดยอ้างอิงชุดสีเดียวกับ Web App:

| Material 3 Role | Hex Code | การใช้งานบน Android (Jetpack Compose) |
| :--- | :--- | :--- |
| `background` | `#FFF9FB` | พื้นหลังหน้าหลักและหน้าซ้อม |
| `surface` / `surfaceContainerLowest` | `#FFFFFF` | Cards, TopAppBar, BottomSheet, Dialogs |
| `surfaceVariant` / `primaryContainer` | `#FFE5EC` | Suggestion chips, Keyword pills, Active bottom nav indicator |
| `outlineVariant` | `#F5DCE0` / `#FFC2D1` | Card borders, Dividers, Input outlines |
| `secondaryContainer` | `#FFB3C6` / `#FFD4D4` / `#F7C8E0` | Status highlights, Warm gradient cards, Empty states |
| `secondary` | `#FF8FAB` / `#E98EAD` | MediaPipe Landmarks overlay, Secondary metrics, Chart bars |
| `primary` | `#FF597B` | Primary `Button` (`เริ่มซ้อม`, `บันทึก`), FAB, Pose skeleton overlay |
| `primaryVariant` / `pressed` | `#FB6F92` | Ripple / Pressed state ของปุ่มหลัก |
| `tertiary` | `#E18AAA` | Score overview gradient end, Secondary progress gauges |
| `onSurface` / `onBackground` | `#2D1B24` | ข้อความหลักความคมชัดสูงบนพื้นขาว/ชมพูอ่อน |

### 5.2 ตราสัญลักษณ์พระเกี้ยว (Phra Kiao Emblem)
- **Resource**: นำเข้าไฟล์โลโก้เป็น `res/drawable/logo_chula.jpg` (และ `ic_chula_badge` สำหรับ Adaptive Card Header)
- **ตำแหน่งที่แสดง**:
  - **Splash / Onboarding & Dashboard Header Card**: แสดงโลโก้พระเกี้ยวในกรอบวงกลม/สี่เหลี่ยมมุมมนสี `#FFFFFF` ขอบ `#FFC2D1` เพื่อรักษาความคมชัดของสีทองและชมพูในตราพระเกี้ยว
  - **TopAppBar**: แสดงตราสัญลักษณ์ขนาดกะทัดรัด (32–36dp) คู่ชื่อ `CuePulse AI`

### 5.3 Multi-Device Responsive Layouts (`WindowSizeClass` + Wear OS)
| อุปกรณ์ / ขนาดหน้าจอ | โครงสร้างหน้าจอและการนำทาง (Compose Adaptive Layout) |
| :--- | :--- |
| **Phone Portrait (`WindowWidthSizeClass.Compact`)** | ใช้ `Scaffold` + `NavigationBar` (Bottom Tab Bar: หน้าแรก, วางแผนสไลด์, ซ้อมเดี่ยว, ซ้อมทีม) หน้าซ้อมวาง Camera Preview + Floating Live Telemetry ด้านบน และ Teleprompter / AI Audience Sheet เลื่อนได้ด้านล่าง พร้อมปุ่มหลักสูง >= 48dp |
| **Phone Landscape / Foldable / Tablet (`Medium` & `Expanded`)** | เปลี่ยนจาก Bottom Bar เป็น `NavigationRail` ด้านซ้าย หน้าซ้อมแบ่ง **Two-Pane Layout** (ซ้าย ~55%: CameraX Preview + Pose/Face Pink Overlay + Live SPM/Eye/Filler Gauges; ขวา ~45%: Teleprompter + AI Audience Q&A + Haptic Cooldown Status) |
| **Wear OS (Circular Screen / `apps/wear`)** | ออกแบบด้วย `Compose for Wear OS` + `ScalingLazyColumn` สำหรับหน้าประวัติ/ตั้งค่า และหน้าซ้อมแบบ Glanceable Circular Ring: พื้นหลังสะอาดอ่านง่ายแม้มองหางตา, วงแหวนสถานะสี `#FF597B` (Alert/Pace), `#E18AAA` (Cooldown Countdown 20s), และ `#FF8FAB` (Normal Flow) พร้อมตัวเลข SPM ขนาดใหญ่กลางหน้าปัด |
