import type { AudiencePersonaId } from '@cuepulse/shared';
import { emitQuotaUpdated } from '@/components/AiQuotaBadge';
import type { AiQuotaSnapshot } from '@/services/geminiQuota';
import { getAiRequestHeaders } from '@/services/storage';

const audioCache = new Map<string, string>();
let activeAudio: HTMLAudioElement | null = null;

export function stopSpeaking(): void {
  if (activeAudio) {
    try {
      activeAudio.pause();
      activeAudio.currentTime = 0;
    } catch {
      // Ignore cleanup error
    }
    activeAudio = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore
    }
  }
}

function selectBestThaiBrowserVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const thaiVoices = voices.filter((v) =>
    v.lang.toLowerCase().startsWith('th')
  );
  if (thaiVoices.length === 0) return null;

  const scoreVoice = (v: SpeechSynthesisVoice): number => {
    const name = v.name.toLowerCase();
    if (name.includes('natural') || name.includes('online')) return 100;
    if (name.includes('premwadee') || name.includes('niwat')) return 95;
    if (name.includes('google')) return 80;
    if (name.includes('kanya')) return 60;
    return 30;
  };

  thaiVoices.sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return thaiVoices[0];
}

function speakViaBrowser(text: string, onEnd?: () => void): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onEnd?.();
    return;
  }

  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'th-TH';
  utter.rate = 0.98;
  utter.pitch = 1.0;

  const best = selectBestThaiBrowserVoice();
  if (best) {
    utter.voice = best;
  }
  utter.onend = () => onEnd?.();
  utter.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utter);
}

function base64ToBlobUrl(base64: string, mimeType: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

export async function speakQuestionNatural(params: {
  text: string;
  personaId?: AudiencePersonaId;
  preferGemini?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
}): Promise<'gemini' | 'browser'> {
  const { text, personaId = 'judge', preferGemini = true, onStart, onEnd } = params;
  const trimmed = text.trim();
  if (!trimmed) {
    onEnd?.();
    return 'browser';
  }

  stopSpeaking();
  onStart?.();

  if (!preferGemini) {
    speakViaBrowser(trimmed, onEnd);
    return 'browser';
  }

  const cacheKey = `${personaId}::${trimmed}`;
  const cachedUrl = audioCache.get(cacheKey);
  if (cachedUrl) {
    const audio = new Audio(cachedUrl);
    activeAudio = audio;
    audio.onended = () => {
      if (activeAudio === audio) activeAudio = null;
      onEnd?.();
    };
    audio.onerror = () => {
      if (activeAudio === audio) activeAudio = null;
      speakViaBrowser(trimmed, onEnd);
    };
    await audio.play();
    return 'gemini';
  }

  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAiRequestHeaders(),
      },
      body: JSON.stringify({
        text: trimmed,
        personaId,
      }),
    });

    if (!res.ok) {
      speakViaBrowser(trimmed, onEnd);
      return 'browser';
    }

    const data = (await res.json()) as {
      fallback?: boolean;
      audioBase64?: string;
      mimeType?: string;
      quota?: AiQuotaSnapshot;
    };

    if (data.quota) {
      emitQuotaUpdated(data.quota);
    }

    if (data.fallback || !data.audioBase64) {
      speakViaBrowser(trimmed, onEnd);
      return 'browser';
    }

    const url = base64ToBlobUrl(data.audioBase64, data.mimeType || 'audio/wav');
    audioCache.set(cacheKey, url);

    const audio = new Audio(url);
    activeAudio = audio;
    audio.onended = () => {
      if (activeAudio === audio) activeAudio = null;
      onEnd?.();
    };
    audio.onerror = () => {
      if (activeAudio === audio) activeAudio = null;
      speakViaBrowser(trimmed, onEnd);
    };
    await audio.play();
    return 'gemini';
  } catch {
    speakViaBrowser(trimmed, onEnd);
    return 'browser';
  }
}
