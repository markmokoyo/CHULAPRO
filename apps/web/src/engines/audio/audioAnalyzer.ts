import { ACOUSTIC_FILLER_RULES } from '@cuepulse/shared';

export interface AudioFrameMetrics {
  dbfs: number;
  isSpeaking: boolean;
  pitchHz: number | null;
  currentSpm: number;
  acousticFillerDetected: boolean;
}

export class WebAudioProsodyEngine {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private timeBuffer: Float32Array<ArrayBuffer> = new Float32Array(1024);

  // State for SPM (Syllables Per Minute via energy peaks)
  private syllableTimestampsMs: number[] = [];
  private lastPeakAtMs = 0;
  private wasBelowThreshold = true;

  // State for Acoustic Filler (Pitch stability > 250ms with 150ms silence gaps)
  private silenceStartMs: number | null = 0;
  private lastSilenceDurationMs = 0;
  private speechSegmentStartMs: number | null = null;
  private speechPitchSamples: number[] = [];
  private pendingCandidateEndMs: number | null = null;

  async start(stream: MediaStream): Promise<void> {
    this.audioCtx = new AudioContext({ sampleRate: 16000 });
    this.source = this.audioCtx.createMediaStreamSource(stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.timeBuffer = new Float32Array(new ArrayBuffer(this.analyser.fftSize * 4));
    this.source.connect(this.analyser);
  }

  sample(nowMs: number): AudioFrameMetrics {
    if (!this.analyser || !this.audioCtx) {
      return {
        dbfs: -100,
        isSpeaking: false,
        pitchHz: null,
        currentSpm: 0,
        acousticFillerDetected: false,
      };
    }

    this.analyser.getFloatTimeDomainData(this.timeBuffer);
    let sumSq = 0;
    for (let i = 0; i < this.timeBuffer.length; i++) {
      sumSq += this.timeBuffer[i] * this.timeBuffer[i];
    }
    const rms = Math.sqrt(sumSq / this.timeBuffer.length);
    const dbfs = rms > 1e-6 ? 20 * Math.log10(rms) : -100;
    const isSpeaking = dbfs > ACOUSTIC_FILLER_RULES.SILENCE_DBFS;

    // 1. Syllable peak detection for Thai SPM
    if (dbfs > -32) {
      if (this.wasBelowThreshold && nowMs - this.lastPeakAtMs > 140) {
        this.syllableTimestampsMs.push(nowMs);
        this.lastPeakAtMs = nowMs;
        this.wasBelowThreshold = false;
      }
    } else if (dbfs < -38) {
      this.wasBelowThreshold = true;
    }

    // Keep sliding 10-second window for responsive SPM
    const windowMs = 10_000;
    this.syllableTimestampsMs = this.syllableTimestampsMs.filter(
      (t) => nowMs - t <= windowMs
    );
    const currentSpm = Math.round(
      (this.syllableTimestampsMs.length / (windowMs / 1000)) * 60
    );

    // 2. Pitch estimation & Acoustic Filler Dual-Verification
    const pitchHz = isSpeaking
      ? estimatePitchHz(this.timeBuffer, this.audioCtx.sampleRate)
      : null;

    let acousticFillerDetected = false;

    if (isSpeaking) {
      if (this.silenceStartMs !== null) {
        this.lastSilenceDurationMs = nowMs - this.silenceStartMs;
        this.silenceStartMs = null;
      }
      if (this.speechSegmentStartMs === null) {
        this.speechSegmentStartMs = nowMs;
        this.speechPitchSamples = [];
      }
      if (pitchHz !== null) {
        this.speechPitchSamples.push(pitchHz);
      }
      this.pendingCandidateEndMs = null;
    } else {
      if (this.silenceStartMs === null) {
        this.silenceStartMs = nowMs;
      }
      if (this.speechSegmentStartMs !== null) {
        const segDuration = nowMs - this.speechSegmentStartMs;
        const hadLeadingSilence =
          this.lastSilenceDurationMs >= ACOUSTIC_FILLER_RULES.MIN_SILENCE_GAP_MS;
        const pitchStd = stdDev(this.speechPitchSamples);

        if (
          hadLeadingSilence &&
          segDuration >= ACOUSTIC_FILLER_RULES.MIN_DURATION_MS &&
          segDuration <= 1500 &&
          this.speechPitchSamples.length >= 3 &&
          pitchStd <= ACOUSTIC_FILLER_RULES.MAX_PITCH_STD_HZ
        ) {
          this.pendingCandidateEndMs = nowMs;
        }
        this.speechSegmentStartMs = null;
        this.speechPitchSamples = [];
      }

      // Confirm trailing silence >= 150ms
      if (
        this.pendingCandidateEndMs !== null &&
        nowMs - this.pendingCandidateEndMs >=
          ACOUSTIC_FILLER_RULES.MIN_SILENCE_GAP_MS
      ) {
        acousticFillerDetected = true;
        this.pendingCandidateEndMs = null;
      }
    }

    return {
      dbfs: Number(dbfs.toFixed(1)),
      isSpeaking,
      pitchHz,
      currentSpm,
      acousticFillerDetected,
    };
  }

  stop(): void {
    this.source?.disconnect();
    this.analyser?.disconnect();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      void this.audioCtx.close();
    }
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
  }
}

function estimatePitchHz(buffer: Float32Array, sampleRate: number): number | null {
  let energy = 0;
  for (let i = 0; i < buffer.length; i++) {
    energy += buffer[i] * buffer[i];
  }
  if (energy < 1e-6) return null;

  const minLag = Math.floor(sampleRate / 350); // 350 Hz max
  const maxLag = Math.floor(sampleRate / 75); // 75 Hz min
  let bestLag = -1;
  let bestNormCorr = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < buffer.length - lag; i++) {
      corr += buffer[i] * buffer[i + lag];
    }
    const normCorr = corr / energy;
    if (normCorr > bestNormCorr) {
      bestNormCorr = normCorr;
      bestLag = lag;
    }
  }

  if (bestLag <= 0 || bestNormCorr < 0.45) return null;
  return Math.round(sampleRate / bestLag);
}

function stdDev(values: number[]): number {
  if (values.length === 0) return 999;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
