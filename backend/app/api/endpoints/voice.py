from fastapi import APIRouter
from app.schemas.voice import VoiceAnswerRequest, VoiceAnswerResponse
from app.services.voice_service import voice_service

router = APIRouter()


@router.post("/evaluate", response_model=VoiceAnswerResponse)
async def evaluate_voice_answer(request: VoiceAnswerRequest) -> VoiceAnswerResponse:
    """
    Evaluates spoken voice answers semantically to accommodate dysgraphia and motor friction.
    """
    return voice_service.evaluate_spoken_answer(request)
