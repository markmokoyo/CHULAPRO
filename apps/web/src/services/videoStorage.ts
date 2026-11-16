'use client';

const DB_NAME = 'cuepulse_videos_v1';
const STORE_NAME = 'session_videos';
const MAX_STORED_VIDEOS = 5;

const memoryVideoCache = new Map<string, Blob>();

function openVideoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'sessionId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open video DB'));
  });
}

export async function saveSessionVideo(sessionId: string, blob: Blob): Promise<void> {
  if (!sessionId || blob.size === 0) return;
  memoryVideoCache.set(sessionId, blob);

  try {
    const db = await openVideoDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put({
        sessionId,
        blob,
        createdAt: Date.now(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Keep only the most recent MAX_STORED_VIDEOS to respect browser storage
    const allItems = await new Promise<Array<{ sessionId: string; createdAt: number }>>(
      (resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () =>
          resolve(
            (req.result as Array<{ sessionId: string; createdAt?: number }>).map(
              (item) => ({
                sessionId: item.sessionId,
                createdAt: item.createdAt ?? 0,
              })
            )
          );
        req.onerror = () => resolve([]);
      }
    );

    if (allItems.length > MAX_STORED_VIDEOS) {
      const toDelete = allItems
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(MAX_STORED_VIDEOS);
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const item of toDelete) {
          store.delete(item.sessionId);
          memoryVideoCache.delete(item.sessionId);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }
    db.close();
  } catch {
    // Fallback remains in memoryVideoCache for the immediate report view
  }
}

export async function getSessionVideo(sessionId: string): Promise<Blob | null> {
  const cached = memoryVideoCache.get(sessionId);
  if (cached) return cached;

  try {
    const db = await openVideoDb();
    const record = await new Promise<{ blob?: Blob } | undefined>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(sessionId);
      req.onsuccess = () => resolve(req.result as { blob?: Blob } | undefined);
      req.onerror = () => resolve(undefined);
    });
    db.close();
    if (record?.blob) {
      memoryVideoCache.set(sessionId, record.blob);
      return record.blob;
    }
    return null;
  } catch {
    return null;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx !== -1 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

export async function extractVideoPayloadForAi(blob: Blob): Promise<{
  videoBase64?: { mimeType: string; data: string };
  frames?: Array<{ mimeType: string; data: string }>;
}> {
  // Send raw video directly if small enough to stay safely under Vercel 4.5MB limit
  if (blob.size > 0 && blob.size <= 2_400_000) {
    const base64 = await blobToBase64(blob);
    const mimeType = (blob.type || 'video/webm').split(';')[0] || 'video/webm';
    return { videoBase64: { mimeType, data: base64 } };
  }

  // Otherwise extract 5 evenly-spaced JPEG keyframes from the recorded video
  if (typeof document === 'undefined') return {};
  const url = URL.createObjectURL(blob);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => resolve(), 2000);
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error('Video load failed'));
      };
    });

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 10;
    const sampleCount = 5;
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 270;
    const ctx = canvas.getContext('2d');
    if (!ctx) return {};

    const frames: Array<{ mimeType: string; data: string }> = [];
    for (let i = 0; i < sampleCount; i++) {
      const targetTime = Math.min(
        Math.max(0.2, duration - 0.2),
        (duration * (i + 0.5)) / sampleCount
      );
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => resolve(), 1200);
        video.onseeked = () => {
          clearTimeout(timer);
          resolve();
        };
        try {
          video.currentTime = targetTime;
        } catch {
          clearTimeout(timer);
          resolve();
        }
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      const base64 = dataUrl.split(',')[1];
      if (base64) {
        frames.push({ mimeType: 'image/jpeg', data: base64 });
      }
    }

    return { frames };
  } catch {
    return {};
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface SessionVideoRecorder {
  stop: () => Promise<Blob | null>;
}

export function createSessionVideoRecorder(stream: MediaStream): SessionVideoRecorder | null {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return null;
  }

  const candidateTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ];
  const mimeType = candidateTypes.find((t) => MediaRecorder.isTypeSupported(t));

  try {
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_200_000 })
      : new MediaRecorder(stream);

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        chunks.push(ev.data);
      }
    };

    recorder.start(1000);

    return {
      stop: () =>
        new Promise<Blob | null>((resolve) => {
          if (recorder.state === 'inactive') {
            resolve(
              chunks.length > 0
                ? new Blob(chunks, { type: recorder.mimeType || 'video/webm' })
                : null
            );
            return;
          }
          let settled = false;
          const finish = (blob: Blob | null) => {
            if (settled) return;
            settled = true;
            resolve(blob);
          };
          const timer = setTimeout(() => {
            finish(
              chunks.length > 0
                ? new Blob(chunks, { type: recorder.mimeType || 'video/webm' })
                : null
            );
          }, 1500);

          recorder.onstop = () => {
            clearTimeout(timer);
            if (chunks.length === 0) {
              finish(null);
              return;
            }
            finish(new Blob(chunks, { type: recorder.mimeType || 'video/webm' }));
          };
          try {
            recorder.stop();
          } catch {
            clearTimeout(timer);
            finish(null);
          }
        }),
    };
  } catch {
    return null;
  }
}
