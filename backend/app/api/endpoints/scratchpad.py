from fastapi import APIRouter
from app.schemas.scratchpad import ScratchpadOCRRequest, ScratchpadOCRResponse
from app.services.scratchpad_service import scratchpad_service

router = APIRouter()


@router.post("/ocr", response_model=ScratchpadOCRResponse)
async def process_scratchpad_ocr(request: ScratchpadOCRRequest) -> ScratchpadOCRResponse:
    """
    Analyzes physical handwritten paper rough-work, isolating calculation slips and arithmetic errors.
    """
    return await scratchpad_service.analyze_scratchpad_image(request)
