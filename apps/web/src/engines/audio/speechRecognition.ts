export interface SpeechRecognitionCallbacks {
  onFinalTranscript: (text: string) => void;
  onInterimTranscript?: (text: string) => void;
  onError?: (message: string) => void;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
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
      0: { transcript: string };
    };
  };
}

export class ThaiSpeechRecognizer {
  private recognition: SpeechRecognitionInstance | null = null;
  private running = false;

  isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
        (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    );
  }

  start(callbacks: SpeechRecognitionCallbacks): boolean {
    if (!this.isSupported()) return false;
    const win = window as unknown as Record<
      string,
      new () => SpeechRecognitionInstance
    >;
    const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
    this.recognition = new Ctor();
    this.recognition.lang = 'th-TH';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.running = true;

    this.recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        const transcript = res[0]?.transcript?.trim() ?? '';
        if (!transcript) continue;
        if (res.isFinal) {
          callbacks.onFinalTranscript(transcript);
        } else {
          interim += `${transcript} `;
        }
      }
      if (interim && callbacks.onInterimTranscript) {
        callbacks.onInterimTranscript(interim.trim());
      }
    };

    this.recognition.onerror = (e) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        callbacks.onError?.(e.error);
      }
    };

    this.recognition.onend = () => {
      if (this.running) {
        try {
          this.recognition?.start();
        } catch {
          // ignore restart race
        }
      }
    };

    try {
      this.recognition.start();
      return true;
    } catch {
      return false;
    }
  }

  stop(): void {
    this.running = false;
    try {
      this.recognition?.stop();
    } catch {
      // ignore
    }
    this.recognition = null;
  }
}
