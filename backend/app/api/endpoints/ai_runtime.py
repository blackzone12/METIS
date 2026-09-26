from fastapi import APIRouter, Depends, Request, Query
from fastapi.responses import StreamingResponse
from app.core.auth import get_current_user, TokenPayload, create_access_token
from app.core.rate_limiter import enforce_gateway_rate_limit
from app.schemas.ai_runtime import RuntimePromptRequest, RuntimeResponsePayload
from app.services.runtime_orchestrator import runtime_orchestrator
from app.core.kv_cache import kv_cache_engine

router = APIRouter()


@router.post("/token", summary="Generate JWT Access Token for Gateway Auth")
async def generate_token(
    user_id: str = Query("student_demo_user", description="Student / User identifier"),
    role: str = Query("student", description="Role: student or educator")
):
    """Issues an HMAC-SHA256 JWT access token for gateway authentication."""
    token = create_access_token(subject=user_id, role=role, expires_in_sec=86400)
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": 86400,
        "user_id": user_id,
        "role": role
    }


@router.post(
    "/stream",
    summary="Streaming SSE AI Runtime Endpoint (Tokens & Telemetry)",
    response_class=StreamingResponse
)
async def stream_runtime(
    request: Request,
    payload: RuntimePromptRequest,
    current_user: TokenPayload = Depends(get_current_user)
):
    """
    Executes the 7-tier AI Runtime pipeline and streams tokens sequentially
    over an open HTTP socket as Server-Sent Events (SSE).
    """
    # Gateway Rate Limiter enforcement
    await enforce_gateway_rate_limit(request, user=current_user)

    # Attach authenticated user_id if not present
    if payload.learner_profile and payload.learner_profile.user_id == "demo_student":
        payload.learner_profile.user_id = current_user.sub

    generator = runtime_orchestrator.stream_pipeline(payload)
    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post(
    "/execute",
    summary="Synchronous AI Runtime Completion",
    response_model=RuntimeResponsePayload
)
async def execute_runtime(
    request: Request,
    payload: RuntimePromptRequest,
    current_user: TokenPayload = Depends(get_current_user)
):
    """Non-streaming synchronous AI Runtime execution."""
    await enforce_gateway_rate_limit(request, user=current_user)

    if payload.learner_profile and payload.learner_profile.user_id == "demo_student":
        payload.learner_profile.user_id = current_user.sub

    return await runtime_orchestrator.execute_sync_pipeline(payload)


@router.get("/cache-stats", summary="KV Cache Metrics & Hardware Math Savings")
async def get_cache_stats(current_user: TokenPayload = Depends(get_current_user)):
    """Returns telemetry on KV cache hit rates, cached tokens, and FLOPs saved."""
    return {
        "total_queries": kv_cache_engine.total_queries,
        "total_hits": kv_cache_engine.total_hits,
        "hit_rate_pct": kv_cache_engine.get_hit_rate(),
        "total_tokens_saved": kv_cache_engine.total_tokens_saved,
        "cache_entries_active": len(kv_cache_engine._cache)
    }
