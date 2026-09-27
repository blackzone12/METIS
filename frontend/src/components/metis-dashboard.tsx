"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCameraContext } from "./CameraProvider";
import { useLessonAudio } from "./use-lesson-audio";
import { useDictation } from "./use-dictation";
import { useStudentBehaviorAnalysis } from "./use-student-behavior-analysis";
import { initDatabase, syncLogsToBackend, logFrictionEvent } from "../lib/metis_db";
import {
  BookOpen,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileText,
  Home,
  ImagePlus,
  Lightbulb,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

const lessons = [
  {
    id: 1,
    title: "The Water Cycle",
    subject: "Science",
    duration: "12 min",
    progress: 72,
    color: "blue",
  },
  {
    id: 2,
    title: "Fractions & Decimals",
    subject: "Mathematics",
    duration: "18 min",
    progress: 45,
    color: "yellow",
  },
  {
    id: 3,
    title: "Photosynthesis",
    subject: "Biology",
    duration: "15 min",
    progress: 20,
    color: "green",
  },
];

const flashcards = [
  {
    question: "What is evaporation?",
    answer:
      "Evaporation is the process where liquid water changes into water vapour because of heat.",
  },
  {
    question: "What is condensation?",
    answer:
      "Condensation happens when water vapour cools and changes back into tiny liquid water droplets.",
  },
  {
    question: "What is precipitation?",
    answer:
      "Precipitation is water falling from clouds to Earth's surface as rain, snow, sleet, or hail.",
  },
];

const checklist = [
  "Read the lesson summary",
  "Complete the flashcards",
  "Answer the practice questions",
  "Review your mistakes",
];

function ProgressBar({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  return (
    <div
      className={`h-2 overflow-hidden rounded-full bg-[#dce3de] ${className}`}
    >
      <div
