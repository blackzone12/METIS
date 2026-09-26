"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export function useLessonAudio() {
  const [isListening, setIsListening] = useState(false); // Used as 'isSpeaking' to match existing dashboard code
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");

  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  const stop = useCallback(() => {
    if (supported) {
      window.speechSynthesis.cancel();
    }
    setIsListening(false);
    setTranscript("");
  }, [supported]);

  const start = useCallback((textToSpeak: string = "Hello, I am Metis. Welcome to your lesson.") => {
    if (!supported) {
      setError("Text-to-speech is not supported in this browser.");
      return;
    }

    setError("");
    stop();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    
    // Pick a good default voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.name.includes("Google") || v.name.includes("Natural")) || voices[0];
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      setIsListening(true);
      setTranscript("AI is speaking...");
    };

    utterance.onend = () => {
      setIsListening(false);
      setTranscript("");
    };

    utterance.onerror = (event) => {
      // Ignore abort errors which happen on cancel
      if (event.error !== "canceled") {
        setError(`Speech error: ${event.error}`);
      }
      setIsListening(false);
      setTranscript("");
    };

    window.speechSynthesis.speak(utterance);
  }, [supported, stop]);

  useEffect(() => {
    return () => {
      if (supported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [supported]);

  return {
    supported,
    isListening,
    transcript,
    error,
    start,
    stop,
    setTranscript,
  };
}