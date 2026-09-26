from fastapi import APIRouter
from app.schemas.remediation import RemediationRequest, RemediationResponse
from app.services.remediation_service import remediation_service

router = APIRouter()


@router.post("/generate", response_model=RemediationResponse)
async def generate_adaptive_remediation(request: RemediationRequest) -> RemediationResponse:
    """
    Generates an empathetic 3-step visual breakdown, low-Lexile analogy, and TTS audio script.
    """
    return await remediation_service.generate_remediation(request)
