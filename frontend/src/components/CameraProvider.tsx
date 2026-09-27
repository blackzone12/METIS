"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useCamera } from "@/components/use-camera";

import {
  useStudentBehaviorAnalysis,
  type StudentBehaviorState,
} from "@/components/use-student-behavior-analysis";

interface CameraContextValue {
  stream: MediaStream | null;
  isActive: boolean;
  error: string;

  behaviorState: StudentBehaviorState;
  modelReady: boolean;

  startCamera: () => Promise<void>;
  stopCamera: () => void;
}

const CameraContext =
  createContext<CameraContextValue | null>(
    null,
  );

function GlobalBehaviorWarning({
  behaviorState,
}: {
  behaviorState: StudentBehaviorState;
}) {
  const [dismissed, setDismissed] =
    useState(false);

  const {
    isSquinting,
    isConfused,
    isDistracted,
    isFatigued,
  } = behaviorState;

  /*
   * Pick ONE warning at a time.
   *
   * Priority:
   * Squinting
   * Distraction
   * Fatigue
   * Confusion
   */

  let warning:
    | {
        title: string;
        message: string;
        icon: string;
        className: string;
      }
    | null = null;

  if (isSquinting) {
    warning = {
      title: "Vision Strain Detected",
      message:
        "You appear to be squinting. Consider adjusting your screen or taking a short break.",
      icon: "👁️",
      className:
        "border-yellow-300 bg-yellow-50 text-yellow-950",
    };
  } else if (isDistracted) {
    warning = {
      title: "You Seem Distracted",
      message:
        "Try bringing your attention back to your lesson.",
      icon: "👀",
      className:
        "border-red-300 bg-red-50 text-red-950",
    };
  } else if (isFatigued) {
    warning = {
      title: "Fatigue Detected",
      message:
        "You may benefit from taking a short break before continuing.",
      icon: "😴",
      className:
        "border-purple-300 bg-purple-50 text-purple-950",
    };
  } else if (isConfused) {
    warning = {
      title: "Possible Confusion Detected",
      message:
        "Let's slow down and break the concept into smaller parts.",
      icon: "💡",
      className:
        "border-orange-300 bg-orange-50 text-orange-950",
    };
  }

  /*
   * Automatically allow the warning to appear again
   * when the detected condition disappears and
   * appears again.
   */

  useEffect(() => {
    if (!warning) {
      setDismissed(false);
    }
  }, [warning?.title]);

  if (!warning || dismissed) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[99999] flex justify-center px-4"
      role="alert"
      aria-live="assertive"
    >
      <div
        className={`pointer-events-auto mt-5 w-full max-w-2xl rounded-3xl border-2 px-6 py-5 shadow-2xl backdrop-blur-md sm:px-8 sm:py-6 ${warning.className}`}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/70 text-3xl shadow-sm">
            {warning.icon}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider opacity-70">
              Metis study alert
            </p>

            <h2 className="mt-1 text-2xl font-bold sm:text-3xl">
              {warning.title}
            </h2>

            <p className="mt-2 text-sm leading-6 opacity-80 sm:text-base">
              {warning.message}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setDismissed(true)
            }
            className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold shadow-sm hover:bg-white"
            aria-label="Dismiss warning"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CameraProvider({
  children,
}: {
  children: ReactNode;
}) {
  const {
    videoRef,
    stream,
    isActive,
    error,
    startCamera,
    stopCamera,
  } = useCamera();

  /*
   * This is the video element MediaPipe continuously
   * analyzes.
   *
   * It is NOT the dashboard preview.
   */
  const analysisVideoRef =
    useRef<HTMLVideoElement | null>(
      null,
    );

  const [
    analysisVideo,
    setAnalysisVideo,
  ] =
    useState<HTMLVideoElement | null>(
      null,
    );

  /*
   * Attach the camera stream to the hidden
   * analysis video.
   */
  useEffect(() => {
    const video =
      analysisVideoRef.current;

    if (!video || !stream) {
      return;
    }

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    video.play().catch(() => {});
  }, [stream]);

  /*
   * Run MediaPipe globally.
   *
   * This component lives in layout.tsx,
   * so it doesn't disappear when dashboard
   * content changes.
   */
  const {
    behaviorState,
    modelReady,
  } =
    useStudentBehaviorAnalysis(
      analysisVideo,
      isActive,
      false,
    );

  /*
   * Capture the hidden video element once
   * it has mounted.
   */
  useEffect(() => {
    setAnalysisVideo(
      analysisVideoRef.current,
    );
  }, []);

  return (
    <CameraContext.Provider
      value={{
        stream,
        isActive,
        error,
        behaviorState,
        modelReady,
        startCamera,
        stopCamera,
      }}
    >
      {/*
       * Hidden camera element used by the
       * global MediaPipe analysis.
       */}
      <video
        ref={(node) => {
          analysisVideoRef.current =
            node;

          if (node) {
            setAnalysisVideo(node);
          }
        }}
        autoPlay
        playsInline
        muted
        aria-hidden="true"
        style={{
          position: "fixed",
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
          left: "-10px",
          top: "-10px",
        }}
      />

      {/*
       * GLOBAL WARNING
       *
       * This is outside the dashboard,
       * so it appears over every page.
       */}
      <GlobalBehaviorWarning
        behaviorState={behaviorState}
      />

      {/*
       * Camera permission/error message.
       */}
      {error && (
        <div
          className="fixed bottom-5 right-5 z-[99998] max-w-sm rounded-2xl bg-white px-4 py-3 text-sm text-black shadow-xl"
          role="alert"
        >
          {error}
        </div>
      )}

      {children}
    </CameraContext.Provider>
  );
}

export function useCameraContext() {
  const context =
    useContext(CameraContext);

  if (!context) {
    throw new Error(
      "useCameraContext must be used inside CameraProvider",
    );
  }

  return context;
}
