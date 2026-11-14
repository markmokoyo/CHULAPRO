'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera,
  Eye,
  EyeOff,
  Gauge,
  Loader2,
  Square,
  UserCheck,
} from 'lucide-react';
import {
  buildSessionReport,
  CooldownManager,
  detectLexicalFillers,
  SPM_THRESHOLDS,
  VISION_RULES,
  type AlertReason,
  type AudienceMessage,
  type AudiencePersonaId,
  type FillerOccurrence,
  type HapticCueEvent,
  type PresentationPlan,
  type TelemetrySnapshot,
  type TranscriptSegment,
} from '@cuepulse/shared';
import {
  createMediaPipeBundle,
  drawVisionOverlay,
  type MediaPipeBundle,
} from '@/engines/vision/mediapipeRunner';
import {
  analyzePostureAndGaze,
  computeEarToShoulderRatio,
  computeHipCenterX,
  type PostureBaseline,
} from '@/engines/vision/postureGeometry';
import { WebAudioProsodyEngine } from '@/engines/audio/audioAnalyzer';
import { ThaiSpeechRecognizer } from '@/engines/audio/speechRecognition';
import { WatchSimulatorHUD } from '@/components/studio/WatchSimulatorHUD';
import { SlideTeleprompter } from '@/components/studio/SlideTeleprompter';
import { AudiencePanel } from '@/components/studio/AudiencePanel';
import { getActivePlan, saveSessionReport } from '@/services/storage';

