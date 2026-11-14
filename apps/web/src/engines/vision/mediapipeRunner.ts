import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker,
} from '@mediapipe/tasks-vision';
import type { NormalizedLandmark } from './postureGeometry';

export interface MediaPipeBundle {
  poseLandmarker: PoseLandmarker;
  faceLandmarker: FaceLandmarker;
  handLandmarker: HandLandmarker;
  detectFrame: (video: HTMLVideoElement) => {
    pose: NormalizedLandmark[] | undefined;
    faces: NormalizedLandmark[][];
    hands: NormalizedLandmark[][];
  };
  close: () => void;
}

const WASM_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm';

let consoleFilterInstalled = false;

function installMediaPipeLogFilter() {
  if (consoleFilterInstalled || typeof window === 'undefined') return;
  consoleFilterInstalled = true;
  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const first = typeof args[0] === 'string' ? args[0] : '';
    if (
      first.includes('INFO: Created TensorFlow Lite') ||
      first.includes('GL version:') ||
      first.includes('XNNPACK delegate')
    ) {
      return;
    }
    origError(...args);
  };
}

export async function createMediaPipeBundle(
  numFaces: number = 1
): Promise<MediaPipeBundle> {
  installMediaPipeLogFilter();
  const vision = await FilesetResolver.forVisionTasks(WASM_CDN);

  const [poseLandmarker, faceLandmarker, handLandmarker] = await Promise.all([
    PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
    }),
    FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces,
    }),
    HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
    }),
  ]);

  let lastTimestampMs = 0;

  return {
    poseLandmarker,
    faceLandmarker,
    handLandmarker,
    detectFrame(video: HTMLVideoElement) {
      if (video.videoWidth === 0 || video.videoHeight === 0) {
        return { pose: undefined, faces: [], hands: [] };
      }
      const ts = Math.max(lastTimestampMs + 1, Math.round(performance.now()));
      lastTimestampMs = ts;

      try {
        const poseRes = poseLandmarker.detectForVideo(video, ts);
        const faceRes = faceLandmarker.detectForVideo(video, ts);
        const handRes = handLandmarker.detectForVideo(video, ts);

        return {
          pose: poseRes.landmarks[0] as NormalizedLandmark[] | undefined,
          faces: faceRes.faceLandmarks as NormalizedLandmark[][],
          hands: handRes.landmarks as NormalizedLandmark[][],
        };
      } catch {
        return { pose: undefined, faces: [], hands: [] };
      }
    },
    close() {
      poseLandmarker.close();
      faceLandmarker.close();
      handLandmarker.close();
    },
  };
}

export function drawVisionOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pose?: NormalizedLandmark[],
  faces?: NormalizedLandmark[][],
  hands?: NormalizedLandmark[][]
): void {
  ctx.clearRect(0, 0, width, height);

  // Draw pose upper-body key lines
  if (pose && pose.length >= 25) {
    const connections: [number, number][] = [
      [11, 12],
      [11, 13],
      [13, 15],
      [12, 14],
      [14, 16],
      [11, 23],
      [12, 24],
      [23, 24],
    ];
    ctx.strokeStyle = 'rgba(236, 61, 106, 0.88)';
    ctx.lineWidth = 2.5;
    for (const [a, b] of connections) {
      const pa = pose[a];
      const pb = pose[b];
      ctx.beginPath();
      ctx.moveTo(pa.x * width, pa.y * height);
      ctx.lineTo(pb.x * width, pb.y * height);
      ctx.stroke();
    }
    ctx.fillStyle = '#FB6F92';
    for (const idx of [7, 8, 11, 12, 13, 14, 15, 16, 23, 24]) {
      const p = pose[idx];
      ctx.beginPath();
      ctx.arc(p.x * width, p.y * height, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw face iris & mouth highlights
  if (faces) {
    ctx.fillStyle = 'rgba(16, 185, 129, 0.85)';
    for (const face of faces) {
      for (const idx of [1, 13, 14, 61, 291, 468, 473]) {
        const p = face[idx];
        if (!p) continue;
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Draw hand joints
  if (hands) {
    ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
    for (const hand of hands) {
      for (const p of hand) {
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
