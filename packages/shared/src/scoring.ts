import {
  ALERT_MESSAGES_TH,
  HAPTIC_COOLDOWN_MS,
  HAPTIC_PATTERN_BY_REASON,
  SPM_THRESHOLDS,
  THAI_LEXICAL_FILLERS,
} from './constants';
import type {
  AlertReason,
  FillerOccurrence,
  HandoffTransition,
  HapticCueEvent,
  SessionReport,
  TeamMemberProfile,
  TeamMemberReport,
  TeamSessionReport,
  TelemetrySnapshot,
  TranscriptSegment,
} from './types';

export function calculatePacingScore(averageSpm: number): number {
  if (averageSpm <= 0) return 0;
  if (
    averageSpm >= SPM_THRESHOLDS.OPTIMAL_MIN &&
    averageSpm <= SPM_THRESHOLDS.OPTIMAL_MAX
  ) {
    return 100;
  }
  const distance =
    averageSpm < SPM_THRESHOLDS.OPTIMAL_MIN
      ? SPM_THRESHOLDS.OPTIMAL_MIN - averageSpm
      : averageSpm - SPM_THRESHOLDS.OPTIMAL_MAX;

  return Math.max(0, Math.round(100 - distance * 0.8));
}

export function calculateFluencyScore(fillerPerMinute: number): number {
  if (fillerPerMinute <= 0) return 100;
  return Math.max(0, Math.round(100 - fillerPerMinute * 12));
}

export function calculateOverallScore(params: {
  eyeContactRatio: number;
  goodPostureRatio: number;
  averageSpm: number;
  fillerPerMinute: number;
}): number {
  const eye = clampPercent(params.eyeContactRatio);
  const posture = clampPercent(params.goodPostureRatio);
  const pacing = calculatePacingScore(params.averageSpm);
  const fluency = calculateFluencyScore(params.fillerPerMinute);

  const weighted = 0.3 * eye + 0.25 * posture + 0.25 * pacing + 0.2 * fluency;
  return Math.max(0, Math.min(100, Math.round(weighted)));
}

export function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export class CooldownManager {
  private lastTriggeredAtMs: number | null = null;
  private readonly cooldownMs: number;

  constructor(cooldownMs: number = HAPTIC_COOLDOWN_MS) {
    this.cooldownMs = cooldownMs;
  }

  canTrigger(nowMs: number): boolean {
    if (this.lastTriggeredAtMs === null) return true;
    return nowMs - this.lastTriggeredAtMs >= this.cooldownMs;
  }

  remainingCooldownMs(nowMs: number): number {
    if (this.lastTriggeredAtMs === null) return 0;
    return Math.max(0, this.cooldownMs - (nowMs - this.lastTriggeredAtMs));
  }

  tryTrigger(
    nowMs: number,
    reason: AlertReason,
    slideNumber: number,
    id: string = `cue-${nowMs}`
  ): HapticCueEvent | null {
    if (!this.canTrigger(nowMs)) {
      return null;
    }
    this.lastTriggeredAtMs = nowMs;
    return {
      id,
      timestampMs: nowMs,
      pattern: HAPTIC_PATTERN_BY_REASON[reason],
      reason,
      messageTh: ALERT_MESSAGES_TH[reason],
      slideNumber,
    };
  }

  reset(): void {
    this.lastTriggeredAtMs = null;
  }
}

export function detectLexicalFillers(
  text: string,
  timestampMs: number,
  slideNumber: number,
  speakerId?: string
): FillerOccurrence[] {
  const occurrences: FillerOccurrence[] = [];
  const normalized = text.trim();
  if (!normalized) return occurrences;

  // Sort longest-first and track matched ranges to prevent double-counting (e.g. "แบบว่า" + "แบบ")
  const sortedFillers = [...THAI_LEXICAL_FILLERS].sort(
    (a, b) => b.length - a.length
  );
  const occupied = new Array<boolean>(normalized.length).fill(false);

  for (const filler of sortedFillers) {
    let idx = normalized.indexOf(filler);
    while (idx !== -1) {
      const end = idx + filler.length;
      const overlaps = occupied.slice(idx, end).some(Boolean);
      const charBefore = idx > 0 ? normalized[idx - 1] : ' ';
      const isBoundaryBefore = idx === 0 || /\s/.test(charBefore);

      if (!overlaps && (isBoundaryBefore || filler.length >= 3)) {
        for (let i = idx; i < end; i++) occupied[i] = true;
        occurrences.push({
          word: filler,
          layer: 'lexical',
          timestampMs,
          slideNumber,
          speakerId,
        });
      }
      idx = normalized.indexOf(filler, idx + filler.length);
    }
  }
  return occurrences;
}

