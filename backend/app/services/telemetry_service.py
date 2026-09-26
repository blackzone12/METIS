"""
Telemetry service — computes CFI & adaptive mode, persists to MySQL.

Dashboard.sql tables used:
  • learning_sessions  (created / completed via start_session / end_session)
  • telemetry          (one row per update_telemetry call)
  • adaptive_events    (one row every time the adaptive mode is computed)
"""
import time
import logging
from typing import Dict, Any, Optional

from app.core.db         import execute
from app.core.db_queries import (
    SESSION_INSERT,
    SESSION_COMPLETE,
    SESSION_GET_ID_BY_CODE,
    TELEMETRY_INSERT,
    ADAPTIVE_EVENT_INSERT,
)

logger = logging.getLogger("metis.telemetry")


class TelemetryService:

    def __init__(self):
        # In-memory cache — source of truth for real-time WS broadcast
        self.sessions: Dict[str, Dict[str, Any]] = {}

    # ─────────────────────────────────────────────────────────────────────────
    # CFI engine  (identical thresholds to serverdashboard.js calculateCFI)
    # ─────────────────────────────────────────────────────────────────────────

    def calculate_cfi(self, data: Dict[str, Any]) -> float:
        cfi = 0.0
        ear        = data.get("ear",              0.30)
        head_pitch = data.get("headPitch",        0)
        head_yaw   = data.get("headYaw",          0)
        voice_hes  = data.get("voiceHesitation",  0)
        motor_fat  = data.get("motorFatigue",     0)

        if   ear < 0.18: cfi += 0.30
        elif ear < 0.22: cfi += 0.15

        if abs(head_pitch) > 25: cfi += 0.20
        if abs(head_yaw)   > 20: cfi += 0.15

        cfi += min(voice_hes * 0.20, 0.20)
        cfi += min(motor_fat * 0.15, 0.15)

        return round(max(0.0, min(cfi, 1.0)), 2)

    # ─────────────────────────────────────────────────────────────────────────
    # Adaptive engine  (identical to serverdashboard.js getAdaptiveMode /
    #                   getAdaptiveControls)
    # ─────────────────────────────────────────────────────────────────────────

    def get_adaptive_mode(self, cfi: float) -> str:
        if   cfi < 0.25: return "NORMAL"
        elif cfi < 0.50: return "FOCUS"
        elif cfi < 0.75: return "SCRATCHPAD"
        else:            return "BREAK"

    def get_adaptive_controls(self, mode: str) -> Dict[str, Any]:
        _map: Dict[str, Dict[str, Any]] = {
            "NORMAL":     {"timerPaused": False, "scratchpad": False, "voiceFirst": False, "fontScale": 1.00},
            "FOCUS":      {"timerPaused": False, "scratchpad": False, "voiceFirst": True,  "fontScale": 1.05},
            "SCRATCHPAD": {"timerPaused": True,  "scratchpad": True,  "voiceFirst": True,  "fontScale": 1.10},
            "BREAK":      {"timerPaused": True,  "scratchpad": True,  "voiceFirst": True,  "fontScale": 1.15},
        }
        return _map.get(mode, _map["NORMAL"])

    # ─────────────────────────────────────────────────────────────────────────
    # Session management
    # ─────────────────────────────────────────────────────────────────────────

    def _resolve_db_session_id(self, session_code: str) -> Optional[int]:
        rows = execute(SESSION_GET_ID_BY_CODE, (session_code,), fetch=True)
        return rows[0][0] if rows else None

    def start_session(self) -> str:
        session_code = f"METIS-{int(time.time() * 1000)}-{int(time.time() % 1000)}"
        self.sessions[session_code] = {
            "sessionId":  session_code,
            "startedAt":  time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "telemetry": {
                "ear":              0.30,
                "headPitch":        0,
                "headYaw":          0,
                "voiceHesitation":  0,
                "speechDuration":   0,
                "motorFatigue":     0,
            },
            "cfi":      0,
            "mode":     "NORMAL",
            "adaptive": self.get_adaptive_controls("NORMAL"),
            "sm2": {
                "repetitions": 0,
                "interval":    1,
                "easeFactor":  2.5,
                "nextReview":  None,
            },
        }
        # Persist — user_id=1 is the demo user seeded by dashboard.sql
        execute(SESSION_INSERT, (1, session_code))
        return session_code

    def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        return self.sessions.get(session_id)

    def end_session(self, session_id: str) -> bool:
        if session_id not in self.sessions:
            return False
        execute(SESSION_COMPLETE, (session_id,))
        return True

    # ─────────────────────────────────────────────────────────────────────────
    # Telemetry update  — writes one row to `telemetry` and one to
    # `adaptive_events` in MySQL on every call
    # ─────────────────────────────────────────────────────────────────────────

    def update_telemetry(
        self,
        session_id:    str,
        telemetry_data: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:

        session = self.sessions.get(session_id)
        if not session:
            return None

        cfi      = self.calculate_cfi(telemetry_data)
        mode     = self.get_adaptive_mode(cfi)
        adaptive = self.get_adaptive_controls(mode)

        session["telemetry"] = telemetry_data
        session["cfi"]       = cfi
        session["mode"]      = mode
        session["adaptive"]  = adaptive

        # ── MySQL persistence ─────────────────────────────────────────────────
        db_sid = self._resolve_db_session_id(session_id)
        if db_sid is not None:
            execute(
                TELEMETRY_INSERT,
                (
                    db_sid,
                    telemetry_data.get("ear",             0.30),
                    telemetry_data.get("headPitch",       0),
                    telemetry_data.get("headYaw",         0),
                    telemetry_data.get("voiceHesitation", 0),
                    int(telemetry_data.get("speechDuration", 0)),
                    telemetry_data.get("motorFatigue",    0),
                    cfi,
                ),
            )
            execute(
                ADAPTIVE_EVENT_INSERT,
                (
                    db_sid,
                    cfi,
                    mode,
                    int(adaptive["timerPaused"]),
                    int(adaptive["scratchpad"]),
                    int(adaptive["voiceFirst"]),
                    adaptive["fontScale"],
                ),
            )
        else:
            logger.debug(
                "Session %s not in MySQL yet — telemetry stored in-memory only.",
                session_id,
            )

        return session


telemetry_service = TelemetryService()
