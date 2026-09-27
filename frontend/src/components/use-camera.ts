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

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());

    streamRef.current = null;
    setStream(null);

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

    // Don't request another camera stream if one is already running.
    if (streamRef.current) {
      return;
    }

    try {
      const newStream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
          },
          audio: false,
        });

      streamRef.current = newStream;
      setStream(newStream);

      if (internalVideoRef.current) {
        internalVideoRef.current.srcObject = newStream;

        try {
          await internalVideoRef.current.play();
        } catch {
          // Browser may block autoplay until user interaction.
        }
      }

      setIsActive(true);
    } catch (err) {
      const name =
        err instanceof DOMException ? err.name : "";

      setError(
        cameraErrors[name] ??
          "The camera could not be started. Check your browser permissions and try again.",
      );

      setIsActive(false);
    }
  }, []);

  /*
   * Automatically start the camera when the component
   * using this hook is mounted.
   */
  useEffect(() => {
    startCamera();

    return () => {
      streamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());

      streamRef.current = null;
      setStream(null);
    };
  }, [startCamera]);

  /*
   * Attach the camera stream to the internal video element.
   */
  const videoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      internalVideoRef.current = node;

      if (node && streamRef.current) {
        if (node.srcObject !== streamRef.current) {
          node.srcObject = streamRef.current;
        }

        node.play().catch(() => {});
      }
    },
    [],
  );

  return {
    videoRef,
    stream,
    isActive,
    error,
    startCamera,
    stopCamera,
  };
}