export function buildSessionReport(input: {
  sessionId: string;
  planId?: string;
  topicTitle?: string;
  speakerScript?: string;
  durationSeconds: number;
  telemetryTimeline: TelemetrySnapshot[];
  fillers: FillerOccurrence[];
  hapticCues: HapticCueEvent[];
  transcriptSegments: TranscriptSegment[];
}): SessionReport {
  const durationMin = Math.max(input.durationSeconds / 60, 1 / 60);
  const timeline = input.telemetryTimeline;

  const speakingSnapshots = timeline.filter((t) => t.isSpeaking && t.currentSpm > 0);
  const averageSpm =
    speakingSnapshots.length > 0
      ? Math.round(
          speakingSnapshots.reduce((acc, s) => acc + s.currentSpm, 0) /
            speakingSnapshots.length
        )
      : 0;

  const eyeContactRatio =
    timeline.length > 0
      ? Math.round(
          (timeline.reduce((acc, s) => acc + s.eyeContactScore, 0) /
            timeline.length) *
            100
        )
      : 0;

  const goodPostureRatio =
    timeline.length > 0
      ? Math.round(
          (timeline.reduce((acc, s) => acc + s.postureScore, 0) /
            timeline.length) *
            100
        )
      : 0;

  const fillerCount = input.fillers.length;
  const fillerPerMinute = Number((fillerCount / durationMin).toFixed(2));

  const overallScore = calculateOverallScore({
    eyeContactRatio,
    goodPostureRatio,
    averageSpm,
    fillerPerMinute,
  });

  return {
    sessionId: input.sessionId,
    mode: 'solo',
    planId: input.planId,
    topicTitle: input.topicTitle,
    speakerScript: input.speakerScript,
    durationSeconds: input.durationSeconds,
    overallScore,
    metrics: {
      averageSpm,
      fillerCount,
      fillerPerMinute,
      eyeContactRatio,
      goodPostureRatio,
    },
    fillers: input.fillers,
    hapticCues: input.hapticCues,
    telemetryTimeline: input.telemetryTimeline,
    transcriptSegments: input.transcriptSegments,
    createdAt: new Date().toISOString(),
  };
}

export function buildTeamSessionReport(input: {
  sessionId: string;
  planId?: string;
  topicTitle?: string;
  speakerScript?: string;
  durationSeconds: number;
  members: TeamMemberProfile[];
  telemetryTimeline: TelemetrySnapshot[];
  fillers: FillerOccurrence[];
  hapticCues: HapticCueEvent[];
  transcriptSegments: TranscriptSegment[];
}): TeamSessionReport {
  const base = buildSessionReport({
    sessionId: input.sessionId,
    planId: input.planId,
    topicTitle: input.topicTitle,
    speakerScript: input.speakerScript,
    durationSeconds: input.durationSeconds,
    telemetryTimeline: input.telemetryTimeline,
    fillers: input.fillers,
    hapticCues: input.hapticCues,
    transcriptSegments: input.transcriptSegments,
  });

  const timeline = input.telemetryTimeline;
  const totalSpeakingSnapshots = timeline.filter((t) => t.activeSpeakerId).length || 1;
  const stepSeconds =
    timeline.length > 1
      ? input.durationSeconds / timeline.length
      : input.durationSeconds;

  const memberReports: TeamMemberReport[] = input.members.map((member) => {
    const memberSpoke = timeline.filter(
      (t) => t.activeSpeakerId === member.memberId && t.isSpeaking
    );
    const memberListening = timeline.filter(
      (t) => t.activeSpeakerId && t.activeSpeakerId !== member.memberId
    );
    const speakingSeconds = Math.round(memberSpoke.length * stepSeconds);
    const speakingSharePercent = Math.round(
      (memberSpoke.length / totalSpeakingSnapshots) * 100
    );
    const averageSpm =
      memberSpoke.length > 0
        ? Math.round(
            memberSpoke.reduce((acc, s) => acc + s.currentSpm, 0) /
              memberSpoke.length
          )
        : 0;
    const fillerCount = input.fillers.filter(
      (f) => f.speakerId === member.memberId
    ).length;
    const eyeContactRatio =
      memberSpoke.length > 0
        ? Math.round(
            (memberSpoke.reduce((acc, s) => acc + s.eyeContactScore, 0) /
              memberSpoke.length) *
              100
          )
        : 0;
    const postureRatio =
      memberSpoke.length > 0
        ? Math.round(
            (memberSpoke.reduce((acc, s) => acc + s.postureScore, 0) /
              memberSpoke.length) *
              100
          )
        : 0;
    const attentivenessWhileListening =
      memberListening.length > 0
        ? Math.round(
            (memberListening.reduce(
              (acc, s) => acc + (s.eyeContactScore * 0.5 + s.postureScore * 0.5),
              0
            ) /
              memberListening.length) *
              100
          )
        : 100;

    return {
      memberId: member.memberId,
      name: member.name,
      speakingSeconds,
      speakingSharePercent,
      averageSpm,
      fillerCount,
      eyeContactRatio,
      postureRatio,
      attentivenessWhileListening,
    };
  });

  const handoffTransitions: HandoffTransition[] = [];
  let lastSpeakerId: string | undefined;
  let lastSpeakerEndMs = 0;

  for (const snap of timeline) {
    if (!snap.activeSpeakerId) continue;
    if (!lastSpeakerId) {
      lastSpeakerId = snap.activeSpeakerId;
      lastSpeakerEndMs = snap.timestampMs;
      continue;
    }
    if (snap.activeSpeakerId !== lastSpeakerId) {
      handoffTransitions.push({
        fromMemberId: lastSpeakerId,
        toMemberId: snap.activeSpeakerId,
        gapSeconds: Number(
          Math.max(0, (snap.timestampMs - lastSpeakerEndMs) / 1000).toFixed(1)
        ),
        timestampMs: snap.timestampMs,
      });
      lastSpeakerId = snap.activeSpeakerId;
    }
    lastSpeakerEndMs = snap.timestampMs;
  }

  return {
    ...base,
    mode: 'team',
    memberReports,
    handoffTransitions,
  };
}
