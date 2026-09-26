"""
METIS AI Integration Backend: AI & Multimodal Services.
"""
from app.services.gemini_service import gemini_service, GeminiService
from app.services.remediation_service import remediation_service, RemediationService
from app.services.scratchpad_service import scratchpad_service, ScratchpadService
from app.services.voice_service import voice_service, VoiceService
from app.services.context_retrieval import (
    context_retrieval_service,
    ContextRetrievalService
)
from app.services.runtime_orchestrator import (
    runtime_orchestrator,
    AIRuntimeOrchestrator
)

# Convenience alias
HybridContextRetriever = ContextRetrievalService

__all__ = [
    "gemini_service",
    "GeminiService",
    "remediation_service",
    "RemediationService",
    "scratchpad_service",
    "ScratchpadService",
    "voice_service",
    "VoiceService",
    "context_retrieval_service",
    "ContextRetrievalService",
    "HybridContextRetriever",
    "runtime_orchestrator",
    "AIRuntimeOrchestrator"
]
