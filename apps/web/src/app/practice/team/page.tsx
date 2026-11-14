'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Camera,
  FileText,
  Loader2,
  Maximize2,
  Minimize2,
  Plus,
  Square,
  Trash2,
  Users,
} from 'lucide-react';
import {
  buildTeamSessionReport,
  CooldownManager,
  detectLexicalFillers,
  VISION_RULES,
  type AlertReason,
  type FillerOccurrence,
  type HapticCueEvent,
  type PresentationPlan,
  type TeamMemberProfile,
  type TelemetrySnapshot,
  type TranscriptSegment,
} from '@cuepulse/shared';
import {
  createMediaPipeBundle,
  drawVisionOverlay,
  type MediaPipeBundle,
} from '@/engines/vision/mediapipeRunner';
import { analyzePostureAndGaze } from '@/engines/vision/postureGeometry';
import { TeamLipSyncTracker } from '@/engines/vision/lipSyncTracker';
import { WebAudioProsodyEngine } from '@/engines/audio/audioAnalyzer';
import { ThaiSpeechRecognizer } from '@/engines/audio/speechRecognition';
import { WatchSimulatorHUD } from '@/components/studio/WatchSimulatorHUD';
import { SlideTeleprompter } from '@/components/studio/SlideTeleprompter';
import { CameraEdgeAura } from '@/components/studio/CameraEdgeAura';
import { getActivePlan, saveSessionReport } from '@/services/storage';
import {
  createSessionVideoRecorder,
  saveSessionVideo,
  type SessionVideoRecorder,
} from '@/services/videoStorage';

