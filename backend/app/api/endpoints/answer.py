from fastapi import APIRouter, HTTPException
from app.schemas.answer import AnswerRequest, AnswerResponse
from app.services.answer_service import answer_service
from app.services.telemetry_service import telemetry_service

router = APIRouter()


@router.post("/answer", response_model=AnswerResponse)
async def submit_answer(request: AnswerRequest) -> AnswerResponse:
    """
    Processes a student's answer, runs SM-2 spaced repetition, and persists
    the result to the answers + review_cards tables.
    """
    session = telemetry_service.get_session(request.sessionId)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return answer_service.process_answer(request)


@router.get("/dashboard/{session_id}")
async def get_dashboard(session_id: str):
    """
    Returns the full session snapshot — telemetry, CFI, adaptive controls,
    SM-2 state — mirroring the /api/dashboard/:id route in serverdashboard.js.
    """
    session = telemetry_service.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return {
        "sessionId":  session["sessionId"],
        "cfi":        session["cfi"],
        "mode":       session["mode"],
        "telemetry":  session["telemetry"],
        "adaptive":   session["adaptive"],
        "sm2":        session.get("sm2", {}),
    }
