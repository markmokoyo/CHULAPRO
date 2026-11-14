import { VISION_RULES } from '@cuepulse/shared';

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

export interface PostureBaseline {
  earToShoulderRatio: number;
  hipCenterX: number;
  calibratedAtMs: number;
}

export interface VisionAnalysisFrame {
  eyeContactScore: number; // 0..1
  postureScore: number; // 0..1
  isSlouching: boolean;
  isArmsCrossed: boolean;
  isSwaying: boolean;
}

function dist2D(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function computeEarToShoulderRatio(
  pose: NormalizedLandmark[]
): number | null {
  if (pose.length < 13) return null;
  const leftEar = pose[7];
  const rightEar = pose[8];
  const leftShoulder = pose[11];
  const rightShoulder = pose[12];
  const shoulderWidth = dist2D(leftShoulder, rightShoulder);
  if (shoulderWidth < 0.05) return null;

  const avgEarY = (leftEar.y + rightEar.y) / 2;
  const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  // Positive when ears are above shoulders
  return (avgShoulderY - avgEarY) / shoulderWidth;
}

export function computeHipCenterX(pose: NormalizedLandmark[]): number | null {
  if (pose.length < 25) return null;
  return (pose[23].x + pose[24].x) / 2;
}

export function analyzePostureAndGaze(params: {
  pose?: NormalizedLandmark[];
  face?: NormalizedLandmark[];
  baseline: PostureBaseline | null;
  recentHipXHistory: number[];
}): VisionAnalysisFrame {
  let eyeContactScore = 1.0;
  let postureScore = 1.0;
  let isSlouching = false;
  let isArmsCrossed = false;
  let isSwaying = false;

  // 1. Face / Eye Contact analysis (478 landmarks)
  if (params.face && params.face.length >= 468) {
    const noseTip = params.face[1];
    const leftCheek = params.face[234];
    const rightCheek = params.face[454];
    const forehead = params.face[10];
    const chin = params.face[152];

    const faceWidth = Math.max(0.05, Math.abs(rightCheek.x - leftCheek.x));
    const faceCenterX = (leftCheek.x + rightCheek.x) / 2;
    const yawOffset = Math.abs(noseTip.x - faceCenterX) / faceWidth;
    const estimatedYawDeg = yawOffset * 90;

    const faceHeight = Math.max(0.05, Math.abs(chin.y - forehead.y));
    const faceMidY = (forehead.y + chin.y) / 2;
    const pitchOffset = Math.abs(noseTip.y - faceMidY) / faceHeight;
    const estimatedPitchDeg = pitchOffset * 70;

    const yawOk = estimatedYawDeg <= VISION_RULES.EYE_CONTACT_YAW_DEG;
    const pitchOk = estimatedPitchDeg <= VISION_RULES.EYE_CONTACT_PITCH_DEG;

    if (!yawOk || !pitchOk) {
      const penalty = Math.min(
        1,
        Math.max(
          estimatedYawDeg / (VISION_RULES.EYE_CONTACT_YAW_DEG * 2),
          estimatedPitchDeg / (VISION_RULES.EYE_CONTACT_PITCH_DEG * 2)
        )
      );
      eyeContactScore = Math.max(0.1, Number((1 - penalty).toFixed(2)));
    }
  } else if (!params.face) {
    eyeContactScore = 0.2;
  }

  // 2. Pose analysis (33 landmarks)
  if (params.pose && params.pose.length >= 25) {
    const pose = params.pose;
    const leftShoulder = pose[11];
    const rightShoulder = pose[12];
    const leftElbow = pose[13];
    const rightElbow = pose[14];
    const leftWrist = pose[15];
    const rightWrist = pose[16];
    const shoulderWidth = Math.max(0.05, dist2D(leftShoulder, rightShoulder));

    // Slouching check against calibrated baseline
    const ratio = computeEarToShoulderRatio(pose);
    if (ratio !== null && params.baseline) {
      const drop =
        (params.baseline.earToShoulderRatio - ratio) /
        Math.max(0.1, params.baseline.earToShoulderRatio);
      if (drop > VISION_RULES.SLOUCH_DROP_RATIO) {
        isSlouching = true;
      }
    }

    // Arms crossed check: wrists near opposite elbows
    const leftWristToRightElbow = dist2D(leftWrist, rightElbow) / shoulderWidth;
    const rightWristToLeftElbow = dist2D(rightWrist, leftElbow) / shoulderWidth;
    if (
      leftWristToRightElbow < VISION_RULES.ARMS_CROSSED_DIST_RATIO &&
      rightWristToLeftElbow < VISION_RULES.ARMS_CROSSED_DIST_RATIO
    ) {
      isArmsCrossed = true;
    }

    // Swaying check: SD of recent hip X positions
    if (params.recentHipXHistory.length >= 10) {
      const mean =
        params.recentHipXHistory.reduce((a, b) => a + b, 0) /
        params.recentHipXHistory.length;
      const variance =
        params.recentHipXHistory.reduce((a, x) => a + (x - mean) ** 2, 0) /
        params.recentHipXHistory.length;
      const sd = Math.sqrt(variance);
      if (sd > 0.045) {
        isSwaying = true;
      }
    }

    let deductions = 0;
    if (isSlouching) deductions += 0.35;
    if (isArmsCrossed) deductions += 0.3;
    if (isSwaying) deductions += 0.25;
    postureScore = Math.max(0.1, Number((1 - deductions).toFixed(2)));
  }

  return {
    eyeContactScore,
    postureScore,
    isSlouching,
    isArmsCrossed,
    isSwaying,
  };
}