export default function SoloPracticePage() {
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const bundleRef = useRef<MediaPipeBundle | null>(null);
  const audioRef = useRef<WebAudioProsodyEngine | null>(null);
  const speechRef = useRef<ThaiSpeechRecognizer | null>(null);
  const cooldownRef = useRef<CooldownManager>(new CooldownManager(20_000));

  const [plan, setPlan] = useState<PresentationPlan | null>(null);
  const [useSlides, setUseSlides] = useState(true);
  const [freeformTopic, setFreeformTopic] = useState('');
  const [freeformScript, setFreeformScript] = useState('');
  const [rightTab, setRightTab] = useState<'prompt' | 'audience'>('prompt');
  const [slideIdx, setSlideIdx] = useState(0);
  const [slideElapsedSec, setSlideElapsedSec] = useState(0);

  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [liveAlertsEnabled, setLiveAlertsEnabled] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [elapsedSec, setElapsedSec] = useState(0);
  const [liveSpm, setLiveSpm] = useState(0);
  const [liveEyeScore, setLiveEyeScore] = useState(100);
  const [livePostureScore, setLivePostureScore] = useState(100);
  const [interimText, setInterimText] = useState('');
  const [activeCue, setActiveCue] = useState<HapticCueEvent | null>(null);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);

  const [personaId, setPersonaId] = useState<AudiencePersonaId>('judge');
  const [audienceMessages, setAudienceMessages] = useState<AudienceMessage[]>([]);

  // Mutable session accumulators
  const sessionStartMsRef = useRef(0);
  const baselineRef = useRef<PostureBaseline | null>(null);
  const hipHistoryRef = useRef<number[]>([]);
  const timelineRef = useRef<TelemetrySnapshot[]>([]);
  const fillersRef = useRef<FillerOccurrence[]>([]);
  const cuesRef = useRef<HapticCueEvent[]>([]);
  const transcriptsRef = useRef<TranscriptSegment[]>([]);
  const eyeLostSinceRef = useRef<number | null>(null);
  const badPostureSinceRef = useRef<number | null>(null);
  const fastSinceRef = useRef<number | null>(null);
  const liveAlertsRef = useRef(liveAlertsEnabled);
  const showOverlayRef = useRef(showOverlay);
  const slideIdxRef = useRef(slideIdx);
  const slideWarnedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    liveAlertsRef.current = liveAlertsEnabled;
  }, [liveAlertsEnabled]);

  useEffect(() => {
    showOverlayRef.current = showOverlay;
  }, [showOverlay]);

  useEffect(() => {
    slideIdxRef.current = slideIdx;
    setSlideElapsedSec(0);
  }, [slideIdx]);

  useEffect(() => {
    setPlan(getActivePlan());
  }, []);

  const triggerCue = useCallback(
    (nowRelMs: number, reason: AlertReason) => {
      const slideNum = (plan?.slides[slideIdxRef.current]?.slideNumber ?? 1);
      const cue = cooldownRef.current.tryTrigger(nowRelMs, reason, slideNum);
      if (!cue) return;
      cuesRef.current.push(cue);

      if (liveAlertsRef.current) {
        setActiveCue(cue);
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          const pattern =
            cue.pattern === 'SOFT_TICK'
              ? [80]
              : cue.pattern === 'DOUBLE_PULSE'
              ? [100, 60, 100]
              : [300];
          navigator.vibrate(pattern);
        }
        setTimeout(() => {
          setActiveCue((curr) => (curr?.id === cue.id ? null : curr));
        }, 3200);
      }
    },
    [plan]
  );

  const stopEngines = useCallback(() => {
    audioRef.current?.stop();
    speechRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopEngines();
      bundleRef.current?.close();
      bundleRef.current = null;
    };
  }, [stopEngines]);

  const startSession = async () => {
    setStatusError(null);
    setIsLoadingModels(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if (!bundleRef.current) {
        bundleRef.current = await createMediaPipeBundle(1);
      }

      const audioEngine = new WebAudioProsodyEngine();
      await audioEngine.start(stream);
      audioRef.current = audioEngine;

      const recognizer = new ThaiSpeechRecognizer();
      recognizer.start({
        onFinalTranscript: (text) => {
          const relMs = Date.now() - sessionStartMsRef.current;
          const slideNum = plan?.slides[slideIdxRef.current]?.slideNumber ?? 1;
          transcriptsRef.current.push({
            speakerId: 'solo',
            text,
            startMs: Math.max(0, relMs - 2000),
            endMs: relMs,
          });
          const found = detectLexicalFillers(text, relMs, slideNum, 'solo');
          if (found.length > 0) {
            fillersRef.current.push(...found);
            triggerCue(relMs, 'FILLER_WORD');
          }
          setInterimText('');
        },
        onInterimTranscript: (text) => setInterimText(text),
      });
      speechRef.current = recognizer;

      sessionStartMsRef.current = Date.now();
      baselineRef.current = null;
      hipHistoryRef.current = [];
      timelineRef.current = [];
      fillersRef.current = [];
      cuesRef.current = [];
      transcriptsRef.current = [];
      slideWarnedRef.current.clear();
      cooldownRef.current.reset();
      setElapsedSec(0);
      setSlideElapsedSec(0);
      setIsRunning(true);
    } catch (err) {
      setStatusError(
        err instanceof Error
          ? err.message
          : 'ไม่สามารถเปิดกล้องหรือไมโครโฟนได้ กรุณาอนุญาตสิทธิ์ในเบราว์เซอร์'
      );
      stopEngines();
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Main 12 FPS Vision + Audio loop
  useEffect(() => {
    if (!isRunning) return;
    const intervalMs = Math.round(1000 / VISION_RULES.TARGET_FPS);

    const visionTimer = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const bundle = bundleRef.current;
      if (!video || !bundle || video.readyState < 2) return;

      const relMs = Date.now() - sessionStartMsRef.current;
      const { pose, faces, hands } = bundle.detectFrame(video);
      const face = faces[0];

      if (canvas) {
        if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (showOverlayRef.current) {
            drawVisionOverlay(
              ctx,
              canvas.width,
              canvas.height,
              pose,
              faces,
              hands
            );
          } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }
      }

      // 3-second baseline calibration
      if (!baselineRef.current && pose && relMs <= VISION_RULES.CALIBRATION_DURATION_MS) {
        const ratio = computeEarToShoulderRatio(pose);
        const hipX = computeHipCenterX(pose);
        if (ratio !== null && hipX !== null) {
          baselineRef.current = {
            earToShoulderRatio: ratio,
            hipCenterX: hipX,
            calibratedAtMs: relMs,
          };
        }
      }

      if (pose) {
        const hipX = computeHipCenterX(pose);
        if (hipX !== null) {
          hipHistoryRef.current.push(hipX);
          if (hipHistoryRef.current.length > 36) hipHistoryRef.current.shift();
        }
      }

      const visionMetrics = analyzePostureAndGaze({
        pose,
        face,
        baseline: baselineRef.current,
        recentHipXHistory: hipHistoryRef.current,
      });

      const audioMetrics = audioRef.current?.sample(relMs) ?? {
        dbfs: -100,
        isSpeaking: false,
        pitchHz: null,
        currentSpm: 0,
        acousticFillerDetected: false,
      };

      const slideNum = plan?.slides[slideIdxRef.current]?.slideNumber ?? 1;

      if (audioMetrics.acousticFillerDetected) {
        fillersRef.current.push({
          word: 'อืม/อ่า (เสียงลาก)',
          layer: 'acoustic',
          timestampMs: relMs,
          slideNumber: slideNum,
          speakerId: 'solo',
        });
        triggerCue(relMs, 'FILLER_WORD');
      }

      // Sustained rule checks
      if (visionMetrics.eyeContactScore < 0.55) {
        eyeLostSinceRef.current ??= relMs;
        if (relMs - eyeLostSinceRef.current >= VISION_RULES.EYE_CONTACT_LOST_SUSTAIN_MS) {
          triggerCue(relMs, 'EYE_CONTACT_LOST');
          eyeLostSinceRef.current = relMs;
        }
      } else {
        eyeLostSinceRef.current = null;
      }

      if (visionMetrics.isSlouching || visionMetrics.isArmsCrossed) {
        badPostureSinceRef.current ??= relMs;
        if (relMs - badPostureSinceRef.current >= VISION_RULES.BAD_POSTURE_SUSTAIN_MS) {
          triggerCue(relMs, 'BAD_POSTURE');
          badPostureSinceRef.current = relMs;
        }
      } else {
        badPostureSinceRef.current = null;
      }

      if (audioMetrics.currentSpm > SPM_THRESHOLDS.TOO_FAST) {
        fastSinceRef.current ??= relMs;
        if (relMs - fastSinceRef.current >= SPM_THRESHOLDS.FAST_SUSTAIN_MS) {
          triggerCue(relMs, 'SPEAKING_TOO_FAST');
          fastSinceRef.current = relMs;
        }
      } else {
        fastSinceRef.current = null;
      }

      timelineRef.current.push({
        timestampMs: relMs,
        currentSpm: audioMetrics.currentSpm,
        eyeContactScore: visionMetrics.eyeContactScore,
        postureScore: visionMetrics.postureScore,
        isSlouching: visionMetrics.isSlouching,
        isArmsCrossed: visionMetrics.isArmsCrossed,
        isSwaying: visionMetrics.isSwaying,
        isSpeaking: audioMetrics.isSpeaking,
      });

      setLiveSpm(audioMetrics.currentSpm);
      setLiveEyeScore(Math.round(visionMetrics.eyeContactScore * 100));
      setLivePostureScore(Math.round(visionMetrics.postureScore * 100));
      setCooldownRemainingMs(cooldownRef.current.remainingCooldownMs(relMs));
    }, intervalMs);

    const secTimer = setInterval(() => {
      setElapsedSec((s) => s + 1);
      setSlideElapsedSec((s) => {
        const next = s + 1;
        const activeSlide = plan?.slides[slideIdxRef.current];
        if (
          activeSlide &&
          activeSlide.allocatedSeconds - next === 10 &&
          !slideWarnedRef.current.has(activeSlide.slideNumber)
        ) {
          slideWarnedRef.current.add(activeSlide.slideNumber);
          const relMs = Date.now() - sessionStartMsRef.current;
          triggerCue(relMs, 'SLIDE_TIME_WARNING');
        }
        return next;
      });
    }, 1000);

    return () => {
      clearInterval(visionTimer);
      clearInterval(secTimer);
    };
  }, [isRunning, plan, triggerCue]);

  const finishAndSave = () => {
    stopEngines();
    setIsRunning(false);
    const activePlan = useSlides ? plan : null;
    const report = buildSessionReport({
      sessionId: `solo-${Date.now()}`,
      planId: activePlan?.id,
      topicTitle: !activePlan ? freeformTopic.trim() || undefined : undefined,
      speakerScript: !activePlan ? freeformScript.trim() || undefined : undefined,
      durationSeconds: Math.max(1, elapsedSec),
      telemetryTimeline: timelineRef.current,
      fillers: fillersRef.current,
      hapticCues: cuesRef.current,
      transcriptSegments: transcriptsRef.current,
    });
    report.audienceHistory = audienceMessages;
    saveSessionReport(report);
    router.push(`/report/${report.sessionId}`);
  };

  const activePlan = useSlides ? plan : null;
  const currentSlide = activePlan?.slides[slideIdx];
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
  const ss = String(elapsedSec % 60).padStart(2, '0');
  const spmStatus =
    liveSpm === 0
      ? { label: 'รอเสียงพูด', cls: 'bg-slate-100 text-slate-600' }
      : liveSpm > 220
        ? { label: 'พูดเร็วไป', cls: 'bg-amber-100 text-amber-800' }
        : liveSpm < 180
          ? { label: 'พูดช้าไป', cls: 'bg-[#FFE0EA] text-[#BE2257]' }
          : { label: 'เหมาะสม 180-220', cls: 'bg-emerald-100 text-emerald-700' };
  const spmPct = Math.min(100, Math.round((liveSpm / 260) * 100));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1F161A]">
            ห้องซ้อมพูดเดี่ยว
          </h1>
          <p className="text-xs text-slate-500">
            เปิดกล้องและไมโครโฟนเพื่อจับจังหวะการพูด คำติดปาก และการสบตาผู้ฟัง
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => setShowOverlay((v) => !v)}
            className="app-press inline-flex items-center gap-1.5 rounded-xl border border-[#D8C5CB] bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-[#FAF6F7]"
          >
            {showOverlay ? (
              <Eye className="h-4 w-4 text-[#EC3D6A]" />
            ) : (
              <EyeOff className="h-4 w-4 text-slate-400" />
            )}
            เส้นโครงท่าทาง
          </button>

          {!isRunning ? (
            <button
              type="button"
              disabled={isLoadingModels}
              onClick={() => void startSession()}
              className="app-press flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-[#EC3D6A] hover:bg-[#E13C6C] px-4 py-2 text-sm font-bold text-white shadow-sm disabled:opacity-50"
            >
              {isLoadingModels ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              {isLoadingModels ? 'กำลังเตรียมกล้องและไมค์...' : 'เริ่มซ้อม'}
            </button>
          ) : (
            <button
              type="button"
              onClick={finishAndSave}
              className="app-press flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-sm font-bold text-white shadow-sm"
            >
              <Square className="h-4 w-4" />
              จบการซ้อม & ดูผล ({mm}:{ss})
            </button>
          )}
        </div>
      </div>

      {statusError && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
          {statusError}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Left: Camera + Live Metrics */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-[#E8DCE0] bg-slate-900 shadow-sm">
            <video
              ref={videoRef}
              muted
              playsInline
              className="h-full w-full object-cover -scale-x-100"
            />
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100"
            />

            {/* Native Camera Floating HUD Pills */}
            <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/75 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isRunning ? 'bg-rose-500 animate-pulse' : 'bg-[#FF8FAB]'
                  }`}
                />
                {isRunning ? `กำลังบันทึกซ้อม • ${mm}:${ss}` : 'เตรียมพร้อมเปิดกล้อง'}
              </div>

              {activePlan && (
                <div className="inline-flex items-center rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#BE2257] shadow-sm backdrop-blur-sm">
                  สไลด์ {slideIdx + 1} / {activePlan.slides.length}
                </div>
              )}
            </div>

            {!isRunning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#FAF6F7]/95 backdrop-blur-sm text-center p-6">
                <img
                  src="/images/camera-guide.svg"
                  alt="กรอบจัดตำแหน่งหน้ากล้อง"
                  className="w-52 sm:w-64 h-auto mb-3"
                />
                <p className="text-sm font-bold text-[#1F161A]">
                  จัดใบหน้าให้อยู่ในกรอบ แล้วกด &ldquo;เริ่มซ้อม&rdquo;
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  ช่วง 3 วินาทีแรกระบบจะปรับเทียบท่ายืน/ท่านั่งปกติอัตโนมัติ
                </p>
              </div>
            )}
          </div>

          {/* Live Gauges */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="app-card rounded-2xl border border-[#E8DCE0] bg-white p-3.5 shadow-sm space-y-2">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Gauge className="h-3.5 w-3.5 text-[#EC3D6A]" />
                  ความเร็ว (SPM)
                </div>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${spmStatus.cls}`}
                >
                  {spmStatus.label}
                </span>
              </div>
              <div className="text-xl font-bold text-[#1F161A] tabular-nums">
                {liveSpm}{' '}
                <span className="text-xs font-normal text-slate-400">
                  / 180-220
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F5EEF0]">
                <div
                  className="h-full rounded-full bg-[#EC3D6A] transition-all duration-300"
                  style={{ width: `${spmPct}%` }}
                />
              </div>
            </div>

            <div className="app-card rounded-2xl border border-[#E8DCE0] bg-white p-3.5 shadow-sm space-y-2">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <Eye className="h-3.5 w-3.5 text-[#E13C6C]" />
                  สบตาผู้ฟัง
                </div>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                    !isRunning
                      ? 'bg-[#FCE8EE] text-[#BE2257]'
                      : liveEyeScore >= 75
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {!isRunning
                    ? 'พร้อมตรวจ'
                    : liveEyeScore >= 75
                      ? 'ดีเยี่ยม'
                      : 'มองกล้องเพิ่ม'}
                </span>
              </div>
              <div className="text-xl font-bold text-[#1F161A] tabular-nums">
                {liveEyeScore}%
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F5EEF0]">
                <div
                  className="h-full rounded-full bg-[#E13C6C] transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, liveEyeScore))}%` }}
                />
              </div>
            </div>

            <div className="app-card rounded-2xl border border-[#E8DCE0] bg-white p-3.5 shadow-sm space-y-2">
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <UserCheck className="h-3.5 w-3.5 text-[#CC6B92]" />
                  บุคลิกภาพ
                </div>
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                    !isRunning
                      ? 'bg-[#FCE8EE] text-[#BE2257]'
                      : livePostureScore >= 75
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {!isRunning
                    ? 'พร้อมตรวจ'
                    : livePostureScore >= 75
                      ? 'บุคลิกดี'
                      : 'ยืดไหล่ขึ้น'}
                </span>
              </div>
              <div className="text-xl font-bold text-[#1F161A] tabular-nums">
                {livePostureScore}%
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#F5EEF0]">
                <div
                  className="h-full rounded-full bg-[#CC6B92] transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, livePostureScore))}%` }}
                />
              </div>
            </div>
          </div>

          {interimText && (
            <div className="rounded-xl border border-[#E8DCE0] bg-white px-4 py-2.5 text-xs text-slate-700 shadow-sm">
              <span className="text-[#EC3D6A] font-semibold">กำลังพูด: </span>
              {interimText}
            </div>
          )}
        </div>

        {/* Right: Watch Simulator + Clean Tabbed Studio Panel */}
        <div className="lg:col-span-5 space-y-4">
          <WatchSimulatorHUD
            activeCue={activeCue}
            cooldownRemainingMs={cooldownRemainingMs}
            liveAlertsEnabled={liveAlertsEnabled}
            onToggleLiveAlerts={() => setLiveAlertsEnabled((v) => !v)}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              role="tablist"
              aria-label="แผงควบคุมฝั่งขวา"
              className="inline-flex rounded-xl border border-[#E8DCE0] bg-[#F5EEF0] p-1 text-xs"
            >
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === 'prompt'}
                onClick={() => setRightTab('prompt')}
                className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                  rightTab === 'prompt'
                    ? 'bg-white text-[#1F161A] shadow-sm'
                    : 'text-slate-600 hover:text-[#EC3D6A]'
                }`}
              >
                สไลด์และสคริปต์
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === 'audience'}
                onClick={() => setRightTab('audience')}
                className={`rounded-lg px-3 py-1.5 font-semibold transition ${
                  rightTab === 'audience'
                    ? 'bg-white text-[#1F161A] shadow-sm'
                    : 'text-slate-600 hover:text-[#EC3D6A]'
                }`}
              >
                จำลองคำถามผู้ฟัง
              </button>
            </div>

            {plan && (
              <button
                type="button"
                onClick={() => setUseSlides((v) => !v)}
                className="rounded-lg border border-[#D8C5CB] bg-white hover:bg-[#FCE8EE] px-2.5 py-1.5 text-[11px] font-semibold text-[#1F161A] transition"
              >
                {useSlides ? 'ซ้อมแบบไม่ใช้สไลด์' : 'กลับมาใช้แผนสไลด์'}
              </button>
            )}
          </div>

          {rightTab === 'prompt' ? (
            <SlideTeleprompter
              plan={activePlan}
              currentSlideIndex={slideIdx}
              slideElapsedSeconds={slideElapsedSec}
              onPrevSlide={() => setSlideIdx((i) => Math.max(0, i - 1))}
              onNextSlide={() =>
                setSlideIdx((i) =>
                  activePlan ? Math.min(activePlan.slides.length - 1, i + 1) : i
                )
              }
              onSelectSlide={(idx) => setSlideIdx(idx)}
              freeformTopic={freeformTopic}
              onChangeFreeformTopic={setFreeformTopic}
              freeformScript={freeformScript}
              onChangeFreeformScript={setFreeformScript}
            />
          ) : (
            <AudiencePanel
              personaId={personaId}
              onChangePersona={setPersonaId}
              slideContext={
                currentSlide?.extractedText ||
                freeformTopic ||
                freeformScript ||
                'การซ้อมนำเสนอปากเปล่า'
              }
              recentTranscript={
                transcriptsRef.current
                  .slice(-3)
                  .map((t) => t.text)
                  .join(' ') || interimText
              }
              messages={audienceMessages}
              onNewMessage={(m) => setAudienceMessages((prev) => [m, ...prev])}
            />
          )}
        </div>
      </div>
    </div>
  );
}
