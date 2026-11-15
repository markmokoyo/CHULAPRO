'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FlipHorizontal, Play, Video } from 'lucide-react';
import type { FillerOccurrence, HapticCueEvent } from '@cuepulse/shared';
import { getSessionVideo } from '@/services/videoStorage';

interface SessionVideoPlayerProps {
  sessionId: string;
  hapticCues: HapticCueEvent[];
  fillers: FillerOccurrence[];
}

function formatSec(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function SessionVideoPlayer({
  sessionId,
  hapticCues,
  fillers,
}: SessionVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mirrored, setMirrored] = useState(true);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    setLoading(true);
    void getSessionVideo(sessionId).then((blob) => {
      if (!active) return;
      if (blob) {
        createdUrl = URL.createObjectURL(blob);
        setVideoUrl(createdUrl);
      } else {
        setVideoUrl(null);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [sessionId]);

  const jumpMoments = useMemo(() => {
    const items: Array<{
      id: string;
      timeSec: number;
      label: string;
      kind: 'cue' | 'filler';
    }> = [];

    for (const cue of hapticCues) {
      items.push({
        id: `cue-${cue.id}`,
        timeSec: Math.max(0, Math.floor(cue.timestampMs / 1000)),
        label: cue.messageTh,
        kind: 'cue',
      });
    }

    for (let i = 0; i < fillers.length; i++) {
      const f = fillers[i];
      items.push({
        id: `filler-${i}-${f.timestampMs}`,
        timeSec: Math.max(0, Math.floor(f.timestampMs / 1000)),
        label: `คำฟุ่มเฟือย: "${f.word}"`,
        kind: 'filler',
      });
    }

    return items.sort((a, b) => a.timeSec - b.timeSec).slice(0, 12);
  }, [hapticCues, fillers]);

  const seekTo = (sec: number) => {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, sec - 1);
    void el.play().catch(() => {
      // Ignore autoplay restriction
    });
  };

  if (loading) {
    return (
      <section className="rounded-2xl border border-[#E8DCE0] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Video className="h-4 w-4 text-[#EC3D6A]" />
          กำลังโหลดวิดีโอบันทึกการซ้อมย้อนหลัง...
        </div>
      </section>
    );
  }

  if (!videoUrl) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-[#E8DCE0] bg-white p-5 sm:p-6 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#BE2257]">
            Session Video Replay
          </span>
          <h2 className="text-base font-bold text-[#1F161A] flex items-center gap-2">
            <Video className="h-4 w-4 text-[#EC3D6A]" />
            วิดีโอบันทึกการนำเสนอย้อนหลัง
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMirrored((v) => !v)}
            className="app-press inline-flex items-center gap-1.5 rounded-xl border border-[#D8C5CB] bg-white hover:bg-[#FAF6F7] px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            <FlipHorizontal className="h-3.5 w-3.5 text-[#EC3D6A]" />
            {mirrored ? 'ภาพกระจก (ซ้าย-ขวา)' : 'ภาพมุมจริง'}
          </button>

          <a
            href={videoUrl}
            download={`cuepulse-${sessionId}.webm`}
            className="app-press inline-flex items-center gap-1.5 rounded-xl border border-[#D8C5CB] bg-[#FAF6F7] hover:bg-[#FCE8EE] px-3 py-1.5 text-xs font-semibold text-[#BE2257]"
          >
            <Download className="h-3.5 w-3.5" />
            ดาวน์โหลดคลิป
          </a>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#DDD6FE] bg-[#362947]">
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          playsInline
          className={`w-full max-h-[460px] object-contain ${
            mirrored ? '-scale-x-100' : ''
          }`}
        />
      </div>

      {jumpMoments.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-600">
            คลิกเพื่อกระโดดไปดูจังหวะที่ระบบแจ้งเตือนหรือพบคำฟุ่มเฟือย:
          </div>
          <div className="flex flex-wrap gap-2">
            {jumpMoments.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => seekTo(m.timeSec)}
                className={`app-press inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                  m.kind === 'cue'
                    ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                    : 'border-[#F5C6D4] bg-[#FCE8EE] text-[#BE2257] hover:bg-[#FBD8E3]'
                }`}
              >
                <Play className="h-3 w-3" />
                <span className="font-bold tabular-nums">{formatSec(m.timeSec)}</span>
                <span className="truncate max-w-[200px]">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
