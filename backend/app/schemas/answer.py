from typing import Optional
from pydantic import BaseModel


class AnswerRequest(BaseModel):
    sessionId: str
    questionId: Optional[int] = None   # maps to questions.id in dashboard.sql
    answer: str = ""
    correct: bool = False
    quality: int = 3                   # SM-2 quality 0-5


class SM2State(BaseModel):
    repetitions: int
    interval: int
    easeFactor: float
    nextReview: Optional[str] = None


class AnswerResponse(BaseModel):
    success: bool
    answer: str
    correct: bool
    quality: int
    sm2: SM2State
