"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const cameraErrors: Record<string, string> = {
  NotAllowedError:
    "Camera permission was denied. Allow camera access in your browser's site settings, then retry.",
  NotFoundError:
    "No camera found. Connect a webcam and retry.",
  NotReadableError:
    "The camera is already in use by another app. Close it and retry.",
  OverconstrainedError:
    "The camera does not support the requested settings.",
  SecurityError:
    "Camera access requires HTTPS or localhost and permission from your browser.",
};

export function useCamera() {
  const streamRef = useRef<MediaStream | null>(null);
  const requestInFlightRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(false);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState("");

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (mountedRef.current) {
      setStream(null);
      setIsActive(false);
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      return;
    }

    if (requestInFlightRef.current) {
      return requestInFlightRef.current;
    }

    setError("");

    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError("Camera access is not supported by this browser.");
      return;
    }

    const request = (async () => {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
          },
          audio: false,
        });

        if (!mountedRef.current) {
          newStream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = newStream;
        setStream(newStream);
        setIsActive(true);
        setError("");

        const videoTrack = newStream.getVideoTracks()[0];

        if (videoTrack) {
          videoTrack.onended = () => {
            if (streamRef.current === newStream) {
              streamRef.current = null;
              setStream(null);
              setIsActive(false);
            }
          };
        }
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";

        if (mountedRef.current) {
          setError(
            cameraErrors[name] ??
              "The camera could not be started. Check your browser permissions and try again.",
          );
          setIsActive(false);
          setStream(null);
        }
      } finally {
        requestInFlightRef.current = null;
      }
    })();

    requestInFlightRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const handlePageHide = () => {
      stopCamera();
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("pagehide", handlePageHide);

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      requestInFlightRef.current = null;
    };
  }, [stopCamera]);

  return {
    stream,
    isActive,
    error,
    startCamera,
    stopCamera,
  };
}
