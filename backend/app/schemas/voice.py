from typing import Optional
from pydantic import BaseModel


class VoiceAnswerRequest(BaseModel):
    problem_text: str
    expected_answer: str
    transcribed_speech: str
    dysgraphia_mode: bool = True
    # Optional session linkage for MySQL persistence
    session_code: Optional[str] = None
    duration_ms: Optional[int] = None
    hesitation_count: Optional[int] = None


class VoiceAnswerResponse(BaseModel):
    transcribed_speech: str
    normalized_speech: str
    expected_answer: str
    is_semantically_correct: bool
    confidence: float
    phonetic_similarity: float
    feedback_phrase: str
