from typing import List, Optional
from pydantic import BaseModel


class RemediationRequest(BaseModel):
    problem_text: str
    expected_answer: Optional[str] = None
    student_attempt: Optional[str] = None
    cfi: float = 0.70
    learner_profile: str = "adhd_dyslexia"  # supports low-Lexile tailoring
    subject: Optional[str] = None
    topic: Optional[str] = None


class VisualStep(BaseModel):
    step_number: int
    title: str
    explanation: str
    visual_cue: str  # color or emoji/ascii layout indicator


class RemediationResponse(BaseModel):
    problem_text: str
    core_concept: str
    three_step_breakdown: List[VisualStep]
    low_lexile_analogy: str
    audio_readout_script: str
    recommended_font_size_boost: str = "+30%"
    encouragement_note: str
