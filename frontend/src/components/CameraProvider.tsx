```tsx
"use client";

import { useCamera } from "@/components/use-camera";
export default function CameraProvider() {
  const { videoRef, error } = useCamera();

  return (
    <>
      {/* Hidden camera element.
          The camera stream remains active even though
          the video preview isn't displayed. */}
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
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          }}
        >
          {error}
        </div>
      )}
    </>
  );
}
```
