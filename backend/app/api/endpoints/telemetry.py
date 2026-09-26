from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import List
from app.services.telemetry_service import telemetry_service

router = APIRouter()
active_connections: List[WebSocket] = []


class TelemetryPayload(BaseModel):
    sessionId: str
    ear: float = 0.30
    headPitch: float = 0.0
    headYaw: float = 0.0
    voiceHesitation: float = 0.0
    speechDuration: int = 0
    motorFatigue: float = 0.0


@router.post("/session/start")
async def start_session():
    session_id = telemetry_service.start_session()
    return {"success": True, "sessionId": session_id}


@router.post("/session/{session_id}/end")
async def end_session(session_id: str):
    ok = telemetry_service.end_session(session_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True}


@router.get("/session/{session_id}")
async def get_session(session_id: str):
    session = telemetry_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"success": True, "session": session}


@router.post("/telemetry")
async def update_telemetry(payload: TelemetryPayload):
    telemetry_data = {
        "ear":              payload.ear,
        "headPitch":        payload.headPitch,
        "headYaw":          payload.headYaw,
        "voiceHesitation":  payload.voiceHesitation,
        "speechDuration":   payload.speechDuration,
        "motorFatigue":     payload.motorFatigue,
    }

    session = telemetry_service.update_telemetry(payload.sessionId, telemetry_data)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    result = {
        "success":  True,
        "telemetry": session["telemetry"],
        "cfi":       session["cfi"],
        "mode":      session["mode"],
        "adaptive":  session["adaptive"],
    }

    # Broadcast over WebSocket connections
    for connection in active_connections:
        try:
            await connection.send_json({
                "type":      "adaptive_update",
                "sessionId": payload.sessionId,
                "data":      result,
            })
        except Exception:
            pass

    return result


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        await websocket.send_json({
            "type": "connection",
            "message": "Connected to METIS Python realtime server",
        })
        while True:
            data = await websocket.receive_text()
            # Echo back any ping or passthrough messages
    except WebSocketDisconnect:
        active_connections.remove(websocket)
