"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const cameraErrors: Record<string, string> = {
  NotAllowedError:
    "Camera permission was denied. Allow camera access in your browser's site settings, then retry.",
  NotFoundError: "No camera found. Connect a webcam and retry.",
  NotReadableError:
    "The camera is already in use by another app. Close it and retry.",
  OverconstrainedError:
    "The camera does not support the requested settings.",
};

export function useCamera() {
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (internalVideoRef.current) {
      internalVideoRef.current.srcObject = null;
    }

    setIsActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is not supported by this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
        },
        audio: false,
      });

      streamRef.current = stream;

      if (internalVideoRef.current) {
        internalVideoRef.current.srcObject = stream;
        await internalVideoRef.current.play();
      }

      setIsActive(true);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      setError(
        cameraErrors[name] ??
          "The camera could not be started. Check your browser permissions and try again.",
      );
      setIsActive(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const videoRef = useCallback((node: HTMLVideoElement | null) => {
    internalVideoRef.current = node;
    if (node && streamRef.current) {
      // Only set srcObject if it has changed to prevent resetting the stream on every render
      if (node.srcObject !== streamRef.current) {
        node.srcObject = streamRef.current;
      }
      node.play().catch(() => {});
    }
  }, []);

  return {
    videoRef,
    isActive,
    error,
    startCamera,
    stopCamera,
  };
}