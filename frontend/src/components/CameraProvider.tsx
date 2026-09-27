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
