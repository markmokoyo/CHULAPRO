import type { AlertReason, AudiencePersonaId, FormalityLevel, HapticPatternType } from './types';

export const SPM_THRESHOLDS = {
  TOO_SLOW: 150,
  OPTIMAL_MIN: 180,
  OPTIMAL_MAX: 220,
  TOO_FAST: 240,
  FAST_SUSTAIN_MS: 5000,
} as const;

export const ACOUSTIC_FILLER_RULES = {
  MIN_DURATION_MS: 250,
  MIN_SILENCE_GAP_MS: 150,
  SILENCE_DBFS: -40,
  MAX_PITCH_STD_HZ: 15,
} as const;

export const THAI_LEXICAL_FILLERS = [
  'แบบว่า',
  'คือแบบ',
  'อันนี้',
  'เอ่อ',
  'อ่า',
  'อืม',
  'นะฮะ',
  'ก็แบบ',
  'ยังไงนะ',
  'แบบ',
] as const;

export const VISION_RULES = {
  TARGET_FPS: 12,
  EYE_CONTACT_YAW_DEG: 14,
  EYE_CONTACT_PITCH_DEG: 11,
  EYE_CONTACT_LOST_SUSTAIN_MS: 2500,
  SLOUCH_DROP_RATIO: 0.2,
  ARMS_CROSSED_DIST_RATIO: 0.25,
  ARMS_CROSSED_SUSTAIN_MS: 3000,
  BAD_POSTURE_SUSTAIN_MS: 4000,
  CALIBRATION_DURATION_MS: 3000,
} as const;

export const HAPTIC_COOLDOWN_MS = 20_000;

export const HAPTIC_PATTERN_BY_REASON: Record<AlertReason, HapticPatternType> = {
  FILLER_WORD: 'SOFT_TICK',
  SPEAKING_TOO_FAST: 'DOUBLE_PULSE',
  EYE_CONTACT_LOST: 'DOUBLE_PULSE',
  BAD_POSTURE: 'GENTLE_WAVE',
  SLIDE_TIME_WARNING: 'GENTLE_WAVE',
};

export const ALERT_MESSAGES_TH: Record<AlertReason, string> = {
  FILLER_WORD: 'ลดคำฟุ่มเฟือย (อืม / อ่า / แบบว่า)',
  SPEAKING_TOO_FAST: 'พูดช้าลงอีกนิด (เกิน 240 พยางค์/นาที)',
  EYE_CONTACT_LOST: 'มองกล้อง / สบตาผู้ฟังมากขึ้น',
  BAD_POSTURE: 'ปรับบุคลิกภาพ ยืดไหล่และคลายมือ',
  SLIDE_TIME_WARNING: 'ใกล้หมดเวลาสไลด์หน้านี้แล้ว',
};

export const FORMALITY_LABELS: Record<FormalityLevel, string> = {
  academic: 'วิชาการ / ป้องกันวิทยานิพนธ์',
  competition: 'ประกวดนวัตกรรม / Pitching',
  business: 'นำเสนองานองค์กร / ลูกค้า',
  casual: 'เล่าเรื่อง / แบ่งปันทั่วไป',
};

export const AUDIENCE_PERSONAS: Record<
  AudiencePersonaId,
  {
    id: AudiencePersonaId;
    nameTh: string;
    roleTh: string;
    descriptionTh: string;
    badgeColor: string;
  }
> = {
  judge: {
    id: 'judge',
    nameTh: 'กรรมการประกวดนวัตกรรม',
    roleTh: 'Competition Judge',
    descriptionTh: 'เน้นถามความเป็นไปได้เชิงเทคนิค ความคุ้มค่า และจุดต่างจากคู่แข่ง',
    badgeColor: 'amber',
  },
  advisor: {
    id: 'advisor',
    nameTh: 'อาจารย์ที่ปรึกษาวิชาการ',
    roleTh: 'Academic Advisor',
    descriptionTh: 'เน้นถามสมมติฐาน แหล่งอ้างอิง วิธีวิจัย และข้อจำกัดของงาน',
    badgeColor: 'sky',
  },
  inspirational: {
    id: 'inspirational',
    nameTh: 'ผู้ฟังสายสร้างแรงบันดาลใจ',
    roleTh: 'Storytelling Coach',
    descriptionTh: 'ให้กำลังใจ ชื่นชมจุดเด่น และเสนอ Analogy ช่วยเล่าเรื่องให้น่าติดตาม',
    badgeColor: 'emerald',
  },
};
