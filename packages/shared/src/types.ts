export type FormalityLevel = 'academic' | 'competition' | 'casual' | 'business';

export interface SlideItem {
  slideNumber: number;
  title: string;
  extractedText: string;
  wordCount: number;
  estimatedSyllables?: number;
  allocatedSeconds: number;
  keyPoints: string[];
  speakingGuide?: string;
  speakerScript?: string;
  imageDataUrl?: string;
  likelyJudgeQuestion?: string;
  transitionPhrase: string;
  emphasisCues: string[];
  densityWarning?: string;
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
  technicalHotwords: string[];
  slides: SlideItem[];
  createdAt: string;
}

export type HapticPatternType = 'SOFT_TICK' | 'DOUBLE_PULSE' | 'GENTLE_WAVE';

export type AlertReason =
  | 'FILLER_WORD'
  | 'SPEAKING_TOO_FAST'
  | 'EYE_CONTACT_LOST'
  | 'BAD_POSTURE'
  | 'SLIDE_TIME_WARNING';

export interface HapticCueEvent {
  id: string;
  timestampMs: number;
  pattern: HapticPatternType;
  reason: AlertReason;
  messageTh: string;
  slideNumber: number;
}

export interface TelemetrySnapshot {
  timestampMs: number;
  currentSpm: number;
  eyeContactScore: number;
  postureScore: number;
  isSlouching: boolean;
  isArmsCrossed: boolean;
  isSwaying: boolean;
  isSpeaking: boolean;
  activeSpeakerId?: string;
}

export interface FillerOccurrence {
  word: string;
  layer: 'acoustic' | 'lexical';
  timestampMs: number;
  slideNumber: number;
  speakerId?: string;
}

export interface TranscriptSegment {
  speakerId: string;
  text: string;
  startMs: number;
  endMs: number;
}

export interface SessionMetrics {
  averageSpm: number;
  fillerCount: number;
  fillerPerMinute: number;
  eyeContactRatio: number;
  goodPostureRatio: number;
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
  overallScore: number;
  metrics: SessionMetrics;
  fillers: FillerOccurrence[];
  hapticCues: HapticCueEvent[];
  telemetryTimeline: TelemetrySnapshot[];
  transcriptSegments: TranscriptSegment[];
  speechAnalysis?: SpeechContentAnalysis;
  audienceHistory?: AudienceMessage[];
  aiFeedbackSummary?: string;
  createdAt: string;
}

export interface TeamMemberProfile {
  memberId: string;
  name: string;
  assignedSlides: number[];
  enrolledAt: string;
  faceBoxNormalized?: {
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
  };
}

export interface TeamMemberReport {
  memberId: string;
  name: string;
  individualScore?: number;
  speakingSeconds: number;
  speakingSharePercent: number;
  averageSpm: number;
  fillerCount: number;
  eyeContactRatio: number;
  postureRatio: number;
  attentivenessWhileListening: number;
}

export interface HandoffTransition {
  fromMemberId: string;
  toMemberId: string;
  gapSeconds: number;
  timestampMs: number;
}

export interface TeamSessionReport extends SessionReport {
  mode: 'team';
  teamBalanceScore?: number;
  handoffScore?: number;
  memberReports: TeamMemberReport[];
  handoffTransitions: HandoffTransition[];
}

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
