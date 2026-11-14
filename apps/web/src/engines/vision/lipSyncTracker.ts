import type { TeamMemberProfile } from '@cuepulse/shared';
import type { NormalizedLandmark } from './postureGeometry';

export interface LipActivitySample {
  memberId: string;
  mouthOpenRatio: number;
  variance: number;
}

export function computeMouthOpenRatio(face: NormalizedLandmark[]): number {
  if (face.length < 292) return 0;
  const upperLip = face[13];
  const lowerLip = face[14];
  const leftCorner = face[61];
  const rightCorner = face[291];

  const mouthWidth = Math.max(0.01, Math.hypot(rightCorner.x - leftCorner.x, rightCorner.y - leftCorner.y));
  const mouthHeight = Math.hypot(lowerLip.x - upperLip.x, lowerLip.y - upperLip.y);
  return mouthHeight / mouthWidth;
}

export class TeamLipSyncTracker {
  private readonly historyByMember = new Map<string, number[]>();
  private readonly windowSize = 8;

  matchFacesToMembers(
    faces: NormalizedLandmark[][],
    members: TeamMemberProfile[]
  ): Map<string, NormalizedLandmark[]> {
    const matched = new Map<string, NormalizedLandmark[]>();
    if (faces.length === 0 || members.length === 0) return matched;

    // Video is horizontally mirrored (-scale-x-100), so descending raw X = left-to-right on screen
    const sortedFaces = [...faces].sort((a, b) => (b[1]?.x ?? 0.5) - (a[1]?.x ?? 0.5));

    // If members have faceBoxNormalized, match by closest center; otherwise positional order
    for (let i = 0; i < sortedFaces.length && i < members.length; i++) {
      const face = sortedFaces[i];
      const noseX = face[1]?.x ?? 0.5;
      let bestMember = members[i];
      let bestDist = Infinity;

      for (const m of members) {
        if (!m.faceBoxNormalized) continue;
        const center = (m.faceBoxNormalized.xMin + m.faceBoxNormalized.xMax) / 2;
        const dist = Math.abs(noseX - center);
        if (dist < bestDist) {
          bestDist = dist;
          bestMember = m;
        }
      }
      matched.set(bestMember.memberId, face);
    }

    return matched;
  }

  detectActiveSpeaker(
    faces: NormalizedLandmark[][],
    members: TeamMemberProfile[],
    isAudioSpeaking: boolean
  ): string | undefined {
    if (!isAudioSpeaking || members.length === 0) return undefined;
    const matched = this.matchFacesToMembers(faces, members);
    if (matched.size === 0) return members[0]?.memberId;

    let bestMemberId: string | undefined;
    let maxVariance = -1;

    for (const [memberId, face] of matched.entries()) {
      const ratio = computeMouthOpenRatio(face);
      const hist = this.historyByMember.get(memberId) ?? [];
      hist.push(ratio);
      if (hist.length > this.windowSize) hist.shift();
      this.historyByMember.set(memberId, hist);

      const mean = hist.reduce((a, b) => a + b, 0) / hist.length;
      const variance =
        hist.reduce((a, v) => a + (v - mean) ** 2, 0) / hist.length;

      if (variance > maxVariance) {
        maxVariance = variance;
        bestMemberId = memberId;
      }
    }

    return bestMemberId ?? members[0]?.memberId;
  }

  reset(): void {
    this.historyByMember.clear();
  }
}
