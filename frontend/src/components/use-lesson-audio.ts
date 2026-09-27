"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export function useLessonAudio() {
  const [isListening, setIsListening] = useState(false); // Used as 'isSpeaking'
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsListening(false);
    setTranscript("");
  }, []);

  const start = useCallback(async (textToSpeak: string = "Hello, I am Metis. Welcome to your lesson.") => {
    setError("");
    stop();

    setIsListening(true);
    setTranscript("Generating AI voice...");

    try {
      const response = await fetch("/api/tts/speak", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: textToSpeak, lang: "en" }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch audio from backend");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => setTranscript("AI is speaking...");
      audio.onended = () => {
        setIsListening(false);
        setTranscript("");
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setError("Failed to play AI audio.");
        setIsListening(false);
        setTranscript("");
        URL.revokeObjectURL(url);
      };

      await audio.play();
    } catch (e: any) {
      setError(e.message || "Failed to generate speech");
      setIsListening(false);
      setTranscript("");
    }
  }, [stop]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    supported: true,
    isListening,
    transcript,
    error,
    start,
    stop,
    setTranscript,
  };
}