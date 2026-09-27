"use client";

import {
  createContext,
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

const CameraContext =
  createContext<CameraContextValue | null>(null);

/* =========================================================
   GLOBAL BEHAVIOR WARNING
   ========================================================= */

function GlobalBehaviorWarning({
  behaviorState,
}: {
  behaviorState: StudentBehaviorState;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  const {
    isSquinting,
    isConfused,
    isDistracted,
    isFatigued,
  } = behaviorState;

  /*
   * Make sure the portal is only created after the
   * component has mounted in the browser.
   */
  useEffect(() => {
    setMounted(true);
  }, []);

  /*
   * Choose one warning at a time.
   *
   * Priority:
   * 1. Squinting
   * 2. Distraction
   * 3. Fatigue
   * 4. Confusion
   */

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
      message:
        "Try bringing your attention back to your lesson.",
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

  /*
   * If the current condition disappears,
   * allow a future warning to appear again.
   */
  useEffect(() => {
    if (!warning) {
      setDismissed(false);
    }
  }, [
    isSquinting,
    isConfused,
    isDistracted,
    isFatigued,
  ]);

  /*
   * Nothing to display.
   */
  if (!mounted || !warning || dismissed) {
    return null;
  }

  /*
   * Render directly into document.body.
   *
   * This prevents the dashboard's layout, stacking
   * contexts, overflow rules, transforms, etc. from
   * hiding the warning.
   */
  return createPortal(
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2147483647,
        display: "flex",
        justifyContent: "center",
        padding: "20px",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "720px",
          background: warning.background,
          border: `3px solid ${warning.border}`,
          borderRadius: "24px",
          padding: "22px 24px",
          boxShadow:
            "0 20px 60px rgba(0, 0, 0, 0.25)",
          color: "#111827",
          pointerEvents: "auto",
          fontFamily:
            "Lexend, Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "16px",
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: "58px",
              height: "58px",
              minWidth: "58px",
              borderRadius: "16px",
              background: "rgba(255,255,255,0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "30px",
              boxShadow:
                "0 4px 12px rgba(0,0,0,0.08)",
            }}
          >
            {warning.icon}
          </div>

          {/* Text */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                opacity: 0.6,
                marginBottom: "4px",
              }}
            >
              Metis Study Alert
            </div>

            <div
              style={{
                fontSize: "24px",
                lineHeight: 1.2,
                fontWeight: 700,
                marginBottom: "8px",
              }}
            >
              {warning.title}
            </div>

            <div
              style={{
                fontSize: "15px",
                lineHeight: 1.5,
                opacity: 0.8,
              }}
            >
              {warning.message}
            </div>
          </div>

          {/* Dismiss */}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss warning"
            style={{
              border: "none",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.8)",
              padding: "8px 13px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              color: "#111827",
              whiteSpace: "nowrap",
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* =========================================================
   CAMERA PROVIDER
   ========================================================= */

export default function CameraProvider({
  children,
}: {
  children: ReactNode;
}) {
  const {
    stream,
    isActive,
    error,
    startCamera,
    stopCamera,
  } = useCamera();

  /*
   * Hidden video element used exclusively for
   * MediaPipe behavior analysis.
   */
  const analysisVideoRef =
    useRef<HTMLVideoElement | null>(null);

  const [analysisVideo, setAnalysisVideo] =
    useState<HTMLVideoElement | null>(null);

  /*
   * Attach the camera stream to the hidden
   * analysis video whenever the stream changes.
   */
  useEffect(() => {
    const video = analysisVideoRef.current;

    if (!video || !stream) {
      return;
    }

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    video.play().catch(() => {});
  }, [stream]);

  /*
   * Global MediaPipe behavior analysis.
   *
   * CameraProvider is mounted from layout.tsx,
   * so this continues running independently of
   * the dashboard UI.
   */
  const {
    behaviorState,
    modelReady,
  } = useStudentBehaviorAnalysis(
    analysisVideo,
    isActive,
    false,
  );

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
      {/* ============================================
          HIDDEN ANALYSIS VIDEO
          ============================================ */}
      <video
        ref={(node) => {
          analysisVideoRef.current = node;

          if (node) {
            setAnalysisVideo(node);

            if (stream && node.srcObject !== stream) {
              node.srcObject = stream;
            }

            node.play().catch(() => {});
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

      {/* ============================================
          GLOBAL BEHAVIOR WARNING
          ============================================ */}
      <GlobalBehaviorWarning
        behaviorState={behaviorState}
      />

      {/* ============================================
          CAMERA ERROR
          ============================================ */}
      {error && (
        <div
          role="alert"
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            zIndex: 2147483646,
            maxWidth: "380px",
            background: "white",
            color: "black",
            padding: "14px 18px",
            borderRadius: "16px",
            boxShadow:
              "0 10px 30px rgba(0,0,0,0.2)",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      {children}
    </CameraContext.Provider>
  );
}

/* =========================================================
   CAMERA CONTEXT HOOK
   ========================================================= */

export function useCameraContext() {
  const context = useContext(CameraContext);

  if (!context) {
    throw new Error(
      "useCameraContext must be used inside CameraProvider",
    );
  }

  return context;
}
