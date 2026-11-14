# 01. ภาพรวมโครงการ (Project Overview)

## 1. แนวคิดหลัก (Concept)
**CuePulse AI** คือระบบโค้ชฝึกซ้อมการนำเสนอ (Presentation) และการพูดในที่สาธารณะอัจฉริยะ ที่ผสานการประมวลผลเสียงและภาพ (Edge / Browser AI) เข้ากับการแจ้งเตือนแบบไร้เสียง (Silent Bio-Feedback) การจัดแผนการนำเสนอจากไฟล์สไลด์อัตโนมัติ ระบบผู้ฟัง AI จำลองที่โต้ตอบอย่างสร้างสรรค์ และโหมดวิเคราะห์การนำเสนอแบบทีมแยกรายบุคคล

โปรเจกต์ถูกออกแบบให้พัฒนาแบบ **2 ระยะ (Web-First → Mobile Native)**:
- **Phase 1 (Web App)**: ใช้งานผ่านเบราว์เซอร์ได้ทันที เหมาะสำหรับการซ้อมหน้าคอมพิวเตอร์/โน้ตบุ๊ก การทดสอบอัลกอริทึม MediaPipe, ระบบเสียงภาษาไทย, Slide Planner และ AI Audience Sparring โดยจำลองการสั่นของสมาร์ทวอทช์ผ่านหน้าจอ (Simulated Smartwatch Haptic HUD)
- **Phase 2 (Android & Wear OS)**: ยกระดับเป็นแอปพลิเคชันมือถือแบบ On-Device เต็มรูปแบบ พร้อมการส่งสัญญาณสั่นจริงไปยังสมาร์ทวอทช์ Wear OS และโมเดล AI ขนาดเล็กที่เทรนเฉพาะทาง

---

## 2. ปัญหาที่ต้องการแก้ไข (Problem Statement)
1. **วิกฤตความมั่นใจและทักษะการสื่อสาร**: นักศึกษาและวัยทำงานรุ่นใหม่จำนวนมากขาดความมั่นใจเมื่อต้องนำเสนองานจริงต่อหน้าผู้คน
2. **อวัจนภาษาและอาการประหม่าโดยไม่รู้ตัว**: ความตื่นเต้นทำให้ผู้พูดหลบสายตา ยืนห่อไหล่ กอดอก โยกตัว พูดติดขัด ("อืม", "อ่า", "เอ่อ") และพูดรัวเร็วเกินไป ซึ่งผู้พูดมักไม่รู้ตัวขณะซ้อมคนเดียว
3. **ข้อจำกัดของเครื่องมือปัจจุบัน**: แอปฝึกพูดที่มีอยู่ (เช่น Orai, Yoodli, Microsoft Speaker Coach) เน้นภาษาอังกฤษเป็นหลัก ไม่มีโหมดซ้อมทีมหน้ากล้องเดียวแบบแยกรายบุคคล ไม่รองรับการสั่นเตือนไร้เสียงบนสมาร์ทวอทช์ และมักมีค่าใช้จ่ายรายเดือน

---

## 3. โมดูลหลักทั้ง 6 ของระบบ (6 Core Modules)

