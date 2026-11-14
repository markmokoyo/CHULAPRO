import { describe, expect, it } from 'vitest';
import {
  buildSessionReport,
  buildTeamSessionReport,
  calculateFluencyScore,
  calculateOverallScore,
  calculatePacingScore,
  CooldownManager,
  detectLexicalFillers,
} from './scoring';
import type { TeamMemberProfile, TelemetrySnapshot } from './types';

describe('Scoring Engine', () => {
  it('gives 100 pacing score inside 180-220 SPM', () => {
    expect(calculatePacingScore(180)).toBe(100);
    expect(calculatePacingScore(200)).toBe(100);
    expect(calculatePacingScore(220)).toBe(100);
    expect(calculatePacingScore(260)).toBeLessThan(100);
    expect(calculatePacingScore(0)).toBe(0);
  });

  it('penalizes fluency score proportionally to fillers per minute', () => {
    expect(calculateFluencyScore(0)).toBe(100);
    expect(calculateFluencyScore(2)).toBe(76);
    expect(calculateFluencyScore(10)).toBe(0);
  });

  it('computes weighted overall score within 0-100', () => {
    const perfect = calculateOverallScore({
      eyeContactRatio: 100,
      goodPostureRatio: 100,
      averageSpm: 200,
      fillerPerMinute: 0,
    });
    expect(perfect).toBe(100);
  });
});

describe('CooldownManager (20s rule)', () => {
  it('blocks alerts within 20,000 ms and allows after 20,000 ms', () => {
    const cm = new CooldownManager(20_000);

    const first = cm.tryTrigger(1000, 'FILLER_WORD', 1);
    expect(first).not.toBeNull();
    expect(first?.pattern).toBe('SOFT_TICK');

    const blocked = cm.tryTrigger(15_000, 'SPEAKING_TOO_FAST', 1);
    expect(blocked).toBeNull();
    expect(cm.remainingCooldownMs(15_000)).toBe(6000);

    const allowed = cm.tryTrigger(21_000, 'BAD_POSTURE', 2);
    expect(allowed).not.toBeNull();
    expect(allowed?.pattern).toBe('GENTLE_WAVE');
  });
});

describe('Thai Lexical Filler Detection', () => {
  it('detects Thai filler words without double-counting overlapping substrings', () => {
    const fillers = detectLexicalFillers(
      'เอ่อ คือแบบ วันนี้เราจะมานำเสนอ แบบว่า โปรเจกต์นี้',
      5000,
      1
    );
    const words = fillers.map((f) => f.word);
    expect(words).toContain('เอ่อ');
    expect(words).toContain('คือแบบ');
    expect(words).toContain('แบบว่า');
    expect(words).not.toContain('แบบ');
    expect(fillers).toHaveLength(3);
  });
});

describe('Session & Team Report Builders', () => {
  it('builds solo session report accurately', () => {
    const timeline: TelemetrySnapshot[] = [
      {
        timestampMs: 1000,
        currentSpm: 195,
        eyeContactScore: 0.9,
        postureScore: 0.8,
        isSlouching: false,
        isArmsCrossed: false,
        isSwaying: false,
        isSpeaking: true,
      },
      {
        timestampMs: 2000,
        currentSpm: 205,
        eyeContactScore: 0.9,
        postureScore: 1.0,
        isSlouching: false,
        isArmsCrossed: false,
        isSwaying: false,
        isSpeaking: true,
      },
    ];

    const report = buildSessionReport({
      sessionId: 's1',
      durationSeconds: 60,
      telemetryTimeline: timeline,
      fillers: [],
      hapticCues: [],
      transcriptSegments: [],
    });

    expect(report.metrics.averageSpm).toBe(200);
    expect(report.metrics.eyeContactRatio).toBe(90);
    expect(report.metrics.goodPostureRatio).toBe(90);
    expect(report.overallScore).toBeGreaterThanOrEqual(90);
  });

  it('builds team session report with handoff transitions', () => {
    const members: TeamMemberProfile[] = [
      { memberId: 'm1', name: 'นัท', assignedSlides: [1], enrolledAt: '' },
      { memberId: 'm2', name: 'พลอย', assignedSlides: [2], enrolledAt: '' },
    ];
    const timeline: TelemetrySnapshot[] = [
      {
        timestampMs: 1000,
        currentSpm: 190,
        eyeContactScore: 0.8,
        postureScore: 0.9,
        isSlouching: false,
        isArmsCrossed: false,
        isSwaying: false,
        isSpeaking: true,
        activeSpeakerId: 'm1',
      },
      {
        timestampMs: 3500,
        currentSpm: 200,
        eyeContactScore: 0.9,
        postureScore: 0.9,
        isSlouching: false,
        isArmsCrossed: false,
        isSwaying: false,
        isSpeaking: true,
        activeSpeakerId: 'm2',
      },
    ];

    const teamReport = buildTeamSessionReport({
      sessionId: 't1',
      durationSeconds: 30,
      members,
      telemetryTimeline: timeline,
      fillers: [],
      hapticCues: [],
      transcriptSegments: [],
    });

    expect(teamReport.memberReports).toHaveLength(2);
    expect(teamReport.handoffTransitions).toHaveLength(1);
    expect(teamReport.handoffTransitions[0].fromMemberId).toBe('m1');
    expect(teamReport.handoffTransitions[0].toMemberId).toBe('m2');
    expect(teamReport.handoffTransitions[0].gapSeconds).toBe(2.5);
  });
});
