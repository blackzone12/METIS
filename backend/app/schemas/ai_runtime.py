from typing import List, Optional
from pydantic import BaseModel, Field


class LearnerProfile(BaseModel):
    user_id: str = "demo_student"
    session_id: str = "session_live"
    mastery_level: str = "intermediate"
    current_cfi: float = Field(default=0.0, ge=0.0, le=1.0, description="Cognitive Friction Index")
    current_hesitation_sec: float = Field(default=0.0, ge=0.0)
    current_ear: float = Field(default=0.28, ge=0.0)
    current_bfi: float = Field(default=0.22, ge=0.0)
    current_card_id: Optional[str] = None


class RuntimePromptRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="Student prompt or learning problem statement")
    learner_profile: Optional[LearnerProfile] = Field(default_factory=LearnerProfile)
    stream: bool = True
    max_tokens: int = Field(default=256, ge=1, le=2048)
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    enable_guardrails: bool = True
    enable_kv_cache: bool = True
    enable_context_retrieval: bool = True


class TokenEvent(BaseModel):
    token: str
    index: int
    is_final: bool = False


class AttentionWeight(BaseModel):
    token: str
    weight: float
    source: str = "query"  # "query", "cfi_state", "context", "response"


class KVCacheStats(BaseModel):
    cache_hit: bool = False
    cached_tokens: int = 0
    computation_cycles_saved: int = 0
    prefix_hash: str = ""
    ttft_speedup_factor: float = 1.0


class GuardrailResult(BaseModel):
    passed: bool = True
    sanitized_prompt: str = ""
    violations: List[str] = Field(default_factory=list)
    pii_redacted: List[str] = Field(default_factory=list)
    structured_schema_valid: bool = True


class RetrievedContextChunk(BaseModel):
    id: str
    source_type: str  # "relational_sm2" | "vector_knowledge"
    content: str
    relevance_score: float = 1.0


class RuntimeResponsePayload(BaseModel):
    session_id: str
    full_text: str
    guardrail_status: GuardrailResult
    attention_weights: List[AttentionWeight] = Field(default_factory=list)
    kv_cache_stats: KVCacheStats
    retrieved_contexts: List[RetrievedContextChunk] = Field(default_factory=list)
    generation_time_ms: float = 0.0
