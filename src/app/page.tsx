"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import { Gesture, classifyGesture, gestureLabel } from "@/lib/gestures";

type PlayerState = {
  isPlaying: boolean;
  volume: number;
  title: string;
  artist: string;
  album: string;
  image: string | null;
  progressMs: number;
  durationMs: number;
  device: string;
  lastCommand: string;
};

const demoTracks = [
  { title: "Neon Horizons", artist: "The Synthetic Skies", album: "Afterglow Protocol", durationMs: 214000, image: "linear-gradient(135deg,#f97316,#7c3aed)" },
  { title: "Midnight Signals", artist: "Velvet Circuit", album: "Digital Weather", durationMs: 188000, image: "linear-gradient(135deg,#0ea5e9,#172554)" },
  { title: "Electric Bloom", artist: "Lunar Arcade", album: "Soft Machines", durationMs: 242000, image: "linear-gradient(135deg,#10b981,#164e63)" },
];

const initialPlayer: PlayerState = {
  isPlaying: false,
  volume: 50,
  title: "Neon Horizons",
  artist: "The Synthetic Skies",
  album: "Afterglow Protocol",
  image: null,
  progressMs: 0,
  durationMs: 214000,
  device: "No active device",
  lastCommand: "Ready for a gesture",
};

export default function Home() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const landmarkerRef = useRef<{
    detectForVideo: (video: HTMLVideoElement, timestamp: number) => {
      landmarks?: Array<Array<{ x: number; y: number; z: number }>>;
    };
    close?: () => void;
  } | null>(null);
  const animationRef = useRef<number | null>(null);
  const processFrameRef = useRef<() => void>(() => undefined);
  const wristTrailRef = useRef<Array<{ x: number; y: number }>>([]);
  const lastGestureRef = useRef<{ gesture: Gesture; at: number } | null>(null);
  const candidateGestureRef = useRef<{ gesture: Gesture; frames: number } | null>(null);
  const [controlEnabled, setControlEnabled] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const [status, setStatus] = useState("Demo mode is ready");
  const [detectedGesture, setDetectedGesture] = useState("No gesture");
  const [cameraInfo, setCameraInfo] = useState("Camera is off");
  const [player, setPlayer] = useState(initialPlayer);
  const [authenticated, setAuthenticated] = useState(false);
  const [loadingPlayer, setLoadingPlayer] = useState(false);
  const demoTrackIndexRef = useRef(0);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [cameraTested, setCameraTested] = useState(false);
  const [cameraTestStatus, setCameraTestStatus] = useState("Camera test not run");

  useEffect(() => {
    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    const move = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        currentX += (targetX - currentX) * 0.18;
        currentY += (targetY - currentY) * 0.18;
        document.documentElement.style.setProperty("--cursor-x", `${currentX}px`);
        document.documentElement.style.setProperty("--cursor-y", `${currentY}px`);
        frame = 0;
        if (Math.abs(targetX - currentX) > 1 || Math.abs(targetY - currentY) > 1) move(event);
      });
    };
    window.addEventListener("pointermove", move);
    return () => {
      window.removeEventListener("pointermove", move);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const testCamera = async () => {
    setCameraTestStatus("Requesting camera access…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const track = stream.getVideoTracks()[0];
      setCameraTested(true);
      setCameraTestStatus(track?.label ? `Ready · ${track.label}` : "Camera ready");
      stream.getTracks().forEach((item) => item.stop());
    } catch (error) {
      setCameraTestStatus(error instanceof DOMException && error.name === "NotAllowedError"
        ? "Permission blocked. Allow camera access and try again."
        : "Camera unavailable. Check that no other app is using it.");
    }
  };

  const refreshPlayer = useCallback(async () => {
    if (demoMode) return;
    setLoadingPlayer(true);
    try {
      const response = await fetch("/api/player", { cache: "no-store" });
      const data = (await response.json()) as {
        authenticated?: boolean;
        error?: string;
        playing?: Omit<PlayerState, "lastCommand"> | null;
      };
      setAuthenticated(Boolean(data.authenticated));
      if (data.playing) setPlayer((current) => ({ ...current, ...data.playing }));
      if (data.error) setStatus(data.error);
      if (!data.authenticated) setStatus("Sign in with Spotify to control your player.");
    } catch {
      setStatus("Could not read Spotify player state.");
    } finally {
      setLoadingPlayer(false);
    }
  }, [demoMode]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refreshPlayer(), 0);
    const interval = demoMode ? undefined : window.setInterval(() => void refreshPlayer(), 3000);
    return () => {
      window.clearTimeout(initialRefresh);
      if (interval) window.clearInterval(interval);
    };
  }, [demoMode, refreshPlayer]);

  const executeCommand = useCallback(async (gesture: Gesture) => {
    const now = Date.now();
    const previous = lastGestureRef.current;
    if (previous?.gesture === gesture && now - previous.at < 1200) return;
    lastGestureRef.current = { gesture, at: now };

    const command = {
      pause: "pause",
      resume: "play",
      next: "next",
      previous: "previous",
      volumeUp: "volumeUp",
      volumeDown: "volumeDown",
      mute: "mute",
    }[gesture];

    if (demoMode) {
      setPlayer((current) => {
        if (command === "pause") return { ...current, isPlaying: false, lastCommand: "Paused" };
        if (command === "play") return { ...current, isPlaying: true, lastCommand: "Playing" };
        if (command === "volumeUp") return { ...current, volume: Math.min(100, current.volume + 5), lastCommand: "Volume up" };
        if (command === "volumeDown") return { ...current, volume: Math.max(0, current.volume - 5), lastCommand: "Volume down" };
        if (command === "mute") return { ...current, volume: 0, lastCommand: "Muted" };
        const nextIndex = command === "next"
          ? (demoTrackIndexRef.current + 1) % demoTracks.length
          : (demoTrackIndexRef.current - 1 + demoTracks.length) % demoTracks.length;
        demoTrackIndexRef.current = nextIndex;
        return { ...current, ...demoTracks[nextIndex], progressMs: 0, lastCommand: command === "next" ? "Next track" : "Previous track" };
      });
      return;
    }

    const response = await fetch("/api/player/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
    });
    const data = (await response.json()) as { message?: string; error?: string };
    setStatus(response.ok ? data.message ?? "Command sent" : data.error ?? "Spotify command failed");
    if (response.ok) void refreshPlayer();
  }, [demoMode, refreshPlayer]);

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker || video.readyState < 2) {
      animationRef.current = requestAnimationFrame(() => processFrameRef.current());
      return;
    }
    let result: { landmarks?: Array<Array<{ x: number; y: number; z: number }>> } = {};
    try {
      result = landmarker.detectForVideo(video, performance.now());
    } catch {
      setStatus("Vision model is warming up. Keep the camera on for a moment.");
      animationRef.current = requestAnimationFrame(() => processFrameRef.current());
      return;
    }
    const landmarks = result.landmarks?.[0];
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      context?.clearRect(0, 0, canvas.width, canvas.height);
      if (landmarks && context) {
        const wrist = { x: landmarks[0].x * canvas.width, y: landmarks[0].y * canvas.height };
        wristTrailRef.current = [...wristTrailRef.current, wrist].slice(-18);
        context.strokeStyle = "rgba(255,255,255,.55)";
        context.lineWidth = 2;
        context.beginPath();
        wristTrailRef.current.forEach((point, index) => index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y));
        context.stroke();
        const links = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
        context.strokeStyle = "#31d27c";
        context.lineWidth = 3;
        context.shadowColor = "#31d27c";
        context.shadowBlur = 8;
        for (const [start, end] of links) {
          context.beginPath();
          context.moveTo(landmarks[start].x * canvas.width, landmarks[start].y * canvas.height);
          context.lineTo(landmarks[end].x * canvas.width, landmarks[end].y * canvas.height);
          context.stroke();
        }
        context.shadowBlur = 0;
        for (const point of landmarks) {
          context.fillStyle = "#f5fff9";
          context.beginPath();
          context.arc(point.x * canvas.width, point.y * canvas.height, 4, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
    if (landmarks) {
      const gesture = classifyGesture(landmarks);
      setDetectedGesture(gestureLabel(gesture));
      if (gesture) {
        const candidate = candidateGestureRef.current;
        const frames = candidate?.gesture === gesture ? candidate.frames + 1 : 1;
        candidateGestureRef.current = { gesture, frames };
        if (frames >= 3) void executeCommand(gesture);
      } else {
        candidateGestureRef.current = null;
      }
    } else {
      setDetectedGesture("No hand detected");
      candidateGestureRef.current = null;
      wristTrailRef.current = [];
    }
    animationRef.current = requestAnimationFrame(() => processFrameRef.current());
  }, [executeCommand]);
  useEffect(() => {
    processFrameRef.current = processFrame;
  }, [processFrame]);

  useEffect(() => {
    if (!controlEnabled) return;
    let stream: MediaStream | undefined;
    let cancelled = false;
    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraInfo("Camera API unavailable");
        setStatus("This browser does not expose camera access. Use Chrome or Edge on HTTPS.");
        return;
      }
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }, audio: false });
        } catch (firstError) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } catch (secondError) {
            throw secondError instanceof DOMException ? secondError : firstError;
          }
        }
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const videoTrack = stream.getVideoTracks()[0];
        setCameraInfo(videoTrack?.label ? `Camera: ${videoTrack.label}` : "Camera stream active");
        setCameraReady(true);
        setStatus("Camera image active. Loading hand recognition...");
      } catch (error) {
        const domError = error instanceof DOMException ? error : null;
        const reason = domError?.name === "NotAllowedError"
          ? "Camera permission was blocked. Allow camera access in the browser address bar and try again."
          : domError?.name === "NotFoundError"
            ? "No camera was found. Connect a webcam or choose a camera in browser settings."
            : domError?.name === "NotReadableError"
              ? "Camera is busy in another app or browser tab. Close apps using the camera and try again."
              : `Camera could not start${domError?.name ? ` (${domError.name})` : ""}.`;
        setCameraInfo("Camera is unavailable");
        setStatus(domError?.message ? `${reason} Details: ${domError.message}` : reason);
        return;
      }

      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm",
        );
        const modelAssetPath =
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
        try {
          landmarkerRef.current = await vision.HandLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath, delegate: "GPU" },
            runningMode: "VIDEO",
            numHands: 1,
          });
        } catch {
          landmarkerRef.current = await vision.HandLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath, delegate: "CPU" },
            runningMode: "VIDEO",
            numHands: 1,
          });
        }
        setStatus("Camera active. Green lines track your hand.");
        animationRef.current = requestAnimationFrame(() => processFrameRef.current());
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : error && typeof error === "object" && "message" in error
            ? String(error.message)
            : "The MediaPipe runtime or hand model could not be downloaded.";
        setStatus(`Camera image is active, but hand recognition could not load. ${message}`);
      }
    }
    void startCamera();
    return () => {
      cancelled = true;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      stream?.getTracks().forEach((track) => track.stop());
      landmarkerRef.current?.close?.();
      landmarkerRef.current = null;
      wristTrailRef.current = [];
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      setCameraReady(false);
      setCameraInfo("Camera is off");
    };
  }, [controlEnabled, demoMode, processFrame]);

  useEffect(() => {
    if (!demoMode || !player.isPlaying) return;
    const timer = window.setInterval(() => {
      setPlayer((current) => {
        const nextProgress = current.progressMs + 1000;
        return nextProgress >= current.durationMs
          ? { ...current, progressMs: 0 }
          : { ...current, progressMs: nextProgress };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [demoMode, player.isPlaying]);

  const toggleControl = () => {
    setControlEnabled((enabled) => !enabled);
    setStatus(controlEnabled ? "Control mode disabled" : demoMode ? "Demo control mode enabled" : "Starting camera...");
  };

  const login = () => { router.push("/api/auth/spotify/start"); };
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthenticated(false);
    setStatus("Signed out of Spotify.");
  };
  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  };

  if (!onboardingComplete) {
    return (
      <main className={styles.onboardingPage}>
        <div className={styles.cursorHalo} />
        <section className={styles.onboarding}>
          <div className={styles.onboardingKicker}>GESTURE PLAYER / 01</div>
          <div className={styles.onboardingRule} />
          <h1 className={styles.onboardingTitle}>A quieter way<br />to control sound.</h1>
          <p className={styles.onboardingIntro}>Use simple hand movements to direct your music. The camera stays in your browser; no video is recorded or uploaded.</p>
          <div className={styles.onboardingGrid}>
            <div>
              <p className={styles.sectionLabel}>GESTURES</p>
              <div className={styles.gestureList}>
                <div><b>01</b><span>Open palm</span><em>resume</em></div>
                <div><b>02</b><span>Closed fist</span><em>pause</em></div>
                <div><b>03</b><span>Thumb direction</span><em>previous / next</em></div>
                <div><b>04</b><span>V movement</span><em>volume</em></div>
              </div>
            </div>
            <div className={styles.cameraCheck}>
              <p className={styles.sectionLabel}>CAMERA CHECK</p>
              <div className={`${styles.checkPanel} ${cameraTested ? styles.checkReady : ""}`}>
                <span className={styles.checkMark}>{cameraTested ? "✓" : "○"}</span>
                <p>{cameraTestStatus}</p>
              </div>
              <button className={styles.textButton} onClick={testCamera}>Test camera <span>↗</span></button>
            </div>
          </div>
          <div className={styles.onboardingFooter}>
            <span>Local processing · No account required for Demo</span>
            <button className={styles.startButton} onClick={() => { setOnboardingComplete(true); setControlEnabled(true); }}>Start session <span>→</span></button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <div className={styles.cursorHalo} />
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>GESTURE PLAYER <span>/ LIVE SESSION</span></p>
            <h1 className={styles.title}>Direct the room.</h1>
            <p className={styles.subtitle}>Hands become the interface.</p>
          </div>
          <span className={`${styles.badge} ${controlEnabled ? styles.badgeOn : ""}`}>
            {controlEnabled ? "CONTROL ON" : "CONTROL OFF"}
          </span>
          <div className={styles.authActions}>
            {authenticated ? <button className={styles.secondaryButton} onClick={logout}>Sign out</button> : <button className={styles.spotifyButton} onClick={login}>Sign in with Spotify</button>}
          </div>
        </header>

        <div className={styles.grid}>
          <section className={styles.cameraCard}>
            <div className={styles.cameraFrame}>
              <video ref={videoRef} muted playsInline className={styles.video} />
              <canvas ref={canvasRef} className={styles.landmarks} aria-label="Live hand movement recognition overlay" />
              {!cameraReady && <div className={styles.cameraPlaceholder}><span>◎</span><p>{demoMode ? "Demo mode" : "Camera preview"}</p></div>}
              <div className={styles.gesturePill}>{detectedGesture}</div>
            </div>
            <div className={styles.controls}>
              <button className={styles.primaryButton} onClick={toggleControl}>
                {controlEnabled ? "Turn control off" : "Turn control on"}
              </button>
              <label className={styles.switchLabel}>
                <input type="checkbox" checked={demoMode} onChange={(event) => {
                  const enabled = event.target.checked;
                  setDemoMode(enabled);
                  if (enabled) setPlayer((current) => ({ ...current, ...demoTracks[demoTrackIndexRef.current], image: demoTracks[demoTrackIndexRef.current].image }));
                }} />
                <span>Demo mode</span>
              </label>
            </div>
            <p className={styles.status}>{status}</p>
            <p className={styles.cameraInfo}>{cameraInfo}</p>
            <p className={styles.cameraHelp}>Green skeleton · white trail · local processing</p>
          </section>

          <section className={styles.playerCard}>
            <div className={styles.cardTitle}><span>NOW PLAYING</span><span className={styles.spotifyDot}>● Spotify</span></div>
            <div className={styles.track}>
              {demoMode ? <div className={styles.albumArt} style={{ background: player.image ?? undefined }}>♫</div> : player.image ? <img className={styles.albumArt} src={player.image} alt="" /> : <div className={styles.albumArt}>♫</div>}
              <div><h2>{player.title}</h2><p>{demoMode ? `${player.artist} · ${player.album}` : `${player.artist} · ${player.album}`}</p></div>
            </div>
            <div className={styles.progress}><span style={{ width: `${player.durationMs ? (player.progressMs / player.durationMs) * 100 : 0}%` }} /></div>
            <div className={styles.playerMeta}><span>{formatTime(player.progressMs)} / {formatTime(player.durationMs)}</span><strong>Volume {player.volume}%</strong></div>
            <div className={styles.playback}><span>‹</span><button className={styles.playButton} onClick={() => executeCommand(player.isPlaying ? "pause" : "resume")}>{player.isPlaying ? "Ⅱ" : "▶"}</button><span>›</span></div>
            {demoMode && <div className={styles.demoActions}>
              <button onClick={() => executeCommand("previous")}>Previous</button>
              <button onClick={() => executeCommand("next")}>Next</button>
              <button onClick={() => executeCommand("volumeDown")}>Vol −</button>
              <button onClick={() => executeCommand("volumeUp")}>Vol +</button>
            </div>}
            <p className={styles.hint}>{loadingPlayer ? "Updating…" : player.isPlaying ? "Playing" : "Paused"} · {demoMode ? player.lastCommand : player.device}</p>
          </section>
        </div>

        <section className={styles.legend}>
          <div><b>✊</b><span>Pause</span></div><div><b>✋</b><span>Resume</span></div><div><b>→</b><span>Next</span></div><div><b>←</b><span>Previous</span></div><div><b>V ↑↓</b><span>Volume</span></div><div><b>V +</b><span>Mute</span></div>
        </section>
        <footer className={styles.footer}>Camera frames stay on your device. Nothing is recorded or uploaded.</footer>
      </section>
    </main>
  );
}