export default function TeamPracticePage() {
  const router = useRouter();
  const [step, setStep] = useState<'enroll' | 'practice'>('enroll');
  const [members, setMembers] = useState<TeamMemberProfile[]>([
    {
      memberId: 'm1',
      name: 'สมาชิก 1',
      assignedSlides: [1],
      enrolledAt: new Date().toISOString(),
    },
    {
      memberId: 'm2',
      name: 'สมาชิก 2',
      assignedSlides: [2],
      enrolledAt: new Date().toISOString(),
    },
  ]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const bundleRef = useRef<MediaPipeBundle | null>(null);
  const audioRef = useRef<WebAudioProsodyEngine | null>(null);
  const speechRef = useRef<ThaiSpeechRecognizer | null>(null);
  const lipTrackerRef = useRef<TeamLipSyncTracker>(new TeamLipSyncTracker());
  const cooldownRef = useRef<CooldownManager>(new CooldownManager(20_000));

  const [plan, setPlan] = useState<PresentationPlan | null>(null);
  const [useSlides, setUseSlides] = useState(true);
  const [freeformTopic, setFreeformTopic] = useState('');
  const [freeformScript, setFreeformScript] = useState('');
  const [slideIdx, setSlideIdx] = useState(0);
  const [slideElapsedSec, setSlideElapsedSec] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [loading, setLoading] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | undefined>();
  const [activeCue, setActiveCue] = useState<HapticCueEvent | null>(null);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState(0);
  const [liveAlertsEnabled, setLiveAlertsEnabled] = useState(true);
  const [isFullscreenStage, setIsFullscreenStage] = useState(true);
  const [showPipPrompt, setShowPipPrompt] = useState(false);
  const [liveAuraReason, setLiveAuraReason] = useState<AlertReason | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionStartRef = useRef(0);
  const timelineRef = useRef<TelemetrySnapshot[]>([]);
  const fillersRef = useRef<FillerOccurrence[]>([]);
  const cuesRef = useRef<HapticCueEvent[]>([]);
  const transcriptsRef = useRef<TranscriptSegment[]>([]);
  const activeSpeakerRef = useRef<string | undefined>(undefined);
  const liveAlertsRef = useRef(liveAlertsEnabled);
  const slideIdxRef = useRef(slideIdx);
  const recorderRef = useRef<SessionVideoRecorder | null>(null);
  const auraTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashAura = useCallback((reason: AlertReason, durationMs = 3200) => {
    setLiveAuraReason(reason);
    if (auraTimerRef.current) clearTimeout(auraTimerRef.current);
    auraTimerRef.current = setTimeout(() => {
      setLiveAuraReason((curr) => (curr === reason ? null : curr));
    }, durationMs);
  }, []);

  useEffect(() => {
    liveAlertsRef.current = liveAlertsEnabled;
  }, [liveAlertsEnabled]);

  useEffect(() => {
    slideIdxRef.current = slideIdx;
    setSlideElapsedSec(0);
  }, [slideIdx]);

  useEffect(() => {
    setPlan(getActivePlan());
  }, []);

  const triggerCue = useCallback(
    (nowRelMs: number, reason: AlertReason) => {
      const slideNum = plan?.slides[slideIdxRef.current]?.slideNumber ?? 1;
      const cue = cooldownRef.current.tryTrigger(nowRelMs, reason, slideNum);
      if (!cue) return;
      cuesRef.current.push(cue);
      if (liveAlertsRef.current) {
        setActiveCue(cue);
        flashAura(reason, 3200);
        setTimeout(() => {
          setActiveCue((curr) => (curr?.id === cue.id ? null : curr));
        }, 3200);
      }
    },
    [plan, flashAura]
  );

  const stopAll = useCallback(() => {
    if (auraTimerRef.current) {
      clearTimeout(auraTimerRef.current);
      auraTimerRef.current = null;
    }
    audioRef.current?.stop();
    speechRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      stopAll();
      bundleRef.current?.close();
      bundleRef.current = null;
    };
  }, [stopAll]);

  // Attach media stream cleanly once the practice <video> element is mounted
  useEffect(() => {
    if (step !== 'practice' || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play();
  }, [step]);

  const addMember = () => {
    setMembers((prev) => {
      if (prev.length >= 5) return prev;
      const nextNum =
        prev.reduce(
          (max, m) => Math.max(max, Number(m.memberId.replace(/\D/g, '')) || 0),
          0
        ) + 1;
      return [
        ...prev,
        {
          memberId: `m${nextNum}`,
          name: `สมาชิก ${nextNum}`,
          assignedSlides: [nextNum],
          enrolledAt: new Date().toISOString(),
        },
      ];
    });
  };

  const removeMember = (id: string) => {
    if (members.length <= 2) return;
    setMembers((prev) => prev.filter((m) => m.memberId !== id));
  };

  const startTeamSession = async () => {
    setError(null);
    setLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: true,
      });
      streamRef.current = stream;
      setStep('practice');

      if (!bundleRef.current) {
        bundleRef.current = await createMediaPipeBundle(members.length);
      }

      const audioEngine = new WebAudioProsodyEngine();
      await audioEngine.start(stream);
      audioRef.current = audioEngine;

      const recognizer = new ThaiSpeechRecognizer();
      recognizer.start({
        onFinalTranscript: (text) => {
          const relMs = Date.now() - sessionStartRef.current;
          const speaker = activeSpeakerRef.current ?? members[0]?.memberId ?? 'm1';
          const slideNum = plan?.slides[slideIdxRef.current]?.slideNumber ?? 1;
          transcriptsRef.current.push({
            speakerId: speaker,
            text,
            startMs: Math.max(0, relMs - 2000),
            endMs: relMs,
          });
          const found = detectLexicalFillers(text, relMs, slideNum, speaker);
          if (found.length > 0) {
            fillersRef.current.push(...found);
            flashAura('FILLER_WORD', 3000);
            triggerCue(relMs, 'FILLER_WORD');
          }
        },
      });
      speechRef.current = recognizer;

      sessionStartRef.current = Date.now();
      timelineRef.current = [];
      fillersRef.current = [];
      cuesRef.current = [];
      transcriptsRef.current = [];
      lipTrackerRef.current.reset();
      cooldownRef.current.reset();
      recorderRef.current = createSessionVideoRecorder(stream);
      setLiveAuraReason(null);
      setIsFullscreenStage(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'ไม่สามารถเปิดกล้องหรือไมโครโฟนสำหรับโหมดทีมได้'
      );
      setStep('enroll');
      stopAll();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (step !== 'practice') return;
    const intervalMs = Math.round(1000 / VISION_RULES.TARGET_FPS);

    const timer = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const bundle = bundleRef.current;
      if (!video || !bundle || video.readyState < 2) return;

      const relMs = Date.now() - sessionStartRef.current;
      const { pose, faces } = bundle.detectFrame(video);

      if (canvas) {
        if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) drawVisionOverlay(ctx, canvas.width, canvas.height, pose, faces);
      }

      const audioMetrics = audioRef.current?.sample(relMs) ?? {
        dbfs: -100,
        isSpeaking: false,
        pitchHz: null,
        currentSpm: 0,
        acousticFillerDetected: false,
      };

      const matchedFaces = lipTrackerRef.current.matchFacesToMembers(faces, members);
      const detectedSpeaker = lipTrackerRef.current.detectActiveSpeaker(
        faces,
        members,
        audioMetrics.isSpeaking
      );
      if (detectedSpeaker) {
        activeSpeakerRef.current = detectedSpeaker;
        setActiveSpeakerId(detectedSpeaker);
      }

      if (audioMetrics.acousticFillerDetected) {
        const slideNum = plan?.slides[slideIdxRef.current]?.slideNumber ?? 1;
        fillersRef.current.push({
          word: 'อืม/อ่า (เสียงลาก)',
          layer: 'acoustic',
          timestampMs: relMs,
          slideNumber: slideNum,
          speakerId: detectedSpeaker ?? activeSpeakerRef.current ?? members[0]?.memberId,
        });
        flashAura('FILLER_WORD', 3000);
        triggerCue(relMs, 'FILLER_WORD');
      }

      setCooldownRemainingMs(cooldownRef.current.remainingCooldownMs(relMs));

      const speakerId = detectedSpeaker ?? activeSpeakerRef.current;
      const activeFace = (speakerId ? matchedFaces.get(speakerId) : undefined) ?? faces[0];
      const visionMetrics = analyzePostureAndGaze({
        pose,
        face: activeFace,
        baseline: null,
        recentHipXHistory: [],
      });

      timelineRef.current.push({
        timestampMs: relMs,
        currentSpm: audioMetrics.currentSpm,
        eyeContactScore: visionMetrics.eyeContactScore,
        postureScore: visionMetrics.postureScore,
        isSlouching: visionMetrics.isSlouching,
        isArmsCrossed: visionMetrics.isArmsCrossed,
        isSwaying: visionMetrics.isSwaying,
        isSpeaking: audioMetrics.isSpeaking,
        activeSpeakerId: detectedSpeaker ?? activeSpeakerRef.current,
      });
    }, intervalMs);

    const secTimer = setInterval(() => {
      setElapsedSec((s) => s + 1);
      setSlideElapsedSec((s) => s + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
      clearInterval(secTimer);
    };
  }, [step, members, plan, triggerCue]);

  const finishTeamSession = async () => {
    const recordedBlob = recorderRef.current ? await recorderRef.current.stop() : null;
    recorderRef.current = null;
    stopAll();
    setLiveAuraReason(null);
    const activePlan = useSlides ? plan : null;
    const sessionId = `team-${Date.now()}`;
    if (recordedBlob) {
      await saveSessionVideo(sessionId, recordedBlob);
    }
    const report = buildTeamSessionReport({
      sessionId,
      planId: activePlan?.id,
      topicTitle: !activePlan ? freeformTopic.trim() || undefined : undefined,
      speakerScript: !activePlan ? freeformScript.trim() || undefined : undefined,
      durationSeconds: Math.max(1, elapsedSec),
      members,
      telemetryTimeline: timelineRef.current,
      fillers: fillersRef.current,
      hapticCues: cuesRef.current,
      transcriptSegments: transcriptsRef.current,
    });
    saveSessionReport(report);
    router.push(`/report/${report.sessionId}`);
  };

  const activePlan = useSlides ? plan : null;
  const activeMemberName =
    members.find((m) => m.memberId === activeSpeakerId)?.name ?? 'รอเสียงพูด...';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1F161A]">
            ห้องซ้อมนำเสนอเป็นกลุ่ม
          </h1>
          <p className="text-sm text-slate-500">
            ซ้อมพรีเซนต์กลุ่ม 2–5 คน แยกวิเคราะห์ผู้พูดจากริมฝีปากและติดตามความต่อเนื่องในการส่งไม้ต่อ
          </p>
        </div>

        {step === 'practice' && (
          <button
            type="button"
            onClick={() => void finishTeamSession()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-sm font-bold text-white shadow-sm"
          >
            <Square className="h-4 w-4" />
            จบซ้อมทีม & ดูรายงาน ({elapsedSec}s)
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {step === 'enroll' ? (
        <div className="rounded-2xl border border-[#E8DCE0] bg-white p-5 sm:p-6 space-y-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[#1F161A] flex items-center gap-2">
              <Users className="h-4 w-4 text-[#EC3D6A]" />
              ลงทะเบียนสมาชิกทีม ({members.length}/5 คน)
            </h2>
            <button
              type="button"
              disabled={members.length >= 5}
              onClick={addMember}
              className="app-press inline-flex items-center gap-1.5 rounded-xl border border-[#D8C5CB] bg-[#FAF6F7] hover:bg-[#FCE8EE] px-3 py-1.5 text-xs font-semibold text-[#BE2257] disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              เพิ่มสมาชิก
            </button>
          </div>

          <p className="text-xs text-slate-500">
            แนะนำ: ให้สมาชิกยืนเรียงหน้ากล้องจากซ้ายไปขวาตามลำดับรายชื่อด้านล่างเพื่อให้ระบบจับคู่ใบหน้ากับชื่อได้แม่นยำ
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((m, idx) => (
              <div
                key={m.memberId}
                className="rounded-xl border border-[#E8DCE0] bg-[#FAF6F7] p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#BE2257]">
                    ตำแหน่งที่ {idx + 1} (ซ้าย → ขวา)
                  </span>
                  {members.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeMember(m.memberId)}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={m.name}
                  onChange={(e) =>
                    setMembers((prev) =>
                      prev.map((item) =>
                        item.memberId === m.memberId
                          ? { ...item, name: e.target.value }
                          : item
                      )
                    )
                  }
                  placeholder="ชื่อสมาชิก"
                  className="w-full rounded-lg border border-[#D8C5CB] bg-white px-3 py-1.5 text-sm text-[#1F161A] focus:outline-none focus:border-[#EC3D6A]"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => void startTeamSession()}
            className="app-press w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#EC3D6A] hover:bg-[#E13C6C] px-5 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            เริ่มซ้อมโหมดทีม
          </button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="lg:col-span-7 space-y-4">
            <div
              className={
                isFullscreenStage
                  ? 'fixed inset-0 z-50 bg-slate-950 flex items-center justify-center overflow-hidden'
                  : 'relative aspect-video overflow-hidden rounded-2xl border border-[#E8DCE0] bg-slate-900 shadow-sm'
              }
            >
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

              <CameraEdgeAura reason={activeCue?.reason ?? liveAuraReason} />

              <div className="absolute inset-x-3 top-3 sm:inset-x-5 sm:top-4 z-30 flex flex-wrap items-center justify-between gap-2">
                <div className="pointer-events-none flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-900/75 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
                    <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                    กำลังบันทึกวิดีโอ • {String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:{String(elapsedSec % 60).padStart(2, '0')}
                  </div>
                  <div className="rounded-full bg-white/95 border border-[#E8DCE0] px-3 py-1.5 text-xs shadow-sm">
                    <span className="text-slate-500">ผู้พูดปัจจุบัน: </span>
                    <span className="font-bold text-[#BE2257]">{activeMemberName}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isFullscreenStage && (
                    <button
                      type="button"
                      onClick={() => setShowPipPrompt((v) => !v)}
                      className="app-press inline-flex items-center gap-1.5 rounded-full bg-slate-900/75 hover:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm"
                    >
                      <FileText className="h-3.5 w-3.5 text-[#FF8FAB]" />
                      {showPipPrompt ? 'ซ่อนสไลด์/สคริปต์' : 'ดูสไลด์/สคริปต์'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsFullscreenStage((v) => !v)}
                    className="app-press inline-flex items-center gap-1.5 rounded-full bg-slate-900/75 hover:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm"
                  >
                    {isFullscreenStage ? (
                      <>
                        <Minimize2 className="h-3.5 w-3.5" />
                        ย่อหน้าต่าง
                      </>
                    ) : (
                      <>
                        <Maximize2 className="h-3.5 w-3.5" />
                        เต็มจอ
                      </>
                    )}
                  </button>

                  {isFullscreenStage && (
                    <button
                      type="button"
                      onClick={() => void finishTeamSession()}
                      className="app-press inline-flex items-center gap-1.5 rounded-full bg-rose-600 hover:bg-rose-500 px-4 py-1.5 text-xs font-bold text-white shadow-lg"
                    >
                      <Square className="h-3.5 w-3.5" />
                      จบซ้อมทีม & ดูผล
                    </button>
                  )}
                </div>
              </div>

              {isFullscreenStage && showPipPrompt && (
                <div className="absolute bottom-16 right-4 z-30 w-80 max-w-[90vw] max-h-[60vh] overflow-y-auto rounded-2xl shadow-2xl">
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
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <WatchSimulatorHUD
              activeCue={activeCue}
              cooldownRemainingMs={cooldownRemainingMs}
              liveAlertsEnabled={liveAlertsEnabled}
              onToggleLiveAlerts={() => setLiveAlertsEnabled((v) => !v)}
            />
            {plan && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setUseSlides((v) => !v)}
                  className="rounded-lg border border-[#D8C5CB] bg-white hover:bg-[#FCE8EE] px-2.5 py-1 text-[11px] font-semibold text-[#1F161A] transition"
                >
                  {useSlides ? 'ซ้อมแบบไม่ใช้สไลด์' : 'กลับมาใช้แผนสไลด์'}
                </button>
              </div>
            )}
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
          </div>
        </div>
      )}
    </div>
  );
}
