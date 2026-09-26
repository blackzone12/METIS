from pydantic import BaseModel
from typing import List, Optional

class FrictionLog(BaseModel):
    id: Optional[int] = None
    userId: str
    sessionId: str
    timestamp: str
    cognitiveFrictionIndex: Optional[float] = None
    difficultyScore: Optional[float] = None
    attentionDrift: Optional[bool] = None
    squintingDetected: Optional[bool] = None
    downwardGaze: Optional[bool] = None
    interventionTriggered: Optional[str] = None

class ContextCard(BaseModel):
    id: Optional[int] = None
    deckId: str
    title: str
    content: str
    type: str
    tags: Optional[List[str]] = None
    createdAt: str

class RetentionState(BaseModel):
    id: Optional[int] = None
    cardId: str
    userId: str
    nextReviewDate: str
    interval: int
    easeFactor: float
    repetitions: int
    lastReviewed: Optional[str] = None

class SyncPayload(BaseModel):
    frictionLogs: List[FrictionLog] = []
    contextRegistry: List[ContextCard] = []
    retentionState: List[RetentionState] = []
