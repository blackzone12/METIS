/**
 * METIS API Client
 *
 * Typed, thin fetch wrapper that points every call at the FastAPI backend
 * (port 8000 by default, overridden by NEXT_PUBLIC_API_URL).
 *
 * Each function mirrors one FastAPI endpoint and returns the full typed response.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// ── helpers ──────────────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[METIS API] ${res.status} ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[METIS API] ${res.status} ${path}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface SM2State {
  repetitions: number;
  interval: number;
  easeFactor: number;
  nextReview: string | null;
}

export interface AdaptiveControls {
  timerPaused: boolean;
  scratchpad: boolean;
  voiceFirst: boolean;
  fontScale: number;
}

export interface TelemetryResult {
  success: boolean;
  telemetry: {
    ear: number;
    headPitch: number;
    headYaw: number;
    voiceHesitation: number;
    speechDuration: number;
    motorFatigue: number;
  };
  cfi: number;
  mode: "NORMAL" | "FOCUS" | "SCRATCHPAD" | "BREAK";
  adaptive: AdaptiveControls;
}

export interface VoiceEvalResult {
  transcribed_speech: string;
  normalized_speech: string;
  expected_answer: string;
  is_semantically_correct: boolean;
  confidence: number;
  phonetic_similarity: number;
  feedback_phrase: string;
}

export interface VisualStep {
  step_number: number;
  title: string;
  explanation: string;
  visual_cue: string;
}

export interface RemediationResult {
  problem_text: string;
  core_concept: string;
  three_step_breakdown: VisualStep[];
  low_lexile_analogy: string;
  audio_readout_script: string;
  recommended_font_size_boost: string;
  encouragement_note: string;
}

export interface ArithmeticStep {
  step_number: number;
  transcribed_line: string;
  is_valid_step: boolean;
  explanation: string;
}

export interface ScratchpadOCRResult {
  detected_handwriting_text: string;
  step_breakdown: ArithmeticStep[];
  error_step_index: number | null;
  error_classification: string;
  diagnosis: string;
  pedagogical_feedback: string;
  confidence: number;
}

export interface AnswerResult {
  success: boolean;
  answer: string;
  correct: boolean;
  quality: number;
  sm2: SM2State;
}

export interface DashboardResult {
  sessionId: string;
  cfi: number;
  mode: "NORMAL" | "FOCUS" | "SCRATCHPAD" | "BREAK";
  telemetry: TelemetryResult["telemetry"];
  adaptive: AdaptiveControls;
  sm2: SM2State;
}

export interface SyncResult {
  status: "success" | "partial" | "error";
  inserted: {
    friction_logs: number;
    context_cards: number;
    retention_states: number;
  };
  warnings?: string[];
}

// ── Session ───────────────────────────────────────────────────────────────────

/** Start a new METIS learning session — returns the sessionId. */
export async function startSession(): Promise<string> {
  const data = await post<{ success: boolean; sessionId: string }>(
    "/api/telemetry/session/start",
    {}
  );
  return data.sessionId;
}

/** End a session (marks it COMPLETED in MySQL). */
export async function endSession(sessionId: string): Promise<void> {
  await post(`/api/telemetry/session/${sessionId}/end`, {});
}

/** Fetch the full in-memory session snapshot. */
export async function getSession(
  sessionId: string
): Promise<{ success: boolean; session: DashboardResult }> {
  return get(`/api/telemetry/session/${sessionId}`);
}

// ── Telemetry ─────────────────────────────────────────────────────────────────

export interface TelemetryInput {
  sessionId: string;
  ear?: number;
  headPitch?: number;
  headYaw?: number;
  voiceHesitation?: number;
  speechDuration?: number;
  motorFatigue?: number;
}

