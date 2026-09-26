/**
 * METIS Dashboard Server  v4  (proxy edition)
 *
 * All business logic (CFI, SM-2, adaptive engine, MySQL writes) now lives
 * exclusively in the FastAPI backend (port 8000).
 *
 * This server's only responsibilities are:
 *   1. Forward REST calls to the FastAPI backend and relay the response.
 *   2. Maintain a WebSocket hub for real-time dashboard clients.
 *   3. Receive telemetry/voice/answer POSTs, forward them, then broadcast
 *      the result to all connected WebSocket clients.
 *
 * Environment variables
 * ─────────────────────
 *   PORT          HTTP port for this server          (default 5000)
 *   API_BASE_URL  FastAPI backend base URL           (default http://127.0.0.1:8000)
 */

"use strict";

const express   = require("express");
const cors      = require("cors");
const http      = require("http");
const WebSocket = require("ws");
const fetch     = require("node-fetch");   // npm install node-fetch@2

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });

const PORT     = process.env.PORT         || 5000;
const API_BASE = process.env.API_BASE_URL || "http://127.0.0.1:8000";

app.use(cors());
app.use(express.json());
app.use(express.static("public"));


// ─────────────────────────────────────────────────────────────────────────────
// Internal helper — proxy a request to FastAPI and return parsed JSON
// ─────────────────────────────────────────────────────────────────────────────

async function proxyPost(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
    });
    return { status: res.status, data: await res.json() };
}

async function proxyGet(path) {
    const res = await fetch(`${API_BASE}${path}`);
    return { status: res.status, data: await res.json() };
}


// ─────────────────────────────────────────────────────────────────────────────
// Health / info
// ─────────────────────────────────────────────────────────────────────────────

app.get("/", (_req, res) => {
    res.json({
        app:      "METIS Dashboard Server",
        version:  "4.0-proxy",
        backend:  API_BASE,
        status:   "running",
    });
});


// ─────────────────────────────────────────────────────────────────────────────
// Session
// ─────────────────────────────────────────────────────────────────────────────

app.post("/api/session/start", async (_req, res) => {
    const { status, data } = await proxyPost("/api/telemetry/session/start", {});
    res.status(status).json(data);
});

app.get("/api/session/:id", async (req, res) => {
    const { status, data } = await proxyGet(`/api/telemetry/session/${req.params.id}`);
    res.status(status).json(data);
});

app.post("/api/session/:id/end", async (req, res) => {
    const { status, data } = await proxyPost(`/api/telemetry/session/${req.params.id}/end`, {});
    res.status(status).json(data);
});


// ─────────────────────────────────────────────────────────────────────────────
// Telemetry  — forward then broadcast
// ─────────────────────────────────────────────────────────────────────────────

app.post("/api/telemetry", async (req, res) => {
    const { status, data } = await proxyPost("/api/telemetry/telemetry", req.body);

    if (data.success) {
        broadcast({
            type:      "adaptive_update",
            sessionId: req.body.sessionId,
            data,
        });
    }

    res.status(status).json(data);
});


// ─────────────────────────────────────────────────────────────────────────────
// Voice  — forward then broadcast
// ─────────────────────────────────────────────────────────────────────────────

app.post("/api/voice", async (req, res) => {
    const { sessionId, text = "", duration = 0, hesitationCount = 0 } = req.body;

    // Evaluate via FastAPI voice endpoint
    const { status, data } = await proxyPost("/api/voice/evaluate", {
        problem_text:        req.body.problem_text || "",
        expected_answer:     req.body.expected_answer || "",
        transcribed_speech:  text,
        session_code:        sessionId,
        duration_ms:         duration,
        hesitation_count:    hesitationCount,
    });

    if (data.feedback_phrase) {
        broadcast({
            type:      "voice_update",
            sessionId,
            data,
        });
    }

    res.status(status).json(data);
});


// ─────────────────────────────────────────────────────────────────────────────
// Answer & SM-2  — forward then broadcast
// ─────────────────────────────────────────────────────────────────────────────

app.post("/api/answer", async (req, res) => {
    const { status, data } = await proxyPost("/api/session/answer", req.body);

    if (data.success) {
        broadcast({
            type:      "answer_update",
            sessionId: req.body.sessionId,
            data,
        });
    }

    res.status(status).json(data);
});


// ─────────────────────────────────────────────────────────────────────────────
// Scratchpad  — forward
// ─────────────────────────────────────────────────────────────────────────────

app.post("/api/scratchpad", async (req, res) => {
    const { sessionId, text = "", image_base64, problem_text = "", expected_answer } = req.body;

    const { status, data } = await proxyPost("/api/scratchpad/ocr", {
        problem_text,
        expected_answer,
        image_base64,
        session_code: sessionId,
    });

    res.status(status).json(data);
});


// ─────────────────────────────────────────────────────────────────────────────
// Remediation  — forward
// ─────────────────────────────────────────────────────────────────────────────

app.post("/api/remediation", async (req, res) => {
    const { status, data } = await proxyPost("/api/remediation/generate", req.body);
    res.status(status).json(data);
});


// ─────────────────────────────────────────────────────────────────────────────
// Dashboard  — forward
// ─────────────────────────────────────────────────────────────────────────────

app.get("/api/dashboard/:id", async (req, res) => {
    const { status, data } = await proxyGet(`/api/session/dashboard/${req.params.id}`);
    res.status(status).json(data);
});


// ─────────────────────────────────────────────────────────────────────────────
// Sync (offline Dexie.js data)  — forward
// ─────────────────────────────────────────────────────────────────────────────

app.post("/api/sync", async (req, res) => {
    const { status, data } = await proxyPost("/api/sync/sync-logs", req.body);
    res.status(status).json(data);
});


// ─────────────────────────────────────────────────────────────────────────────
// WebSocket hub
// ─────────────────────────────────────────────────────────────────────────────

wss.on("connection", (socket) => {
    console.log("[WS] client connected  —  total:", wss.clients.size);

    socket.send(JSON.stringify({
        type:    "connection",
        message: "Connected to METIS Dashboard Server",
        backend: API_BASE,
    }));

    socket.on("message", (raw) => {
        try {
            const msg = JSON.parse(raw);
            console.log("[WS] message:", msg);
        } catch {
            console.warn("[WS] non-JSON message ignored");
        }
    });

    socket.on("close", () => {
        console.log("[WS] client disconnected  —  total:", wss.clients.size);
    });
});

function broadcast(data) {
    const payload = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}


// ─────────────────────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
    console.log("═══════════════════════════════════════");
    console.log("  METIS Dashboard Server  v4  (proxy)");
    console.log(`  HTTP  →  http://localhost:${PORT}`);
    console.log(`  WS    →  ws://localhost:${PORT}`);
    console.log(`  API   →  ${API_BASE}`);
    console.log("═══════════════════════════════════════");
});
