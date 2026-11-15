export interface SpeechRecognitionCallbacks {
  onFinalTranscript: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
  onError?: (message: string) => void;
  onStatusChange?: (listening: boolean) => void;
  hotwords?: string[];
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence?: number;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: {
    length: number;
    [idx: number]: {
      isFinal: boolean;
      length?: number;
      [altIdx: number]: SpeechRecognitionAlternativeLike;
    };
  };
}

function normalizeThaiTranscript(raw: string): string {
  return raw
    .replace(/\s+/g, ' ')
    .replace(/([ก-๙])\s+([ก-๙])/g, '$1$2')
    .trim();
}

function pickBestAlternative(
  res: SpeechRecognitionResultEvent['results'][number],
  hotwords: string[]
): string {
  const count = res.length ?? 1;
  const candidates: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = res[i]?.transcript?.trim();
    if (t) candidates.push(t);
  }
  if (candidates.length === 0) return '';
  if (candidates.length === 1 || hotwords.length === 0) {
    return normalizeThaiTranscript(candidates[0]);
  }

  const normalizedHotwords = hotwords
    .map((h) => h.trim().toLowerCase())
    .filter((h) => h.length >= 2);

  let best = candidates[0];
  let bestScore = -1;
  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    const lower = cand.toLowerCase();
    let score = i === 0 ? 0.5 : 0; // slight preference for top ASR hypothesis
    for (const hw of normalizedHotwords) {
      if (lower.includes(hw)) {
        score += 2;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return normalizeThaiTranscript(best);
}

export class ThaiSpeechRecognizer {
  private recognition: SpeechRecognitionInstance | null = null;
  private running = false;
  private callbacks: SpeechRecognitionCallbacks | null = null;
  private pendingInterim = '';
  private lastEmittedFinal = '';
  private lastEmittedAt = 0;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;

  isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
        (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    );
  }

  private emitFinal(text: string): void {
    const clean = normalizeThaiTranscript(text);
    if (!clean) return;
    const now = Date.now();
    // Prevent duplicate final emissions from browser restart races
    if (clean === this.lastEmittedFinal && now - this.lastEmittedAt < 1200) {
      return;
    }
    this.lastEmittedFinal = clean;
    this.lastEmittedAt = now;
    this.callbacks?.onFinalTranscript(clean);
  }

  private flushPendingInterim(): void {
    if (!this.pendingInterim) return;
    const flushed = this.pendingInterim;
    this.pendingInterim = '';
    this.callbacks?.onInterimTranscript?.('');
    this.emitFinal(flushed);
  }

  start(callbacks: SpeechRecognitionCallbacks): boolean {
    if (!this.isSupported()) return false;
    this.stop();

    const win = window as unknown as Record<
      string,
      new () => SpeechRecognitionInstance
    >;
    const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
    const rec = new Ctor();
    rec.lang = 'th-TH';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    this.callbacks = callbacks;
    this.recognition = rec;
    this.running = true;
    this.pendingInterim = '';

    const hotwords = callbacks.hotwords ?? [];

    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const transcript = pickBestAlternative(res, hotwords);
        if (!transcript) continue;
        if (res.isFinal) {
          this.pendingInterim = '';
          this.emitFinal(transcript);
        } else {
          interim += `${transcript} `;
        }
      }
      const cleanInterim = normalizeThaiTranscript(interim);
      this.pendingInterim = cleanInterim;
      callbacks.onInterimTranscript?.(cleanInterim);
    };

    rec.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        callbacks.onError?.(e.error);
      }
    };

    rec.onend = () => {
      // Flush any trailing interim words so pauses don't lose the end of a sentence
      this.flushPendingInterim();
      if (this.running) {
        if (this.restartTimer) clearTimeout(this.restartTimer);
        this.restartTimer = setTimeout(() => {
          if (!this.running || !this.recognition) return;
          try {
            this.recognition.start();
          } catch {
            // ignore restart race
          }
        }, 120);
      } else {
        callbacks.onStatusChange?.(false);
      }
    };

    try {
      rec.start();
      callbacks.onStatusChange?.(true);
      return true;
    } catch {
      this.running = false;
      callbacks.onStatusChange?.(false);
      return false;
    }
  }

  stop(): void {
    this.running = false;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.flushPendingInterim();
    try {
      this.recognition?.stop();
    } catch {
      // ignore
    }
    this.callbacks?.onStatusChange?.(false);
    this.recognition = null;
  }
}
