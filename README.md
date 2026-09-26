# METIS — AI Integration & Multimodal Learning Engine

Enterprise-grade, high-performance, zero-cost AI backend for the **METIS** neuro-adaptive learning ecosystem.

This service is dedicated exclusively to the **AI Integration & Intelligence Layer**, combining **Google Gemini Multimodal AI** with a production-ready **7-Tier Streaming AI Runtime**.

---

## Architecture: 7-Tier AI Runtime & Multimodal Engines

```
[ Frontend / Client Apps ]
           │
           ▼
[ Layer 1: User Interaction & Packaging ]  ── Bearer JWT Tokens + Telemetry
           │
           ▼
[ Layer 2: Gateway Auth & Rate Limiter ]   ── RFC 7519 HS256 JWT & Sliding Window (60 req/min)
           │
           ▼
[ Layer 3: Safety Guardrails ]             ── Prompt Injection Refusal & PII Anonymization
           │
           ▼
[ Layer 4: Context Retrieval Engine ]      ── Hybrid Relational State + Vector Semantic Search
           │
           ▼
[ Layer 5: Self-Attention Relevance ]      ── Dynamic Token Attention & Struggle Weighting (A_ij)
           │
           ▼
[ Layer 6: Prefix KV Cache Engine ]        ── Invariant Prefix Hash Lookup & GPU FLOPs Savings
           │
           ▼
[ Layer 7: SSE Streaming Orchestrator ]    ── Server-Sent Events (text/event-stream)
```

---

## Core AI Capabilities

### 1. Multimodal Adaptive Remediation (`/api/remediation/generate`)
- Generates structured, empathetic **3-step visual breakdowns** for struggling learners.
- Provides **low-Lexile everyday analogies** to ground abstract concepts in intuitive real-world mental models.
- Synthesizes an **audio readout script** for screen readers and speech output.

### 2. Physical Scratchpad Vision OCR (`/api/scratchpad/ocr`)
- Accepts images of physical paper pencil-and-paper rough-work.
- Transcribes handwritten math equations step-by-step.
- Isolate arithmetic calculation errors (e.g., sign errors, borrow/carry slips) and produces targeted pedagogical advice.

### 3. Dysgraphia-Tolerant Voice Evaluation (`/api/voice/evaluate`)
- Evaluates spoken answers for students facing motor fatigue or dysgraphia.
- Normalizes number words (e.g. "six" $\to$ "6") and strips conversational filler phrases (e.g., "I think the answer is...").
- Measures phonetic and semantic similarity to prevent unfair penalties.

### 4. 7-Tier AI Runtime Streaming Engine (`/api/runtime/stream`)
- **Gateway Security**: Cryptographic HMAC-SHA256 JWT validation and sliding-window rate limiting.
- **Safety Guardrails**: Intercepts prompt injection attacks and redacts PII (emails, phone numbers, SSNs, credit cards).
- **Hybrid Retrieval**: Combines relational learner history with cosine-similarity vector embeddings of curriculum knowledge bases.
- **Self-Attention Engine**: Computes scaled dot-product attention weights across user prompts, cognitive friction state, and educational context.
- **Prefix KV Caching**: Stores invariant prompt prefixes, tracking cache hit rates and computation FLOPs saved.
- **Server-Sent Events (SSE)**: Delivers live streaming tokens over open HTTP connections.

---

## API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/runtime/token` | Issues RFC 7519 HMAC-SHA256 JWT access tokens for gateway authentication |
| `POST` | `/api/runtime/stream` | Streams AI tokens via Server-Sent Events (`text/event-stream`) |
| `POST` | `/api/runtime/execute` | Synchronous execution with token attention weights & KV cache telemetry |
| `GET` | `/api/runtime/cache-stats` | Prefix KV cache hit rate and computational cycles saved |
| `POST` | `/api/remediation/generate` | Generates 3-step visual remedial breakdowns & low-Lexile analogies |
| `POST` | `/api/scratchpad/ocr` | Physical paper snapshot OCR $\to$ arithmetic error isolation |
| `POST` | `/api/voice/evaluate` | Evaluates spoken voice answers with dysgraphia & motor tolerance |
| `GET` | `/api` | Service overview, capabilities, and endpoint catalog |
| `GET` | `/health` | Service health status check |
| `GET` | `/` or `/demo` | Interactive AI Integration Workbench UI |

---

## Quickstart & Execution

### 1. Launching the Backend
From the workspace root:
```powershell
& ".\backend_ai\venv\Scripts\python.exe" run_backend.py
```
Or from the `backend_ai` folder:
```powershell
cd backend_ai
python run.py
```

### 2. Accessing the AI Workbench & Documentation
- **Interactive AI Workbench**: [http://localhost:8000](http://localhost:8000)
- **Interactive OpenAPI (Swagger) Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **API Catalog**: [http://localhost:8000/api](http://localhost:8000/api)

### 3. Testing via Interactive AI Workbench
You can test all AI capabilities (SSE Token Stream, Adaptive Remediation, Scratchpad OCR, and Dysgraphia Voice) directly in the browser via the interactive workbench at [http://localhost:8000](http://localhost:8000) or using the OpenAPI Swagger UI at [http://localhost:8000/docs](http://localhost:8000/docs).
