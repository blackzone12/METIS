"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

import { useCamera } from "@/components/use-camera";

interface CameraContextValue {
  stream: MediaStream | null;
  isActive: boolean;
  error: string;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
}

const CameraContext =
  createContext<CameraContextValue | null>(null);

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

  return (
    <CameraContext.Provider
      value={{
        stream,
        isActive,
        error,
        startCamera,
        stopCamera,
      }}
    >
      {/* Hidden video keeps the camera stream attached */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          position: "fixed",
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
        }}
      />

      {error && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            right: "20px",
            zIndex: 9999,
            padding: "12px 16px",
            borderRadius: "8px",
            background: "#fff",
            color: "#000",
            boxShadow:
              "0 4px 12px rgba(0, 0, 0, 0.15)",
          }}
        >
          {error}
        </div>
      )}

      {children}
    </CameraContext.Provider>
  );
}

export function useCameraContext() {
  const context = useContext(CameraContext);

  if (!context) {
    throw new Error(
      "useCameraContext must be used inside CameraProvider",
    );
  }

  return context;
}
