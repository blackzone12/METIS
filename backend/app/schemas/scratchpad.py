from typing import List, Optional
from pydantic import BaseModel


class ScratchpadOCRRequest(BaseModel):
    image_base64: Optional[str] = None
    problem_text: str
    expected_answer: Optional[str] = None
    # Optional session linkage for MySQL persistence
    session_code: Optional[str] = None


class ArithmeticStep(BaseModel):
    step_number: int
    transcribed_line: str
    is_valid_step: bool
    explanation: str


class ScratchpadOCRResponse(BaseModel):
    detected_handwriting_text: str
    step_breakdown: List[ArithmeticStep]
    error_step_index: Optional[int] = None
    error_classification: str  # 'NO_ERROR', 'ARITHMETIC_SLIP', 'SIGN_TRANSPOSITION', 'CONCEPTUAL_GAP'
    diagnosis: str
    pedagogical_feedback: str
    confidence: float
