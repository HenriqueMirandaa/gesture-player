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

const initialPlayer: PlayerState = {
  isPlaying: false,
  volume: 50,
  title: "Not connected",
  artist: "Sign in with Spotify to see your player",
  album: "",
  image: null,
  progressMs: 0,
  durationMs: 0,
  device: "No active device",
  lastCommand: "Ready for a gesture",
};

export default function Home() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<{
    detectForVideo: (video: HTMLVideoElement, timestamp: number) => {
      landmarks?: Array<Array<{ x: number; y: number; z: number }>>;
    };
    close?: () => void;
  } | null>(null);
  const animationRef = useRef<number | null>(null);
  const processFrameRef = useRef<() => void>(() => undefined);
  const lastGestureRef = useRef<{ gesture: Gesture; at: number } | null>(null);
  const [controlEnabled, setControlEnabled] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const [status, setStatus] = useState("Demo mode is ready");
  const [detectedGesture, setDetectedGesture] = useState("No gesture");
  const [player, setPlayer] = useState(initialPlayer);
  const [authenticated, setAuthenticated] = useState(false);
  const [loadingPlayer, setLoadingPlayer] = useState(false);

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
        return { ...current, lastCommand: command === "next" ? "Next track" : "Previous track" };
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
    const result = landmarker.detectForVideo(video, performance.now());
    const landmarks = result.landmarks?.[0];
    if (landmarks) {
      const gesture = classifyGesture(landmarks);
      setDetectedGesture(gestureLabel(gesture));
      if (gesture) void executeCommand(gesture);
    } else {
      setDetectedGesture("No hand detected");
    }
    animationRef.current = requestAnimationFrame(() => processFrameRef.current());
  }, [executeCommand]);
  useEffect(() => {
    processFrameRef.current = processFrame;
  }, [processFrame]);

  useEffect(() => {
    if (!controlEnabled || demoMode) return;
    let stream: MediaStream | undefined;
    let cancelled = false;
    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (cancelled || !videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm",
        );
        landmarkerRef.current = await vision.HandLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });
        setCameraReady(true);
        setStatus("Camera active. Show a gesture.");
        animationRef.current = requestAnimationFrame(() => processFrameRef.current());
      } catch {
        setStatus("Camera could not start. Check browser permission and HTTPS.");
      }
    }
    void startCamera();
    return () => {
      cancelled = true;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      stream?.getTracks().forEach((track) => track.stop());
      landmarkerRef.current?.close?.();
      landmarkerRef.current = null;
      setCameraReady(false);
    };
  }, [controlEnabled, demoMode, processFrame]);

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

  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>GESTURE PLAYER</p>
            <h1 className={styles.title}>Control music with your hands.</h1>
            <p className={styles.subtitle}>A privacy-first Spotify controller powered by your camera.</p>
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
              {!cameraReady && <div className={styles.cameraPlaceholder}><span>◎</span><p>{demoMode ? "Demo mode" : "Camera preview"}</p></div>}
              <div className={styles.gesturePill}>{detectedGesture}</div>
            </div>
            <div className={styles.controls}>
              <button className={styles.primaryButton} onClick={toggleControl}>
                {controlEnabled ? "Turn control off" : "Turn control on"}
              </button>
              <label className={styles.switchLabel}>
                <input type="checkbox" checked={demoMode} onChange={(event) => setDemoMode(event.target.checked)} />
                <span>Demo mode</span>
              </label>
            </div>
            <p className={styles.status}>{status}</p>
          </section>

          <section className={styles.playerCard}>
            <div className={styles.cardTitle}><span>NOW PLAYING</span><span className={styles.spotifyDot}>● Spotify</span></div>
            <div className={styles.track}>
              {player.image ? <img className={styles.albumArt} src={player.image} alt="" /> : <div className={styles.albumArt}>♫</div>}
              <div><h2>{demoMode ? player.lastCommand : player.title}</h2><p>{demoMode ? "Demo track · Gesture Player" : `${player.artist} · ${player.album}`}</p></div>
            </div>
            <div className={styles.progress}><span style={{ width: `${player.durationMs ? (player.progressMs / player.durationMs) * 100 : 0}%` }} /></div>
            <div className={styles.playerMeta}><span>{formatTime(player.progressMs)} / {formatTime(player.durationMs)}</span><strong>Volume {player.volume}%</strong></div>
            <div className={styles.playback}><span>‹</span><button className={styles.playButton} onClick={() => executeCommand(player.isPlaying ? "pause" : "resume")}>{player.isPlaying ? "Ⅱ" : "▶"}</button><span>›</span></div>
            <p className={styles.hint}>{loadingPlayer ? "Updating…" : player.isPlaying ? "Playing" : "Paused"} · {demoMode ? "commands are simulated" : player.device}</p>
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
