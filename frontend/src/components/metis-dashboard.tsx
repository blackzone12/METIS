"use client";

import { useEffect, useRef, useState } from "react";
import { useCamera } from "./use-camera";
import { useLessonAudio } from "./use-lesson-audio";
import { useDictation } from "./use-dictation";
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
        className="h-full rounded-full bg-[#246348] transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-[#dce3de] bg-white shadow-[0_8px_30px_rgba(32,44,41,0.05)] ${className}`}
    >
      {children}
    </div>
  );
}

export default function MetisDashboard() {
  const [activeTab, setActiveTab] = useState("home");
  const [selectedLesson, setSelectedLesson] = useState(lessons[0]);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [completed, setCompleted] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [timer, setTimer] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showDictation, setShowDictation] = useState(false);
  const [toast, setToast] = useState("");
  const [tipIndex, setTipIndex] = useState(0);

  const aiTips = [
    "Break difficult material into small pieces and explain each piece in your own words.",
    "Use the Feynman Technique: Try teaching the concept to a 6-year-old to find gaps in your understanding.",
    "Space out your studying over several days rather than cramming. This builds stronger neural pathways.",
    "Use mnemonic devices and visual associations to connect new facts to things you already know.",
    "Test yourself frequently instead of just re-reading. Active recall forces your brain to retrieve information."
  ];

  const {
    videoRef,
    isActive: cameraActive,
    error: cameraError,
    startCamera,
    stopCamera,
  } = useCamera();

  const {
    isListening: lessonAudioListening,
    transcript: lessonTranscript,
    error: lessonAudioError,
    start: startLessonAudio,
    stop: stopLessonAudio,
  } = useLessonAudio();

  const {
    isListening: dictationListening,
    transcript: dictationTranscript,
    error: dictationError,
    start: startDictation,
    stop: stopDictation,
    setTranscript: setDictationTranscript,
  } = useDictation();

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string) => {
    setToast(message);

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = setTimeout(() => {
      setToast("");
    }, 2500);
  };

  useEffect(() => {
    initDatabase();
    
    const wsUrl = typeof window !== 'undefined' ? `ws://${window.location.host}/api/telemetry/ws` : 'ws://127.0.0.1:8000/api/telemetry/ws';
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Metis Backend WebSocket:", data);
      } catch (e) {}
    };

    return () => {
      ws.close();
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!timerRunning) return;

    const interval = window.setInterval(() => {
      setTimer((current) => {
        if (current <= 1) {
          setTimerRunning(false);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [timerRunning]);

  useEffect(() => {
    return () => {
      stopCamera();
      stopLessonAudio();
      stopDictation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const minutes = Math.floor(timer / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (timer % 60).toString().padStart(2, "0");

  const currentFlashcard = flashcards[flashcardIndex];

  const toggleCompleted = (item: string) => {
    setCompleted((current) =>
      current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item],
    );
  };

  const nextFlashcard = () => {
    setShowAnswer(false);
    setFlashcardIndex((current) => (current + 1) % flashcards.length);
  };

  const previousFlashcard = () => {
    setShowAnswer(false);
    setFlashcardIndex(
      (current) => (current - 1 + flashcards.length) % flashcards.length,
    );
  };

  const resetTimer = () => {
    setTimer(25 * 60);
    setTimerRunning(false);
  };

  const handleCamera = async () => {
    if (cameraActive) {
      stopCamera();
      return;
    }

    setShowCamera(true);
    await startCamera();
  };

  const handleDictation = () => {
    if (dictationListening) {
      stopDictation();
      return;
    }

    setShowDictation(true);
    startDictation();
  };

  const navItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "lessons", label: "Lessons", icon: BookOpen },
    { id: "notes", label: "Notes", icon: FileText },
  ];

  return (
    <main className="min-h-screen bg-[#f6f8f6] text-[#202c29]">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <aside className="hidden w-64 shrink-0 border-r border-[#dce3de] bg-white px-5 py-6 lg:block">
          <div className="mb-10 flex items-center gap-3 px-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#246348] text-white">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="text-xl font-semibold">Metis</div>
              <div className="text-xs text-[#596660]">Learning companion</div>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition ${
                    active
                      ? "bg-[#dcefe4] text-[#184936]"
                      : "text-[#596660] hover:bg-[#f6f8f6]"
                  }`}
                >
                  <Icon size={19} />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto pt-10">
            <button
              onClick={() => showToast("Settings are ready for customization.")}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-[#596660] hover:bg-[#f6f8f6]"
            >
              <Settings size={19} />
              Settings
            </button>

            <button
              onClick={() => showToast("Need help? Start with the lesson guide.")}
              className="mt-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-[#596660] hover:bg-[#f6f8f6]"
            >
              <CircleHelp size={19} />
              Help
            </button>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-[#dce3de] bg-[#f6f8f6]/95 px-4 py-4 backdrop-blur md:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 lg:hidden">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#246348] text-white">
                  <Sparkles size={20} />
                </div>
                <span className="font-semibold">Metis</span>
              </div>

              <div className="hidden md:block">
                <p className="text-sm text-[#596660]">Good morning</p>
                <h1 className="text-xl font-semibold">Ready to learn?</h1>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    showToast("Syncing data...");
                    try {
                      await syncLogsToBackend();
                      showToast("Sync complete.");
                    } catch (e) {
                      showToast("Sync failed.");
                    }
                  }}
                  className="flex h-10 px-3 items-center justify-center rounded-2xl bg-[#dcefe4] text-[#184936] text-sm font-semibold hover:bg-[#c9e6d4]"
                >
                  Sync Data
                </button>
                <button
                  onClick={() => setIsMuted((current) => !current)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dce3de] bg-white text-[#596660] hover:bg-[#f6f8f6]"
                  aria-label={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>

                <button
                  onClick={() => showToast("Profile settings opened.")}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-[#246348] text-sm font-semibold text-white"
                >
                  M
                </button>
              </div>
            </div>
          </header>

          <div className="px-4 py-6 md:px-8 md:py-8">
            {activeTab === "home" && (
              <div className="space-y-6">
                <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
                  <Card className="overflow-hidden">
                    <div className="grid md:grid-cols-[1.1fr_0.9fr]">
                      <div className="p-6 md:p-8">
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#dcefe4] px-3 py-1 text-xs font-semibold text-[#184936]">
                          <Sparkles size={14} />
                          Continue learning
                        </div>

                        <h2 className="max-w-xl text-3xl font-semibold leading-tight md:text-4xl">
                          {selectedLesson.title}
                        </h2>

                        <p className="mt-3 max-w-xl text-sm leading-6 text-[#596660]">
                          Pick up where you left off and keep your learning
                          momentum going.
                        </p>

                        <div className="mt-6 flex flex-wrap gap-3">
                          <button
                            onClick={() =>
                              showToast(`Opening ${selectedLesson.title}`)
                            }
                            className="inline-flex items-center gap-2 rounded-2xl bg-[#246348] px-5 py-3 text-sm font-semibold text-white hover:bg-[#184936]"
                          >
                            <Play size={17} fill="currentColor" />
                            Continue
                          </button>

                          <button
                            onClick={() => setActiveTab("lessons")}
                            className="rounded-2xl border border-[#dce3de] px-5 py-3 text-sm font-semibold text-[#202c29] hover:bg-[#f6f8f6]"
                          >
                            View lesson
                          </button>
                        </div>

                        <div className="mt-7">
                          <div className="mb-2 flex items-center justify-between text-xs">
                            <span className="text-[#596660]">Progress</span>
                            <span className="font-semibold">
                              {selectedLesson.progress}%
                            </span>
                          </div>
                          <ProgressBar value={selectedLesson.progress} />
                        </div>
                      </div>

                      <div className="relative min-h-[250px] bg-[#dcefe4] p-6">
                        <div className="absolute right-7 top-7 h-24 w-24 rounded-full bg-[#f4c95d]" />
                        <div className="absolute bottom-7 left-7 h-28 w-28 rounded-[2rem] bg-[#79a9d1]" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-lg backdrop-blur">
                            <BookOpen size={48} className="text-[#246348]" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[#596660]">
                          Focus timer
                        </p>
                        <h3 className="mt-1 text-xl font-semibold">
                          Pomodoro
                        </h3>
                      </div>
                      <Clock3 className="text-[#246348]" size={24} />
                    </div>

                    <div className="my-8 text-center">
                      <div className="text-6xl font-semibold tracking-tight">
                        {minutes}:{seconds}
                      </div>
                      <p className="mt-2 text-sm text-[#596660]">
                        {timerRunning ? "Stay focused" : "Ready when you are"}
                      </p>
                    </div>

                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => setTimerRunning((current) => !current)}
                        className="flex h-11 items-center gap-2 rounded-2xl bg-[#246348] px-5 text-sm font-semibold text-white"
                      >
                        {timerRunning ? (
                          <>
                            <Pause size={17} />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play size={17} fill="currentColor" />
                            Start
                          </>
                        )}
                      </button>

                      <button
                        onClick={resetTimer}
                        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#dce3de] bg-white"
                        aria-label="Reset timer"
                      >
                        <RotateCcw size={17} />
                      </button>
                    </div>
                  </Card>
                </section>

                <section>
                  <div className="mb-4 flex items-end justify-between">
                    <div>
                      <p className="text-sm text-[#596660]">Your workspace</p>
                      <h2 className="text-2xl font-semibold">
                        Study tools
                      </h2>
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    <Card className="p-5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#dcefe4] text-[#246348]">
                        <Camera size={21} />
                      </div>
                      <h3 className="mt-5 font-semibold">Camera</h3>
                      <p className="mt-2 text-sm leading-5 text-[#596660]">
                        Use your webcam while studying or working through visual
                        material.
                      </p>
                      <button
                        onClick={handleCamera}
                        className="mt-5 text-sm font-semibold text-[#246348]"
                      >
                        {cameraActive ? "Stop camera →" : "Open camera →"}
                      </button>
                    </Card>

                    <Card className="p-5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff0d6] text-[#9a6814]">
                        <Mic size={21} />
                      </div>
                      <h3 className="mt-5 font-semibold">Dictation</h3>
                      <p className="mt-2 text-sm leading-5 text-[#596660]">
                        Speak your thoughts and turn them into editable notes.
                      </p>
                      <button
                        onClick={handleDictation}
                        className="mt-5 text-sm font-semibold text-[#246348]"
                      >
                        {dictationListening
                          ? "Stop dictation →"
                          : "Start dictation →"}
                      </button>
                    </Card>

                    <Card className="p-5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e5edf5] text-[#3c6790]">
                        <Volume2 size={21} />
                      </div>
                      <h3 className="mt-5 font-semibold">Lesson audio</h3>
                      <p className="mt-2 text-sm leading-5 text-[#596660]">
                        Listen to the AI narrate your lesson and flashcard material.
                      </p>
                      <button
                        onClick={() =>
                          lessonAudioListening
                            ? stopLessonAudio()
                            : startLessonAudio(`Welcome to your lesson on ${selectedLesson.title}. Here are your flashcards: ` + flashcards.map(f => `${f.question} ... The answer is: ${f.answer}`).join('. '))
                        }
                        className="mt-5 text-sm font-semibold text-[#246348]"
                      >
                        {lessonAudioListening
                          ? "Stop listening →"
                          : "Listen to AI →"}
                      </button>
                    </Card>

                    <Card className="p-5">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f7e6e1] text-[#b25d49]">
                        <Lightbulb size={21} />
                      </div>
                      <h3 className="mt-5 font-semibold">AI Study tip</h3>
                      <p className="mt-2 min-h-[60px] text-sm leading-5 text-[#596660]">
                        {aiTips[tipIndex]}
                      </p>
                      <button
                        onClick={() => {
                          setTipIndex((current) => (current + 1) % aiTips.length);
                          showToast("Generating new AI tip...");
                        }}
                        className="mt-5 text-sm font-semibold text-[#246348]"
                      >
                        Ask AI for another tip →
                      </button>
                    </Card>
                  </div>
                </section>

                <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
                  <Card className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-[#596660]">Revision</p>
                        <h2 className="mt-1 text-2xl font-semibold">
                          Flashcards
                        </h2>
                      </div>
                      <div className="rounded-xl bg-[#dcefe4] px-3 py-2 text-xs font-semibold text-[#184936]">
                        {flashcardIndex + 1}/{flashcards.length}
                      </div>
                    </div>

                    <button
                      onClick={() => setShowAnswer((current) => !current)}
                      className="mt-6 min-h-[190px] w-full rounded-3xl border border-[#dce3de] bg-[#f6f8f6] p-7 text-left"
                    >
                      <span className="text-xs font-semibold uppercase tracking-wider text-[#596660]">
                        {showAnswer ? "Answer" : "Question"}
                      </span>
                      <p className="mt-4 text-xl font-semibold leading-8">
                        {showAnswer
                          ? currentFlashcard.answer
                          : currentFlashcard.question}
                      </p>
                      <p className="mt-4 text-sm text-[#596660]">
                        Click to {showAnswer ? "see the question" : "reveal the answer"}.
                      </p>
                    </button>

                    <div className="mt-4 flex justify-between">
                      <button
                        onClick={previousFlashcard}
                        className="flex items-center gap-2 rounded-xl border border-[#dce3de] px-4 py-2 text-sm"
                      >
                        <ChevronLeft size={17} />
                        Previous
                      </button>

                      <button
                        onClick={nextFlashcard}
                        className="flex items-center gap-2 rounded-xl bg-[#246348] px-4 py-2 text-sm font-semibold text-white"
                      >
                        Next
                        <ChevronRight size={17} />
                      </button>
                    </div>
                  </Card>

                  <Card className="p-6">
                    <div>
                      <p className="text-sm text-[#596660]">Today's plan</p>
                      <h2 className="mt-1 text-2xl font-semibold">
                        Study checklist
                      </h2>
                    </div>

                    <div className="mt-6 space-y-3">
                      {checklist.map((item) => {
                        const isDone = completed.includes(item);

                        return (
                          <button
                            key={item}
                            onClick={() => toggleCompleted(item)}
                            className="flex w-full items-center gap-3 rounded-2xl border border-[#dce3de] p-4 text-left"
                          >
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                                isDone
                                  ? "border-[#246348] bg-[#246348] text-white"
                                  : "border-[#bfcac3]"
                              }`}
                            >
                              {isDone && <Check size={15} />}
                            </span>
                            <span
                              className={`text-sm ${
                                isDone
                                  ? "text-[#596660] line-through"
                                  : "font-medium"
                              }`}
                            >
                              {item}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                </section>
              </div>
            )}

            {activeTab === "lessons" && (
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-[#596660]">Learning library</p>
                  <h2 className="mt-1 text-3xl font-semibold">Lessons</h2>
                </div>

                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {lessons.map((lesson) => (
                    <Card
                      key={lesson.id}
                      className="overflow-hidden"
                    >
                      <div className="h-32 bg-[#dcefe4] p-5">
                        <div className="flex h-full items-end justify-between">
                          <BookOpen className="text-[#246348]" size={32} />
                          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold">
                            {lesson.duration}
                          </span>
                        </div>
                      </div>

                      <div className="p-5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-[#596660]">
                          {lesson.subject}
                        </p>
                        <h3 className="mt-2 text-xl font-semibold">
                          {lesson.title}
                        </h3>

                        <div className="mt-5">
                          <div className="mb-2 flex justify-between text-xs text-[#596660]">
                            <span>Progress</span>
                            <span>{lesson.progress}%</span>
                          </div>
                          <ProgressBar value={lesson.progress} />
                        </div>

                        <button
                          onClick={() => {
                            setSelectedLesson(lesson);
                            setActiveTab("home");
                            showToast(`${lesson.title} selected.`);
                          }}
                          className="mt-5 w-full rounded-2xl bg-[#246348] px-4 py-3 text-sm font-semibold text-white"
                        >
                          Open lesson
                        </button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "notes" && (
              <div className="mx-auto max-w-4xl">
                <div>
                  <p className="text-sm text-[#596660]">Your workspace</p>
                  <h2 className="mt-1 text-3xl font-semibold">Notes</h2>
                </div>

                <Card className="mt-6 p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#dcefe4] text-[#246348]">
                      <FileText size={21} />
                    </div>
                    <div>
                      <h3 className="font-semibold">Study notes</h3>
                      <p className="text-sm text-[#596660]">
                        Write down anything you want to remember.
                      </p>
                    </div>
                  </div>

                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Start writing your notes..."
                    className="mt-6 min-h-[400px] w-full resize-y rounded-2xl border border-[#dce3de] bg-[#f6f8f6] p-5 text-sm leading-7 outline-none focus:border-[#246348]"
                  />

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => showToast("Notes saved.")}
                      className="rounded-2xl bg-[#246348] px-5 py-3 text-sm font-semibold text-white"
                    >
                      Save notes
                    </button>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </section>
      </div>

      {showCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#202c29]/60 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Camera</h2>
                <p className="text-sm text-[#596660]">
                  Camera preview for your study session.
                </p>
              </div>

              <button
                onClick={() => {
                  stopCamera();
                  setShowCamera(false);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dce3de]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 overflow-hidden rounded-3xl bg-[#202c29]">
              <video
                id="camera-video"
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="aspect-video w-full object-cover -scale-x-100"
              />
            </div>

            {cameraError && (
              <p className="mt-4 rounded-2xl bg-[#f7e6e1] p-4 text-sm text-[#8d4637]">
                {cameraError}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={async () => {
                  const video = document.getElementById('camera-video') as HTMLVideoElement;
                  if (!video) return;
                  
                  showToast("Scanning notebook with AI...");
                  const canvas = document.createElement('canvas');
                  canvas.width = video.videoWidth;
                  canvas.height = video.videoHeight;
                  canvas.getContext('2d')?.drawImage(video, 0, 0);
                  const base64 = canvas.toDataURL('image/jpeg');
                  
                  try {
                    const res = await fetch('/api/scratchpad/ocr', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        image_base64: base64,
                        problem_text: "2x + 8 = 20"
                      })
                    });
                    const data = await res.json();
                    if (data.diagnosis) {
                      showToast("Analysis complete! Added to notes.");
                      setNotes(prev => prev + `\n\n[Scratchpad AI Scan]\nDiagnosis: ${data.diagnosis}\nFeedback: ${data.pedagogical_feedback}`);
                    } else {
                      showToast("Could not analyze scratchpad.");
                    }
                  } catch (e) {
                    showToast("Scan failed.");
                  }
                }}
                className="rounded-2xl border border-[#dce3de] bg-white px-5 py-3 text-sm font-semibold text-[#246348] hover:bg-[#f6f8f6]"
              >
                Scan Scratchpad
              </button>

              <button
                onClick={() => {
                  stopCamera();
                  setShowCamera(false);
                }}
                className="rounded-2xl bg-[#246348] px-5 py-3 text-sm font-semibold text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showDictation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#202c29]/60 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Dictation</h2>
                <p className="text-sm text-[#596660]">
                  Speak naturally and your words will appear below.
                </p>
              </div>

              <button
                onClick={() => {
                  stopDictation();
                  setShowDictation(false);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-[#dce3de]"
              >
                <X size={18} />
              </button>
            </div>

            <textarea
              value={dictationTranscript}
              onChange={(event) => setDictationTranscript(event.target.value)}
              className="mt-5 min-h-[250px] w-full rounded-3xl border border-[#dce3de] bg-[#f6f8f6] p-5 text-sm leading-7 outline-none"
              placeholder="Your dictation will appear here..."
            />

            {dictationError && (
              <p className="mt-4 rounded-2xl bg-[#f7e6e1] p-4 text-sm text-[#8d4637]">
                {dictationError}
              </p>
            )}

            <div className="mt-4 flex justify-between">
              <div className="flex gap-3">
                <button
                  onClick={() => setDictationTranscript("")}
                  className="rounded-2xl border border-[#dce3de] px-5 py-3 text-sm font-semibold hover:bg-[#f6f8f6]"
                >
                  Clear
                </button>
                <button
                  onClick={() => {
                    if (dictationTranscript.trim()) {
                      setNotes((prev) => prev ? prev + "\n" + dictationTranscript : dictationTranscript);
                      setDictationTranscript("");
                      showToast("Added dictation to notes");
                    }
                    stopDictation();
                    setShowDictation(false);
                  }}
                  className="rounded-2xl border border-[#dce3de] px-5 py-3 text-sm font-semibold text-[#246348] hover:bg-[#f6f8f6]"
                >
                  Save to Notes
                </button>
              </div>

              <button
                onClick={handleDictation}
                className="flex items-center gap-2 rounded-2xl bg-[#246348] px-5 py-3 text-sm font-semibold text-white"
              >
                {dictationListening ? (
                  <>
                    <Square size={16} fill="currentColor" />
                    Stop
                  </>
                ) : (
                  <>
                    <Mic size={16} />
                    Start
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {lessonAudioListening || lessonTranscript || lessonAudioError ? (
        <div className="fixed bottom-5 right-5 z-40 w-[min(420px,calc(100vw-2rem))] rounded-3xl border border-[#dce3de] bg-white p-5 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Lesson audio</p>
              <p className="mt-1 text-xs text-[#596660]">
                {lessonAudioListening ? "AI is speaking..." : "Stopped"}
              </p>
            </div>

            <button
              onClick={stopLessonAudio}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dce3de]"
            >
              <X size={16} />
            </button>
          </div>

          {lessonTranscript && (
            <p className="mt-4 rounded-2xl bg-[#f6f8f6] p-4 text-sm leading-6">
              {lessonTranscript}
            </p>
          )}

          {lessonAudioError && (
            <p className="mt-4 rounded-2xl bg-[#f7e6e1] p-4 text-sm text-[#8d4637]">
              {lessonAudioError}
            </p>
          )}
        </div>
      ) : null}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-[#202c29] px-5 py-3 text-sm font-medium text-white shadow-xl">
          {toast}
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#dce3de] bg-white/95 px-3 py-2 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex min-w-20 flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs ${
                  active
                    ? "font-semibold text-[#246348]"
                    : "text-[#596660]"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
}