/** Post raw sensor data → receives CFI, mode, and adaptive controls. */
export async function postTelemetry(
  input: TelemetryInput
): Promise<TelemetryResult> {
  return post("/api/telemetry/telemetry", input);
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

/** Full session dashboard snapshot (CFI, mode, telemetry, SM-2). */
export async function getDashboard(sessionId: string): Promise<DashboardResult> {
  return get(`/api/session/dashboard/${sessionId}`);
}

// ── Voice Evaluation ──────────────────────────────────────────────────────────

export interface VoiceEvalInput {
  problem_text: string;
  expected_answer: string;
  transcribed_speech: string;
  dysgraphia_mode?: boolean;
  session_code?: string;
  duration_ms?: number;
  hesitation_count?: number;
}

/** Evaluate a spoken answer using semantic tolerance for dysgraphic learners. */
export async function evaluateVoice(
  input: VoiceEvalInput
): Promise<VoiceEvalResult> {
  return post("/api/voice/evaluate", input);
}

// ── Remediation ───────────────────────────────────────────────────────────────

export interface RemediationInput {
  problem_text: string;
  expected_answer?: string;
  student_attempt?: string;
  cfi?: number;
  subject?: string;  // passed through; backend ignores gracefully
  topic?: string;    // passed through; backend ignores gracefully
}

/** Generate a 3-step visual adaptive remediation breakdown via Gemini. */
export async function generateRemediation(
  input: RemediationInput
): Promise<RemediationResult> {
  return post("/api/remediation/generate", input);
}

// ── Scratchpad OCR ─────────────────────────────────────────────────────────────

export interface ScratchpadInput {
  problem_text: string;
  image_base64?: string;
  expected_answer?: string;
  session_code?: string;
}

/** Analyse a photo of handwritten rough-work — returns step breakdown + error isolation. */
export async function analyseScratchpad(
  input: ScratchpadInput
): Promise<ScratchpadOCRResult> {
  return post("/api/scratchpad/ocr", input);
}

/** @deprecated Use analyseScratchpad (corrected spelling) */
export const analyseScrratchpad = analyseScratchpad;

// ── Answer & SM-2 ─────────────────────────────────────────────────────────────

export interface AnswerInput {
  sessionId: string;
  questionId?: number;
  answer?: string;
  correct?: boolean;
  quality?: number;
}

/** Submit an answer — runs SM-2 and persists to MySQL. */
export async function submitAnswer(input: AnswerInput): Promise<AnswerResult> {
  return post("/api/session/answer", input);
}

// ── Offline Sync ──────────────────────────────────────────────────────────────

export interface FrictionLogItem {
  userId: string;
  sessionId: string;
  timestamp: string;
  cognitiveFrictionIndex?: number;
  difficultyScore?: number;
  attentionDrift?: boolean;
  squintingDetected?: boolean;
  downwardGaze?: boolean;
  interventionTriggered?: string;
}

export interface ContextCardItem {
  id?: number;
  deckId: string;
  title: string;
  content: string;
  type: string;
  tags?: string[];
  createdAt: string;
}

export interface RetentionStateItem {
  cardId: string;
  userId: string;
  nextReviewDate: string;
  interval: number;
  easeFactor: number;
  repetitions: number;
  lastReviewed?: string;
}

export interface SyncPayload {
  frictionLogs?: FrictionLogItem[];
  contextRegistry?: ContextCardItem[];
  retentionState?: RetentionStateItem[];
}

/** Push offline Dexie.js data to the MySQL backend. */
export async function syncOfflineData(payload: SyncPayload): Promise<SyncResult> {
  return post("/api/sync/sync-logs", payload);
}

// ── WebSocket helper ──────────────────────────────────────────────────────────

/**
 * Open a WebSocket to the METIS real-time telemetry stream.
 * The `onMessage` callback receives each parsed JSON event.
 */
export function openRealtimeSocket(
  onMessage: (data: unknown) => void,
  onError?: (e: Event) => void
): WebSocket {
  const wsBase = BASE_URL.replace(/^http/, "ws");
  const ws = new WebSocket(`${wsBase}/api/telemetry/ws`);
  ws.onmessage = (e) => {
    try {
      onMessage(JSON.parse(e.data as string));
    } catch {
      /* non-JSON frame — ignore */
    }
  };
  if (onError) ws.onerror = onError;
  return ws;
}
