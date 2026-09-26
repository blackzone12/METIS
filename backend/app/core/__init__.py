"""
METIS AI Integration Backend: Core Security, Rate Limiter, Guardrails, Attention, and KV Caching.
"""
from app.core.config import settings
from app.core.auth import create_access_token, get_current_user, TokenPayload
from app.core.rate_limiter import (
    enforce_gateway_rate_limit,
    global_rate_limiter,
    SlidingWindowRateLimiter
)
from app.core.guardrails import (
    guardrail_service,
    GuardrailLayer
)
from app.core.kv_cache import (
    kv_cache_engine,
    KVCacheEngine
)
from app.core.self_attention import (
    self_attention_engine,
    SelfAttentionEngine
)

# Convenience aliases
sliding_window_limiter = global_rate_limiter
InputGuardrailFilter = GuardrailLayer
OutputGuardrailFilter = GuardrailLayer

__all__ = [
    "settings",
    "create_access_token",
    "get_current_user",
    "TokenPayload",
    "enforce_gateway_rate_limit",
    "global_rate_limiter",
    "sliding_window_limiter",
    "SlidingWindowRateLimiter",
    "guardrail_service",
    "GuardrailLayer",
    "InputGuardrailFilter",
    "OutputGuardrailFilter",
    "kv_cache_engine",
    "KVCacheEngine",
    "self_attention_engine",
    "SelfAttentionEngine"
]
