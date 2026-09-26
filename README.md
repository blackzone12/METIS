# METIS — AI Integration & Multimodal Runtime Engine

> Enterprise-grade multimodal AI learning companion featuring Gemini Adaptive Remediation, Scratchpad Vision OCR, Dysgraphia Voice Evaluation, a 7-Tier AI Runtime with JWT gateway, guardrails, hybrid context retrieval, self-attention weighting, KV-cache, and SSE streaming.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Directory Tree](#directory-tree)
3. [Architecture Diagram](#architecture-diagram)
4. [Layer-by-Layer File Connections](#layer-by-layer-file-connections)
5. [API Route Map](#api-route-map)
6. [Frontend → Backend Data Flow](#frontend--backend-data-flow)
7. [Database Schema & Table Ownership](#database-schema--table-ownership)
8. [Key Workflows](#key-workflows)
9. [Environment Variables](#environment-variables)

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+

### 1 · Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env          # fill in GEMINI_API_KEY or OPENROUTER_API_KEY (optional)
python run.py
# → http://localhost:8000
# → http://localhost:8000/docs  (Swagger)
```

### 2 · Frontend (development)

```bash
cd frontend
npm install
npm run dev                   # → http://localhost:3000
```

### 3 · Frontend (production / served by FastAPI)

```bash
cd frontend
npm run build                 # emits static export to frontend/out/
# FastAPI auto-mounts frontend/out/ at /
# Visit http://localhost:8000
```

---

## Directory Tree

```
IBM BOB 3/
├── README.md
├── .gitignore
│
├── backend/
│   ├── run.py                          ← server entry-point (uvicorn)
│   ├── requirements.txt
│   ├── .env.example
│   ├── metis.db                        ← SQLite database (auto-created)
│   ├── serverdashboard.js              ← legacy Node.js reference dashboard
│   │
│   └── app/
│       ├── main.py                     ← FastAPI app, CORS, router, static mount
│       ├── __init__.py
│       │
│       ├── api/
│       │   ├── router.py               ← aggregates all endpoint routers
│       │   ├── __init__.py
│       │   └── endpoints/
│       │       ├── ai_runtime.py       ← /api/runtime/*  (JWT, SSE streaming)
│       │       ├── answer.py           ← /api/session/answer  /api/session/dashboard
│       │       ├── remediation.py      ← /api/remediation/generate
│       │       ├── scratchpad.py       ← /api/scratchpad/ocr
│       │       ├── sync.py             ← /api/sync/sync-logs
│       │       ├── telemetry.py        ← /api/telemetry/*  (WebSocket /ws)
│       │       ├── voice.py            ← /api/voice/evaluate
│       │       └── __init__.py
│       │
│       ├── schemas/
│       │   ├── ai_runtime.py           ← LearnerProfile, RuntimePromptRequest, etc.
│       │   ├── answer.py               ← AnswerRequest, AnswerResponse, SM2State
│       │   ├── remediation.py          ← RemediationRequest, RemediationResponse
│       │   ├── scratchpad.py           ← ScratchpadOCRRequest, ScratchpadOCRResponse
│       │   ├── sync.py                 ← SyncPayload, FrictionLog, ContextCard, etc.
│       │   ├── voice.py                ← VoiceAnswerRequest, VoiceAnswerResponse
│       │   └── __init__.py
│       │
│       ├── services/
│       │   ├── answer_service.py       ← SM-2 algorithm + DB persistence
│       │   ├── context_retrieval.py    ← hybrid relational + vector retrieval
│       │   ├── gemini_service.py       ← Gemini / OpenRouter / offline fallback
│       │   ├── remediation_service.py  ← 3-step visual breakdown generation
│       │   ├── runtime_orchestrator.py ← 7-tier AI pipeline + SSE streaming
│       │   ├── scratchpad_service.py   ← multimodal OCR + error isolation
│       │   ├── sync_service.py         ← offline Dexie.js → DB sync
│       │   ├── telemetry_service.py    ← CFI engine + adaptive mode engine
│       │   ├── voice_service.py        ← spoken-answer semantic evaluation
│       │   └── __init__.py
│       │
│       └── core/
│           ├── auth.py                 ← HMAC-SHA256 JWT create/decode
│           ├── config.py               ← pydantic-settings (reads .env)
│           ├── dashboard.sql           ← MySQL schema reference
│           ├── db.py                   ← unified DB layer (SQLite ↔ MySQL)
│           ├── db_init.py              ← idempotent SQLite schema init on startup
│           ├── db_queries.py           ← all SQL constants (MySQL-dialect)
│           ├── guardrails.py           ← injection scan + PII redaction
│           ├── kv_cache.py             ← LRU prefix KV-cache engine
│           ├── rate_limiter.py         ← sliding-window per-user rate limiter
│           ├── self_attention.py       ← scaled dot-product attention engine
│           ├── sqlite_queries.py       ← SQLite DDL + REVIEW_CARD_UPSERT_SQLITE
│           └── __init__.py
│
└── frontend/
    ├── package.json
    ├── next.config.mjs                 ← output: 'export' (static build)
    ├── tsconfig.json
    ├── postcss.config.mjs
    │
    └── src/
        ├── app/
        │   ├── layout.tsx              ← RootLayout, Lexend font, globals.css
        │   ├── page.tsx                ← renders <MetisDashboard />
        │   └── globals.css
        │
        ├── components/
        │   ├── metis-dashboard.tsx     ← main UI (all tabs, modals, API calls)
        │   ├── use-camera.ts           ← webcam hook (getUserMedia)
        │   ├── use-dictation.ts        ← speech recognition hook (SpeechRecognition)
        │   └── use-lesson-audio.ts     ← TTS hook (SpeechSynthesis)
        │
        └── lib/
            ├── api.ts                  ← typed fetch wrapper → FastAPI (port 8000)
            └── metis_db.js             ← Dexie.js IndexedDB (offline store + sync)
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BROWSER  (Next.js Static Export)                   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  app/page.tsx  →  components/metis-dashboard.tsx                     │   │
│  │                                                                       │   │
│  │   Hooks                          Lib                                  │   │
│  │   ├── use-camera.ts              ├── lib/api.ts  ──────────────────── │───┼──► HTTP/WS  (port 8000)
│  │   ├── use-dictation.ts           └── lib/metis_db.js (IndexedDB)      │   │
│  │   └── use-lesson-audio.ts              │                               │   │
│  └──────────────────────────────────┬────┴───────────────────────────────┘   │
│                                     │ Dexie.js (offline)                     │
│                                     └─► frictionLogs / contextRegistry /     │
│                                         retentionState (IndexedDB)           │
└─────────────────────────────────────────────────────────────────────────────┘
                   │ fetch / WebSocket
                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FASTAPI  (backend/app/main.py)                        │
│                                                                              │
│  CORS ── api_router (/api) ─────────────────────────────────────────────    │
│  │                                                                      │    │
│  ├── /telemetry  ──► telemetry.py  ──► TelemetryService                │    │
│  │                    └── WebSocket /ws  (real-time push)               │    │
│  ├── /session    ──► answer.py     ──► AnswerService + TelemetryService │    │
│  ├── /remediation──► remediation.py──► RemediationService              │    │
│  ├── /scratchpad ──► scratchpad.py ──► ScratchpadService               │    │
│  ├── /voice      ──► voice.py      ──► VoiceService                    │    │
│  ├── /sync       ──► sync.py       ──► SyncService                     │    │
│  └── /runtime    ──► ai_runtime.py ──► AIRuntimeOrchestrator           │    │
│                        ├── JWT Auth (core/auth.py)                      │    │
│                        └── Rate Limiter (core/rate_limiter.py)          │    │
│                                                                          │    │
│  Services layer                                                          │    │
│  ├── GeminiService  ──► Google Gemini API / OpenRouter / offline sim    │    │
│  ├── ContextRetrievalService  ──► relational SM-2 + vector cosine       │    │
│  ├── SelfAttentionEngine      ──► scaled dot-product attention          │    │
│  ├── KVCacheEngine            ──► LRU prefix KV cache                  │    │
│  └── GuardrailLayer           ──► injection scan + PII redaction        │    │
│                                                                          │    │
│  Core DB layer                                                           │    │
│  ├── db.py  ─── USE_SQLITE=true ──► SQLite (metis.db)                  │    │
│  │           └── USE_SQLITE=false ─► MySQL (dashboard.sql schema)       │    │
│  ├── db_init.py  (startup: creates all tables via sqlite_queries.py)    │    │
│  ├── db_queries.py      (MySQL SQL constants)                           │    │
│  └── sqlite_queries.py  (SQLite DDL + UPSERT)                          │    │
│                                                                          │    │
│  Static mount: GET /  ──► frontend/out/  (Next.js build output)         │    │
│  GET /demo             ──► frontend/out/index.html                      │    │
└─────────────────────────────────────────────────────────────────────────────┘
                   │
         ┌─────────┴────────┐
         ▼                  ▼
  SQLite metis.db     MySQL (optional)
  (zero-config)       dashboard.sql schema
```

---

## Layer-by-Layer File Connections

### Entry Point Chain

| File | Connects to | Role |
|------|-------------|------|
| `backend/run.py` | `app.main:app` (uvicorn) | Launches server, adds `backend/` to `sys.path` |
| `app/main.py` | `app.core.config`, `app.core.db_init`, `app.api.router` | Creates FastAPI app, registers middleware, includes router, mounts `frontend/out/` |
| `app/api/router.py` | all 7 endpoint modules | Aggregates sub-routers with `/api` prefix |

### Endpoint → Schema → Service chain

| Endpoint | Schema | Service |
|----------|--------|---------|
| `endpoints/telemetry.py` | inline Pydantic | `services/telemetry_service.py` |
| `endpoints/answer.py` | `schemas/answer.py` | `services/answer_service.py`, `services/telemetry_service.py` |
| `endpoints/remediation.py` | `schemas/remediation.py` | `services/remediation_service.py` |
| `endpoints/scratchpad.py` | `schemas/scratchpad.py` | `services/scratchpad_service.py` |
| `endpoints/voice.py` | `schemas/voice.py` | `services/voice_service.py` |
| `endpoints/sync.py` | `schemas/sync.py` | `services/sync_service.py` |
| `endpoints/ai_runtime.py` | `schemas/ai_runtime.py` | `services/runtime_orchestrator.py`, `core/auth.py`, `core/rate_limiter.py`, `core/kv_cache.py` |

### Service → Core dependencies

| Service | Core modules used |
|---------|-------------------|
| `telemetry_service` | `core/db.py`, `core/db_queries.py` |
| `answer_service` | `core/db.py` (`execute` + `get_review_card_upsert`), `core/db_queries.py` |
| `sync_service` | `core/db.py` (`execute` + `get_review_card_upsert`), `core/db_queries.py` |
| `voice_service` | `core/db.py`, `core/db_queries.py` |
| `scratchpad_service` | `core/db.py`, `core/db_queries.py`, `services/gemini_service.py` |
| `remediation_service` | `services/gemini_service.py` |
| `runtime_orchestrator` | `core/guardrails.py`, `core/self_attention.py`, `core/kv_cache.py`, `services/context_retrieval.py`, `services/gemini_service.py` |
| `gemini_service` | `core/config.py` |
| `context_retrieval` | `schemas/ai_runtime.py` |

### Core module dependencies

| Module | Depends on |
|--------|-----------|
| `core/db.py` | `core/config.py`, `core/sqlite_queries.py` (for `get_review_card_upsert`), `core/db_queries.py` |
| `core/db_init.py` | `core/config.py`, `core/db.py`, `core/sqlite_queries.py` |
| `core/guardrails.py` | `schemas/ai_runtime.py` (`GuardrailResult`) |
| `core/kv_cache.py` | `schemas/ai_runtime.py` (`KVCacheStats`) |
| `core/self_attention.py` | `schemas/ai_runtime.py` (`AttentionWeight`, `LearnerProfile`, `RetrievedContextChunk`) |
| `core/rate_limiter.py` | `core/auth.py` (`TokenPayload`) |
| `core/auth.py` | stdlib only |
| `core/config.py` | `pydantic-settings` |

### Frontend file connections

| File | Imports / depends on |
|------|---------------------|
| `app/page.tsx` | `components/metis-dashboard.tsx` |
| `app/layout.tsx` | `@fontsource/lexend`, `app/globals.css` |
| `components/metis-dashboard.tsx` | `components/use-camera.ts`, `components/use-lesson-audio.ts`, `components/use-dictation.ts`, `lib/metis_db.js`, `lucide-react` |
| `lib/api.ts` | `NEXT_PUBLIC_API_URL` env var (default `http://127.0.0.1:8000`) |
| `lib/metis_db.js` | `dexie`, `NEXT_PUBLIC_API_URL` env var (default `""` = relative) |

---

## API Route Map

| Method | Path | Handler | Auth |
|--------|------|---------|------|
| `POST` | `/api/telemetry/session/start` | `telemetry.start_session` | None |
| `POST` | `/api/telemetry/session/{id}/end` | `telemetry.end_session` | None |
| `GET` | `/api/telemetry/session/{id}` | `telemetry.get_session` | None |
| `POST` | `/api/telemetry/telemetry` | `telemetry.update_telemetry` | None |
| `WS` | `/api/telemetry/ws` | `telemetry.websocket_endpoint` | None |
| `POST` | `/api/session/answer` | `answer.submit_answer` | None |
| `GET` | `/api/session/dashboard/{id}` | `answer.get_dashboard` | None |
| `POST` | `/api/remediation/generate` | `remediation.generate_adaptive_remediation` | None |
| `POST` | `/api/scratchpad/ocr` | `scratchpad.process_scratchpad_ocr` | None |
| `POST` | `/api/voice/evaluate` | `voice.evaluate_voice_answer` | None |
| `POST` | `/api/sync/sync-logs` | `sync.sync_logs` | None |
| `POST` | `/api/runtime/token` | `ai_runtime.generate_token` | None |
| `POST` | `/api/runtime/stream` | `ai_runtime.stream_runtime` | JWT Bearer |
| `POST` | `/api/runtime/execute` | `ai_runtime.execute_runtime` | JWT Bearer |
| `GET` | `/api/runtime/cache-stats` | `ai_runtime.get_cache_stats` | JWT Bearer |
| `GET` | `/api` | info JSON | None |
| `GET` | `/health` | health check | None |
| `GET` | `/demo` | frontend index.html | None |
| `GET` | `/docs` | Swagger UI | None |
| `GET` | `/` | static frontend (`frontend/out/`) | None |

---

## Frontend → Backend Data Flow

### Telemetry loop (real-time adaptive mode)

```
metis-dashboard.tsx
  └─► lib/api.ts · startSession()
        └─► POST /api/telemetry/session/start
              └─► TelemetryService.start_session()
                    └─► INSERT learning_sessions (DB)

  └─► lib/api.ts · postTelemetry(input)
        └─► POST /api/telemetry/telemetry
              └─► TelemetryService.update_telemetry()
                    ├─► calculateCFI()  →  cfi (0–1)
                    ├─► getAdaptiveMode(cfi)  →  NORMAL/FOCUS/SCRATCHPAD/BREAK
                    ├─► getAdaptiveControls(mode)  →  timerPaused, fontScale, …
                    ├─► INSERT telemetry (DB)
                    ├─► INSERT adaptive_events (DB)
                    └─► WebSocket broadcast → all connected clients
```

### Scratchpad OCR flow

```
metis-dashboard.tsx  (camera capture)
  └─► fetch POST /api/scratchpad/ocr  {image_base64, problem_text}
        └─► ScratchpadService.analyze_scratchpad_image()
              ├─► GeminiService.generate_multimodal_json()  (if image provided)
              │     └─► Google Gemini Vision API  (or offline heuristic fallback)
              └─► persist to scratchpad_events (DB)
```

### Voice evaluation flow

```
metis-dashboard.tsx  (use-dictation.ts captures speech)
  └─► lib/api.ts · evaluateVoice(input)
        └─► POST /api/voice/evaluate
              └─► VoiceService.evaluate_spoken_answer()
                    ├─► normalize_spoken_text()  (filler removal, word-to-digit)
                    ├─► semantic match + phonetic similarity
                    └─► persist to voice_events (DB)
```

### Remediation flow

```
metis-dashboard.tsx
  └─► lib/api.ts · generateRemediation(input)
        └─► POST /api/remediation/generate
              └─► RemediationService.generate_remediation()
                    ├─► GeminiService.generate_json()  (LLM structured JSON)
                    └─► heuristic fallback (offline)
```

### Offline sync flow

```
lib/metis_db.js (Dexie IndexedDB)
  ├─► frictionLogs    (logFrictionEvent → auto-logged)
  ├─► contextRegistry (addContextCard)
  └─► retentionState  (updateSM2State)
        └─► syncLogsToBackend()
              └─► POST /api/sync/sync-logs  {frictionLogs, contextRegistry, retentionState}
                    └─► SyncService.sync_data()
                          ├─► INSERT friction_logs (DB)
                          ├─► INSERT context_registry (DB)
                          └─► UPSERT review_cards (DB)  ← DB-dialect aware
```

### 7-Tier AI Runtime flow

```
POST /api/runtime/stream  (JWT Bearer required)
  └─► AIRuntimeOrchestrator.stream_pipeline()
        │
        Tier 1 ── Input packaging & sanity check
        Tier 2 ── GuardrailLayer.inspect_input()
        │           ├─► injection pattern scan (10 regex patterns)
        │           └─► PII redaction (email, phone, SSN, card)
        Tier 3 ── ContextRetrievalService.assemble_context()
        │           ├─► retrieve_relational_context()  (SM-2 state, CFI)
        │           └─► retrieve_vector_context()      (cosine similarity over KB)
        Tier 4 ── SelfAttentionEngine.compute_contextual_attention()
        │           └─► scaled dot-product  Q·Kᵀ/√dₖ  + biometric CFI boost
        Tier 5 ── KVCacheEngine.lookup() / insert()
        │           └─► LRU cache on prefix SHA-256 hash
        Tier 6 ── GeminiService.generate_json()  (or offline sim)
        Tier 7 ── SSE token streaming
                    └─► event: token  (20ms cadence per word)
                    └─► event: done
```

---

## Database Schema & Table Ownership

| Table | Created by | Written by | Read by |
|-------|-----------|------------|---------|
| `users` | `sqlite_queries.py` / `dashboard.sql` | seeded at init | `sync_service` |
| `learning_sessions` | `sqlite_queries.py` / `dashboard.sql` | `telemetry_service` | `answer_service`, `voice_service`, `scratchpad_service` |
| `telemetry` | `sqlite_queries.py` / `dashboard.sql` | `telemetry_service` | — |
| `adaptive_events` | `sqlite_queries.py` / `dashboard.sql` | `telemetry_service` | — |
| `questions` | `sqlite_queries.py` / `dashboard.sql` | seeded at init | `answer_service` |
| `answers` | `sqlite_queries.py` / `dashboard.sql` | `answer_service` | — |
| `review_cards` | `sqlite_queries.py` / `dashboard.sql` | `answer_service`, `sync_service` | `answer_service` |
| `voice_events` | `sqlite_queries.py` / `dashboard.sql` | `voice_service` | — |
| `scratchpad_events` | `sqlite_queries.py` / `dashboard.sql` | `scratchpad_service` | — |
| `friction_logs` | `db_queries.py` (MySQL) / `sqlite_queries.py` | `sync_service` | — |
| `context_registry` | `db_queries.py` (MySQL) / `sqlite_queries.py` | `sync_service` | — |

**DB routing:** `core/db.py::execute()` transparently dispatches to SQLite (`metis.db`) when `USE_SQLITE=true` (default) or MySQL when `USE_SQLITE=false`. The `get_review_card_upsert()` helper selects the correct dialect-specific UPSERT statement.

---

## Key Workflows

### Application startup

```
run.py
  └─► uvicorn app.main:app
        └─► lifespan()
              └─► db_init.init_sqlite_schema()
                    ├─► db._get_sqlite_connection()  →  opens metis.db (WAL mode)
                    └─► sqlite_queries.ALL_STATEMENTS  →  CREATE TABLE IF NOT EXISTS × 11
                                                           + CREATE INDEX × 4
                                                           + seed demo user + question
```

### JWT authentication (AI Runtime)

```
Client  POST /api/runtime/token?user_id=X&role=student
  └─► create_access_token()  →  HMAC-SHA256 JWT (24h expiry)

Client  POST /api/runtime/stream  Authorization: Bearer <token>
  └─► get_current_user()  →  decode_access_token()
        ├─► verify HMAC signature
        ├─► check expiry
        └─► returns TokenPayload  →  injected as FastAPI dependency
```

### Rate limiting

```
enforce_gateway_rate_limit(request, user)
  └─► SlidingWindowRateLimiter.is_allowed(identifier)
        ├─► identifier = "user:<sub>"  (authenticated)  or  "ip:<host>"
        ├─► prune timestamps older than 60s
        ├─► count < 60  →  allowed
        └─► count ≥ 60  →  HTTP 429  Retry-After header
```

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | `""` | Google Gemini API key (optional — offline sim if blank) |
| `OPENROUTER_API_KEY` | `""` | OpenRouter key (used if Gemini key absent) |
| `OPENAI_API_KEY` | `""` | Alias for OpenRouter key |
| `OPENAI_BASE_URL` | `https://openrouter.ai/api/v1` | OpenAI-compatible endpoint |
| `LLM_MODEL` | `google/gemma-4-26b-a4b-it:free` | Model for OpenRouter |
| `GEMINI_MODEL` | `gemini-1.5-flash` | Gemini model name |
| `USE_SQLITE` | `true` | `true` = SQLite (zero-config), `false` = MySQL |
| `SQLITE_PATH` | `backend/metis.db` | Absolute or relative path to SQLite file |
| `MYSQL_HOST` | `127.0.0.1` | MySQL host (only when `USE_SQLITE=false`) |
| `MYSQL_PORT` | `3306` | MySQL port |
| `MYSQL_USER` | `root` | MySQL user |
| `MYSQL_PASSWORD` | `""` | MySQL password |
| `MYSQL_DATABASE` | `metis` | MySQL database name |
| `JWT_SECRET` | `metis-ai-runtime-super-secret-key-production` | **Change in production** |
| `JWT_EXPIRE_SECONDS` | `86400` | Token lifetime (24 h) |
| `GATEWAY_RATE_LIMIT_PER_MINUTE` | `60` | Requests per user per 60 s |
| `API_PREFIX` | `/api` | URL prefix for all API routes |
| `CORS_ORIGINS` | `["*"]` | Allowed CORS origins |

Frontend env (optional, place in `frontend/.env.local`):

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8000` | Backend base URL for `api.ts` and `metis_db.js` |