| โมดูล | หน้าที่หลัก | Phase 1 (Web App) | Phase 2 (Android & Wear OS) |
| :--- | :--- | :--- | :--- |
| **1. Slide Upload & AI Planner** | อัปโหลด `.pdf` / `.pptx` + เวลาที่กำหนด → แบ่งเวลาต่อสไลด์ (Pacing Budget), สร้าง Hook, Transition Phrases, จุดเน้นเสียง | PDF.js / JSZip + Gemini API | PdfBox-Android + Gemini API + Room Cache |
| **2. Real-Time Audio & Prosody** | จับคำฟุ่มเฟือยภาษาไทย ("อืม/อ่า/เอ่อ", "แบบว่า/คือแบบ") และวัดความเร็ว (180–220 พยางค์/นาที) | Web Audio API (16kHz PCM) + Acoustic Detector + Web Speech / WASM | `AudioRecord` + Sherpa-ONNX Zipformer Thai + Custom Filler Net |
| **3. Computer Vision Posture & Gaze** | วิเคราะห์โครงร่าง 33 จุด, ใบหน้า 478 จุด + ม่านตา, มือ 21 จุด เพื่อดู Eye Contact, ไหล่ห่อ, กอดอก, โยกตัว | `@mediapipe/tasks-vision` (WebGL/WASM @ 12–15 FPS) | CameraX + MediaPipe Android + Temporal Posture Net |
| **4. Silent Bio-Feedback (Haptics)** | เตือนเมื่อพูดผิดจังหวะ/ท่าทางเสีย พร้อม **Cooldown 20–30 วินาที** เพื่อไม่ให้เสียสมาธิ | Simulated Watch HUD บนจอ + Soft Audio/Visual Pulse (+ Vibration API บนมือถือเบราว์เซอร์) | Wear OS `MessageClient` + `VibrationEffect` (80ms / 100ms×2 / 300ms) |
| **5. Isolated Team Analysis Mode** | โหมดซ้อมทีม 2–5 คน ลงทะเบียนเสียง/หน้า 5 วินาที แล้วแยกประเมินรายบุคคล + เวลาส่งไม้ต่อ (Handoff) | Face/Lip-Movement Tracking + Voice Enrollment บนเว็บ | Sherpa-ONNX Speaker Diarization + Lip-sync |
| **6. Creative AI Audience Sparring** | จำลองผู้ฟัง 3 บทบาท (กรรมการประกวด / อาจารย์ที่ปรึกษา / ผู้ฟังสายสร้างแรงบันดาลใจ) ถามสดและ Q&A | Gemini API + Web Speech Synthesis (`th-TH`) | Gemini API + Android Native TTS (`th-TH`) |

---

## 4. แผนการรองรับภาษาไทย (Thai Language Support)
1. **Dual-Layer Thai Filler Detection**:
   - *Acoustic Layer*: ตรวจจับเสียงสระลากยาวคงที่เกิน `250 ms` ที่มีช่วงเงียบนำหน้าและตามหลังเกิน `150 ms` เพื่อแยก "อืม/อ่า/เอ่อ" ออกจากคำจริงอย่าง "อา", "อ่าน", "อารมณ์"
   - *Lexical Layer*: ตรวจจับคำติดปากจากข้อความถอดเสียง เช่น `"แบบว่า"`, `"คือแบบ"`, `"อันนี้"`, `"ก็..."`, `"นะฮะ"` เมื่ออยู่ต้นประโยคหรือคั่นด้วยจังหวะหยุดพูด
2. **Thai Syllable-Per-Minute (SPM)**: นับพยางค์จากพลังงานเสียง (Energy Peaks) หรือรูปสระไทยแทนการเว้นวรรค โดยตั้งเกณฑ์มาตรฐานที่ **180–220 พยางค์/นาที**
3. **Code-Switching Support**: ดึงคำศัพท์เฉพาะจากสไลด์มาทำ Prompt/Hotword Boosting เพื่อช่วยให้ถอดเสียงไทยปนศัพท์เทคนิคภาษาอังกฤษได้แม่นยำขึ้น

---

## 5. ข้อจำกัดและแนวทางป้องกัน (Drawbacks & Mitigation)
- **Thermal / CPU Load**: จำกัด Vision FPS ที่ `12–15 FPS` และใช้ VAD (Voice Activity Detection) หยุดประมวลผลเสียงเมื่อเงียบ
- **False Positives ภาษาไทย**: ใช้กฎ 2 ชั้น (Silence Gap + Pitch Stability + Lexical Context)
- **Haptic Overload / Anxiety Loop**: บังคับ Cooldown `20–30 วินาที` ต่อการเตือน และมีสวิตช์ปิด Live Alert เพื่อดูผลหลังซ้อมจบได้
- **Gemini Free Tier Quota**: สกัดเฉพาะข้อความจากสไลด์ก่อนส่ง (ลด Token) และ Cache แผนการนำเสนอไว้ใน Local Storage / IndexedDB (Web) หรือ Room DB (Android)
