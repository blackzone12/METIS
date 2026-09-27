"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

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

const CameraContext = createContext<CameraContextValue | null>(null);

function GlobalBehaviorWarning({
  behaviorState,
}: {
  behaviorState: StudentBehaviorState;
}) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const { isSquinting, isConfused, isDistracted, isFatigued } = behaviorState;

  useEffect(() => {
    setMounted(true);
  }, []);

  let warning:
    | {
        title: string;
        message: string;
        icon: string;
        background: string;
        border: string;
      }
    | null = null;

  if (isSquinting) {
    warning = {
      title: "Vision Strain Detected",
      message:
        "You appear to be squinting. Consider adjusting your screen or taking a short break.",
      icon: "👁️",
      background: "#fffbeb",
      border: "#facc15",
    };
  } else if (isDistracted) {
    warning = {
      title: "You Seem Distracted",
      message: "Try bringing your attention back to your lesson.",
      icon: "👀",
      background: "#fef2f2",
      border: "#f87171",
    };
  } else if (isFatigued) {
    warning = {
      title: "Fatigue Detected",
      message:
        "You may benefit from taking a short break before continuing.",
      icon: "😴",
      background: "#faf5ff",
      border: "#c084fc",
    };
  } else if (isConfused) {
    warning = {
      title: "Possible Confusion Detected",
      message:
        "Let's slow down and break the concept into smaller parts.",
      icon: "💡",
      background: "#fff7ed",
      border: "#fb923c",
    };
  }

  useEffect(() => {
    if (!warning) {
      setDismissed(false);
    }
  }, [warning]);

  if (!mounted || !warning || dismissed) return null;

  return createPortal(
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-300">
      <div
        className="flex max-w-sm items-start gap-4 rounded-2xl border p-4 shadow-lg"
        style={{ backgroundColor: warning.background, borderColor: warning.border }}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-xl shadow-sm">
          {warning.icon}
        </div>
        <div className="flex-1 pt-1">
          <h3 className="font-semibold text-gray-900">{warning.title}</h3>
          <p className="mt-1 text-sm text-gray-700">{warning.message}</p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1 text-gray-400 hover:text-gray-600"
        >
          <span className="sr-only">Dismiss</span>
          ×
        </button>
      </div>
    </div>,
    document.body
  );
}

export default function CameraProvider({ children }: { children: ReactNode }) {
  const { stream, isActive, error, startCamera, stopCamera } = useCamera();
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoElement && stream) {
      if (videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
      }
      videoElement.play().catch(() => {});
    }
  }, [videoElement, stream]);

  const { behaviorState, modelReady } = useStudentBehaviorAnalysis(videoElement, isActive, false);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

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
      <video ref={setVideoElement} autoPlay playsInline muted style={{ opacity: 0, position: 'absolute', width: '1px', height: '1px', pointerEvents: 'none' }} />
      {children}
      <GlobalBehaviorWarning behaviorState={behaviorState} />
    </CameraContext.Provider>
  );
}

export function useCameraContext() {
  const context = useContext(CameraContext);
  if (!context) {
    throw new Error("useCameraContext must be used within a CameraProvider");
  }
  return context;
}
