import time
from collections import defaultdict
from typing import Dict, List, Tuple
from fastapi import Request, HTTPException, status
from app.core.auth import TokenPayload


class SlidingWindowRateLimiter:
    """
    In-memory Sliding Window Rate Limiter.
    Tracks timestamps of requests within a sliding time window (default 60s).
    Thread-safe and async-compatible.
    """

    def __init__(self, max_requests: int = 60, window_seconds: float = 60.0):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # key: identifier -> list of request timestamps (floats)
        self._history: Dict[str, List[float]] = defaultdict(list)

    def is_allowed(self, identifier: str) -> Tuple[bool, int, float]:
        """
        Evaluates whether a request with `identifier` is allowed.
        Returns:
            - allowed (bool): True if under limit, False otherwise.
            - remaining (int): Number of remaining calls allowed in current window.
            - retry_after (float): Seconds until the oldest request expires (if rate-limited).
        """
        now = time.time()
        cutoff = now - self.window_seconds

        # Prune expired timestamps
        timestamps = [ts for ts in self._history[identifier] if ts > cutoff]
        self._history[identifier] = timestamps

        if len(timestamps) < self.max_requests:
            timestamps.append(now)
            self._history[identifier] = timestamps
            remaining = self.max_requests - len(timestamps)
            return True, remaining, 0.0

        # Over limit: calculate time until earliest timestamp drops out
        earliest = timestamps[0]
        retry_after = max(0.1, (earliest + self.window_seconds) - now)
        return False, 0, round(retry_after, 2)

    def reset(self, identifier: str = None):
        """Clears rate limit records (useful for testing and admin resets)."""
        if identifier:
            if identifier in self._history:
                del self._history[identifier]
        else:
            self._history.clear()


# Default global rate limiter instance (60 requests per minute)
global_rate_limiter = SlidingWindowRateLimiter(max_requests=60, window_seconds=60.0)


async def enforce_gateway_rate_limit(
    request: Request,
    user: TokenPayload = None,
    limiter: SlidingWindowRateLimiter = None
) -> None:
    """
    FastAPI dependency / gateway guard validating rate limits per user/IP.
    Injects rate limit telemetry into request state or raises HTTP 429.
    """
    active_limiter = limiter or global_rate_limiter

    # Resolve identifier: prioritize authenticated user id over client host IP
    identifier = "anonymous"
    if user and user.sub:
        identifier = f"user:{user.sub}"
    elif request.client and request.client.host:
        identifier = f"ip:{request.client.host}"

    allowed, remaining, retry_after = active_limiter.is_allowed(identifier)

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Maximum {active_limiter.max_requests} requests per {active_limiter.window_seconds}s.",
            headers={
                "Retry-After": str(int(retry_after) + 1),
                "X-RateLimit-Limit": str(active_limiter.max_requests),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": str(int(time.time() + retry_after))
            }
        )
