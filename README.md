# CuePulse AI — Project Hub

> **ระบบโค้ชฝึกซ้อมการนำเสนอและการพูดในที่สาธารณะอัจฉริยะ (Web App First → Android & Wear OS)**

โปรเจกต์นี้พัฒนาต่อยอดจากแผนงานต้นฉบับ **CuePulse AI** โดยออกแบบสถาปัตยกรรมแบบ **Cross-Platform Shared Core** เพื่อให้สามารถเริ่มสร้าง **Web App (Phase 1)** สำหรับใช้งานและทดสอบอัลกอริทึมได้ทันทีบนเบราว์เซอร์ ก่อนขยายไปสู่ **Native Mobile App บน Android และ Wear OS (Phase 2)** โดยยังคงตรรกะการให้คะแนน โครงสร้างข้อมูล และ AI Prompts ชุดเดียวกัน

---

## ลำดับการพัฒนา (Development Strategy)

| Phase | เป้าหมาย | สถานะ | เอกสารหลัก |
| :--- | :--- | :--- | :--- |
| **Phase 1: Web App** | สร้างเว็บแอปพลิเคชันเต็มรูปแบบ (ฝึกเดี่ยว, สไลด์, กล้อง+ไมค์เรียลไทม์, Simulated Smartwatch Haptic HUD, โหมดทีม, AI ผู้ฟัง) | 🟢 **เริ่มทำก่อน (Active)** | [docs/03-web-app-design.md](docs/03-web-app-design.md) |
| **Phase 2: Mobile App** | พัฒนา Native Android + Wear OS (On-Device Edge AI, สั่นเตือนจริงบนนาฬิกา, Custom Micro-Models) | ⏳ รอต่อยอดจาก Phase 1 | [docs/04-mobile-app-design.md](docs/04-mobile-app-design.md) |

---

## สารบัญเอกสาร (Documentation Map)

| ไฟล์ | เนื้อหาและวัตถุประสงค์ | กลุ่มเป้าหมาย |
| :--- | :--- | :--- |
| [AGENTS.md](AGENTS.md) | กติกาการทำงานร่วมกันของ AI Agents, บทบาทหน้าที่, Protocol การส่งต่อข้อมูล | AI Agents ทุกคน |
| [docs/01-project-overview.md](docs/01-project-overview.md) | แนวคิดหลัก ปัญหา จุดเด่น 6 โมดูล แผนภาษาไทย และแนวทางลดข้อจำกัด | ทุกคน / Product |
| [docs/02-shared-architecture-and-contracts.md](docs/02-shared-architecture-and-contracts.md) | Shared Data Schemas (JSON/TS), สูตรคำนวณคะแนน, Haptic Rules, Gemini Prompts | Web & Mobile Agents |
| [docs/03-web-app-design.md](docs/03-web-app-design.md) | สถาปัตยกรรมและ UX/UI ของ **Web App** (Next.js, MediaPipe Web, Web Audio, WASM/API) | Web Agents |
| [docs/04-mobile-app-design.md](docs/04-mobile-app-design.md) | สถาปัตยกรรมของ **Android & Wear OS** + แผนเทรน Custom Micro-Models 4 ตัว | Mobile & ML Agents |
| [docs/05-roadmap-and-tasks.md](docs/05-roadmap-and-tasks.md) | รายการงาน (Task Backlog) แยกตาม Phase พร้อม Acceptance Criteria | Coordinator & Agents |

---

## แหล่งอ้างอิงต้นฉบับ
- Google Doc ต้นฉบับ: [แผนการพัฒนาแอปพลิเคชัน CuePulse AI (Android & Wear OS)](https://docs.google.com/document/d/1bPLRa6gFDHx3zhruq2BiFJWZuwpPuPasIf5QLZ8Op1Y/edit?usp=sharing)
